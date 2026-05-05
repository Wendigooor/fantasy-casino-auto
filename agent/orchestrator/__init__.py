"""
Fantasy Casino — Orchestrator Module.

Coordinates the planner/executor/verifier workflow for task execution.

Task lifecycle:
    1. ingest task -> 2. classify risk -> 3. gather context ->
    4. draft plan (Planner) -> 5. review plan ->
    6. patch in sandbox (Executor) -> 7. verify (Verifier) ->
    8. report -> 9. finalize or rollback

Usage:
    from agent.orchestrator import Orchestrator, run_task

    orchestrator = Orchestrator()
    result = orchestrator.run(task_id=5)

    # Or run a single task through the full pipeline
    from agent.task_intake import get_next_task, start_task, complete_task
    task = get_next_task()
    if task:
        result = run_task(task["id"])
"""

import os
import json
import time
from datetime import datetime, timezone
from pathlib import Path

# Orchestrator submodules
from agent.orchestrator.planner import (
    draft_plan,
    get_plan,
    list_plans,
)
from agent.orchestrator.executor import (
    execute_plan,
    execute_command,
    list_work_files,
)
from agent.orchestrator.verifier import (
    verify_changes,
    verify_command,
    get_verification_report,
)
from agent.approval import request_approval, check_approval

from agent.memory import get_conn, log_action, get_task, now
from agent.task_intake import start_task as intake_start_task, complete_task as intake_complete_task

WORK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agent", "work")
PLANS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans")
os.makedirs(WORK_DIR, exist_ok=True)
os.makedirs(PLANS_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


class Orchestrator:
    """Main orchestrator that coordinates planner, executor, and verifier roles.

    The orchestrator is the central controller for the agent loop.
    It receives tasks, delegates planning/execution/verification,
    manages approvals, records checkpoints, and produces reports.
    """

    def __init__(self, model_endpoint: str = None, max_retries: int = 3,
                 approval_required: bool = True):
        self.model_endpoint = model_endpoint or os.environ.get(
            "MODEL_ENDPOINT", "http://127.0.0.1:8080/v1"
        )
        self.max_retries = max_retries
        self.approval_required = approval_required
        self.session_id = f"session_{_timestamp()}"

    def run(self, task_id: int) -> dict:
        """Run a task through the full planner->executor->verifier pipeline.

        Args:
            task_id: The task ID to execute.

        Returns:
            Dict with keys: task_id, status, plan, result, verification, error.
        """
        conn = get_conn()
        conn.execute("PRAGMA foreign_keys=ON")

        task = get_task(conn, task_id)
        if not task:
            error = f"Task {task_id} not found"
            log_action(conn, self.session_id, "orchestrator", "task_failed", error, success=False)
            conn.close()
            return {"task_id": task_id, "status": "failed", "error": error}

        # Start the task
        intake_start_task(task_id)
        log_action(conn, self.session_id, "orchestrator", "task_received",
                   f"Starting task #{task_id}: {task['title']}", success=True)

        result = {
            "task_id": task_id,
            "task_title": task["title"],
            "priority": task["priority"],
            "risk_class": task["risk_class"],
            "status": "running",
            "plan": None,
            "result": None,
            "verification": None,
            "error": None,
        }

        try:
            # Phase 1: Plan
            result["plan"] = self._phase_plan(task)

            # Phase 2: Execute (if plan succeeded and approval granted or auto-approved)
            plan_status = result["plan"].get("status") if result["plan"] else None
            if plan_status in ("approved", "auto_approved"):
                result["result"] = self._phase_execute(task, result["plan"])

                # Phase 3: Verify
                if result["result"] and result["result"].get("status") == "success":
                    result["verification"] = self._phase_verify(task, result["result"])

            # Mark task as done
            if result.get("verification") and result["verification"].get("status") == "passed":
                intake_complete_task(task_id, "done")
                result["status"] = "done"
            else:
                # Partial success or failure
                status = "failed"
                if result.get("verification") and result["verification"].get("status") == "failed":
                    status = "failed"
                elif result.get("result") and result["result"].get("status") == "success":
                    status = "partial"
                intake_complete_task(task_id, status)
                result["status"] = status

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            log_action(conn, self.session_id, "orchestrator", "task_exception",
                       f"Exception during task #{task_id}: {e}", success=False)

        log_action(conn, self.session_id, "orchestrator", "task_complete",
                   f"Task #{task_id} completed with status={result['status']}",
                   success=result["status"] in ("done", "partial"),
                   output=json.dumps(result, default=str))

        conn.close()
        return result

    def _phase_plan(self, task: dict) -> dict:
        """Phase 1: Generate a plan for the task.

        Args:
            task: Task dict from the database.

        Returns:
            Plan dict with status, description, steps, and risk assessment.
        """
        log_action(get_conn(), self.session_id, "planner", "planning_start",
                   f"Planning task #{task['id']}: {task['title']}")

        start_time = time.time()

        plan = draft_plan(
            task_title=task["title"],
            task_description=task["description"],
            risk_class=task["risk_class"],
            priority=task["priority"],
            model_endpoint=self.model_endpoint,
        )

        latency = int((time.time() - start_time) * 1000)
        log_action(get_conn(), self.session_id, "planner", "planning_complete",
                   f"Plan drafted: status={plan.get('status')}, latency={latency}ms",
                   latency_ms=latency)

        # Check if approval is needed for high-risk tasks
        if plan.get("risk_level") in ("high", "critical") and self.approval_required:
            plan["status"] = "pending_approval"
            approval_action = f"approve_plan_{task['id']}"
            if not check_approval(approval_action, task_id=task["id"]):
                request_approval(
                    action=approval_action,
                    description=f"Approve plan for task #{task['id']}: {task['title']}",
                    task_id=task["id"],
                    risk=plan.get("risk_level", "high"),
                )
            else:
                plan["status"] = "approved"
            log_action(get_conn(), self.session_id, "reviewer", "approval_requested",
                       f"Approval required for high-risk plan on task #{task['id']}",
                       output=f"action={approval_action}")
        elif plan.get("risk_level") in ("low", "medium", None):
            plan["status"] = "auto_approved"

        return plan

    def _phase_execute(self, task: dict, plan: dict) -> dict:
        """Phase 2: Execute the approved plan.

        Args:
            task: Task dict from the database.
            plan: Approved plan dict.

        Returns:
            Execution result dict.
        """
        log_action(get_conn(), self.session_id, "executor", "execution_start",
                   f"Executing plan for task #{task['id']}")

        start_time = time.time()

        result = execute_plan(
            plan=plan,
            work_dir=WORK_DIR,
            max_steps=50,
        )

        latency = int((time.time() - start_time) * 1000)
        log_action(get_conn(), self.session_id, "executor", "execution_complete",
                   f"Execution result: status={result.get('status')}, latency={latency}ms",
                   latency_ms=latency,
                   output=json.dumps(result, default=str))

        return result

    def _phase_verify(self, task: dict, result: dict) -> dict:
        """Phase 3: Verify the execution results.

        Args:
            task: Task dict from the database.
            result: Execution result dict.

        Returns:
            Verification report dict.
        """
        log_action(get_conn(), self.session_id, "verifier", "verification_start",
                   f"Verifying results for task #{task['id']}")

        start_time = time.time()

        report = verify_changes(
            work_dir=WORK_DIR,
            executor_result=result,
            model_endpoint=self.model_endpoint,
        )

        latency = int((time.time() - start_time) * 1000)
        log_action(get_conn(), self.session_id, "verifier", "verification_complete",
                   f"Verification result: status={report.get('status')}, latency={latency}ms",
                   latency_ms=latency,
                   output=json.dumps(report, default=str))

        return report

    def get_status(self, task_id: int) -> dict:
        """Get the current status of a task execution.

        Args:
            task_id: The task ID to check.

        Returns:
            Task status dict.
        """
        conn = get_conn()
        task = get_task(conn, task_id)
        logs = get_conn().execute(
            "SELECT * FROM logs WHERE session_id LIKE ? ORDER BY id DESC LIMIT 10",
            (f"%{task_id}%",)
        ).fetchall()
        conn.close()

        return {
            "task": dict(task) if task else None,
            "recent_logs": [dict(log_entry) for log_entry in logs],
        }


def run_task(task_id: int, model_endpoint: str = None, max_retries: int = 3) -> dict:
    """Run a single task through the full pipeline.

    Convenience function that creates an Orchestrator and runs a task.

    Args:
        task_id: Task ID to execute.
        model_endpoint: LLM API endpoint.
        max_retries: Maximum retry attempts.

    Returns:
        Result dict with task status, plan, execution result, and verification.
    """
    orchestrator = Orchestrator(
        model_endpoint=model_endpoint,
        max_retries=max_retries,
    )
    return orchestrator.run(task_id)
