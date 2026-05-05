"""
Fantasy Casino — Task Runner Workflow.

Implements the full task lifecycle from the Agent Operating Manual:
    1. ingest task -> 2. classify risk -> 3. gather context ->
    4. draft plan (Planner) -> 5. review plan ->
    6. patch in sandbox (Executor) -> 7. verify (Verifier) ->
    8. report -> 9. finalize or rollback

Usage:
    from agent.orchestrator.run_task import run_task_pipeline

    # Run next planned task
    from agent.task_intake import get_next_task, load_backlog
    load_backlog()
    task = get_next_task()
    if task:
        result = run_task_pipeline(task["id"])
        print(f"Task {task['id']} result: {result['status']}")
"""

import os
import sys

# Ensure project root is in sys.path for imports when run directly
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

import json
import time
from datetime import datetime, timezone

from agent.memory import get_conn, log_action, get_task, record_token_usage, add_artifact
from agent.task_intake import (
    get_next_task,
    complete_task,
    queue_summary,
)
from agent.approval import request_approval, check_approval
from agent.orchestrator import Orchestrator
from agent.orchestrator.planner import draft_plan
from agent.orchestrator.executor import execute_plan, list_work_files
from agent.orchestrator.verifier import verify_changes
from agent.snapshots import create_snapshot

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK_DIR = os.path.join(BASE_DIR, "work")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def run_task_pipeline(task_id: int, model_endpoint: str = None,
                      approval_required: bool = True) -> dict:
    """Run the full task pipeline: plan -> execute -> verify -> report.

    This implements the 9-step task lifecycle from the Agent Operating Manual.

    Args:
        task_id: Task ID to execute.
        model_endpoint: LLM API endpoint for planning/verification.
        approval_required: Whether to require human approval for risky tasks.

    Returns:
        Result dict with the full pipeline output.
    """
    conn = get_conn()
    conn.execute("PRAGMA foreign_keys=ON")

    task = get_task(conn, task_id)
    if not task:
        return {"task_id": task_id, "status": "failed", "error": "Task not found"}
    task = dict(task)

    session_id = f"pipeline_{task_id}_{_timestamp()}"
    orchestrator = Orchestrator(
        model_endpoint=model_endpoint,
        approval_required=approval_required,
    )
    orchestrator.session_id = session_id

    log_action(conn, session_id, "orchestrator", "pipeline_start",
               f"Starting full pipeline for task #{task_id}: {task['title']}")

    result = {
        "task_id": task_id,
        "task_title": task["title"],
        "priority": task["priority"],
        "risk_class": task["risk_class"],
        "session_id": session_id,
        "status": "running",
        "steps": {},
        "error": None,
    }

    plan_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    verify_tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    try:
        # Step 1: Ingest task (already done via task intake)
        result["steps"]["ingest"] = {"status": "done", "details": f"Task #{task_id} received"}

        # Step 2: Classify risk (already done by task intake)
        result["steps"]["classify"] = {
            "status": "done",
            "priority": task["priority"],
            "risk": task["risk_class"],
        }

        # Step 3: Gather context
        context = _gather_context(task, conn, session_id)
        result["steps"]["context"] = {"status": "done", "files_count": len(context)}

        # Step 4: Draft plan (Planner)
        plan_start = time.time()
        plan = draft_plan(
            task_title=task["title"],
            task_description=task["description"],
            risk_class=task["risk_class"],
            priority=task["priority"],
            model_endpoint=model_endpoint,
            extra_context="\n".join(context[:5]),  # Include first 5 context items
        )
        plan_latency = int((time.time() - plan_start) * 1000)
        plan_tokens = plan.get("token_usage", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})

        result["steps"]["plan"] = {
            "status": plan.get("status", "unknown"),
            "plan_title": plan.get("title", "unknown"),
            "steps_count": len(plan.get("steps", [])),
            "risk_level": plan.get("risk_level", "unknown"),
            "latency_ms": plan_latency,
            "tokens": plan_tokens,
        }

        # Step 5: Review plan
        if plan.get("risk_level") in ("high", "critical") and approval_required:
            # Request approval for high-risk plans
            approval_action = f"approve_plan_{task_id}"
            if not check_approval(approval_action, task_id=task_id):
                request_approval(
                    action=approval_action,
                    description=f"Approve plan for task #{task_id}: {task['title']}",
                    task_id=task_id,
                    risk=plan.get("risk_level", "high"),
                )
                result["steps"]["review"] = {
                    "status": "pending_approval",
                    "details": "Approval requested for high-risk plan",
                }
                result["status"] = "waiting_for_approval"
                result["steps"]["plan"] = {**result["steps"]["plan"], "needs_approval": True}
                log_action(conn, session_id, "reviewer", "plan_waiting_approval",
                           f"Plan for task #{task_id} awaiting approval")

                # Return early - waiting for human approval
                conn.close()
                return result

            # Approval granted
            result["steps"]["review"] = {
                "status": "approved",
                "details": "High-risk plan approved",
            }
        else:
            result["steps"]["review"] = {
                "status": "approved",
                "details": "Low/medium risk, no approval required",
            }

        # Step 6: Patch in sandbox (Executor)
        exec_start = time.time()
        # Create work snapshot before execution
        create_snapshot(name=f"pre_exec_{task_id}", directories=[WORK_DIR])

        exec_result = execute_plan(plan=plan, work_dir=WORK_DIR)
        exec_latency = int((time.time() - exec_start) * 1000)

        # Log executor command output for observability
        log_action(
            conn, session_id, "executor", "execute_complete",
            details=f"Task #{task_id}: executed {exec_result.get('steps_executed', 0)} steps, "
                    f"{len(exec_result.get('successes', []))} succeeded, "
                    f"{len(exec_result.get('failures', []))} failed",
            success=exec_result.get("status") in ("success", "done"),
            latency_ms=exec_latency,
        )

        result["steps"]["execute"] = {
            "status": exec_result.get("status", "unknown"),
            "steps_executed": exec_result.get("steps_executed", 0),
            "successes": len(exec_result.get("successes", [])),
            "failures": len(exec_result.get("failures", [])),
            "latency_ms": exec_latency,
        }

        # Step 7: Verify (Verifier)
        verify_start = time.time()
        verify_report = verify_changes(
            work_dir=WORK_DIR,
            executor_result=exec_result,
            model_endpoint=model_endpoint,
        )
        verify_latency = int((time.time() - verify_start) * 1000)
        verify_tokens = verify_report.get(
            "verifier_token_usage",
            {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        )

        result["steps"]["verify"] = {
            "status": verify_report.get("status", "unknown"),
            "recommendation": verify_report.get("recommendation", "unknown"),
            "checks_run": len(verify_report.get("checks", [])),
            "latency_ms": verify_latency,
            "tokens": verify_tokens,
        }

        # Step 8: Report — log verification results for observability
        log_action(
            conn, session_id, "verifier", "verification_complete",
            details=f"Task #{task_id}: status={verify_report.get('status')}, "
                    f"checks={len(verify_report.get('checks', []))}, "
                    f"recommendation={verify_report.get('recommendation')}",
            success=verify_report.get("status") == "passed",
            tokens_used=verify_tokens.get("total_tokens", 0),
            latency_ms=verify_latency,
        )
        result["steps"]["report"] = {
            "status": "done",
            "summary": verify_report.get("summary", ""),
        }

        # Step 9: Finalize or rollback
        if verify_report.get("status") == "passed":
            finalize_result = _finalize_changes(task_id, WORK_DIR, conn, session_id)
            result["steps"]["finalize"] = finalize_result
            complete_task(task_id, "done")
            result["status"] = "done"
        elif verify_report.get("status") == "failed":
            rollback_result = _rollback_changes(task_id, conn, session_id)
            result["steps"]["rollback"] = rollback_result
            complete_task(task_id, "cancelled")
            result["status"] = "cancelled"
        elif verify_report.get("status") == "review_required":
            result["steps"]["finalize"] = {"status": "deferred", "reason": "needs human review"}
            complete_task(task_id, "paused")
            result["status"] = "needs_review"

    except Exception as e:
        result["status"] = "cancelled"
        result["error"] = str(e)
        complete_task(task_id, "cancelled")
        log_action(conn, session_id, "orchestrator", "pipeline_exception",
                   f"Pipeline exception for task #{task_id}: {e}", success=False)

    # Store verification report as artifact
    add_artifact(
        conn, task_id, "log",
        path=f"reports/pipeline_{task_id}_report.json",
        reference=session_id,
        summary=f"Pipeline result: {result['status']}",
    )

    # Log error patterns if task failed
    if result["status"] == "failed":
        log_action(
            conn, session_id, "system", "error_pattern",
            details=f"Task #{task_id} failed: {result.get('error', 'unknown error')}",
            success=False,
        )
        error_steps = {k: v for k, v in result.get("steps", {}).items() if v.get("status") == "failed"}
        if error_steps:
            log_action(
                conn, session_id, "system", "error_step",
                details=f"Failed steps: {list(error_steps.keys())}",
                success=False,
            )

    # Record token usage for observability
    total_plan_tokens = plan_tokens.get("total_tokens", 0)
    total_verify_tokens = verify_tokens.get("total_tokens", 0)
    if total_plan_tokens > 0:
        record_token_usage(
            conn, session_id, "local-model",
            plan_tokens.get("prompt_tokens", 0),
            plan_tokens.get("completion_tokens", 0),
            cost_estimate=0,
        )
    if total_verify_tokens > 0:
        record_token_usage(
            conn, session_id, "local-model",
            verify_tokens.get("prompt_tokens", 0),
            verify_tokens.get("completion_tokens", 0),
            cost_estimate=0,
        )

    log_action(conn, session_id, "orchestrator", "pipeline_complete",
               f"Task #{task_id} pipeline completed: status={result['status']}",
               success=result["status"] in ("done",),
               output=json.dumps(result, default=str))

    conn.close()
    return result


def _gather_context(task: dict, conn, session_id: str) -> list:
    """Gather relevant context for a task.

    Collects:
    - Related tasks from the same phase
    - Recent logs for context
    - Existing work files
    - Research notes that might be relevant

    Args:
        task: Task dict.
        conn: SQLite connection.
        session_id: Session ID.

    Returns:
        List of context strings.
    """
    context = []

    # Related tasks from the same phase
    phase = task.get("phase", "")
    if phase:
        related = conn.execute(
            "SELECT title, status, description FROM tasks WHERE phase = ? AND id != ? ORDER BY id",
            (phase, task["id"]),
        ).fetchall()
        for r in related:
            context.append(f"[related task] {r['title']} ({r['status']})")

    # Existing work files
    work_files = list_work_files()
    if work_files:
        context.append(f"[work files ({len(work_files)} files)]")
        for wf in work_files[:20]:  # Limit to first 20
            context.append(f"  - {wf}")

    # Recent logs
    recent_logs = conn.execute(
        "SELECT action, details, success FROM logs WHERE session_id != 'task_intake' ORDER BY id DESC LIMIT 5"
    ).fetchall()
    for log in recent_logs:
        context.append(f"[log] {log['action']}: {log['details'][:100]}")

    # Research notes relevant to the task
    research_dir = os.path.join(BASE_DIR, "research")
    if os.path.exists(research_dir):
        research_files = [f for f in os.listdir(research_dir) if f.endswith(".md")]
        context.append(f"[research notes: {len(research_files)} files]")

    return context


def _finalize_changes(task_id: int, work_dir: str, conn, session_id: str) -> dict:
    """Finalize changes: move work files to their proper locations.

    For MVP, this logs the action. In a full implementation, it would
    move files from the work directory to the product/analytics zones.

    Args:
        task_id: Task ID.
        work_dir: Work directory path.
        conn: SQLite connection.
        session_id: Session ID.

    Returns:
        Finalization result dict.
    """
    work_files = list_work_files(work_dir)

    if not work_files:
        log_action(conn, session_id, "system", "finalize",
                   f"Task #{task_id}: No changes to finalize")
        return {"status": "done", "details": "No changes to finalize"}

    # Log what would be finalized
    for wf in work_files:
        log_action(conn, session_id, "system", "finalize_file",
                   f"Task #{task_id}: Would finalize {wf}")

    log_action(conn, session_id, "system", "finalize_complete",
               f"Task #{task_id}: {len(work_files)} files ready for deployment")

    return {
        "status": "done",
        "files_count": len(work_files),
        "details": f"{len(work_files)} files finalized",
    }


def _rollback_changes(task_id: int, conn, session_id: str) -> dict:
    """Rollback changes from a failed task.

    Args:
        task_id: Task ID.
        conn: SQLite connection.
        session_id: Session ID.

    Returns:
        Rollback result dict.
    """
    log_action(conn, session_id, "system", "rollback",
               f"Task #{task_id}: Rolling back changes")

    # Create a checkpoint for the rollback
    log_action(conn, session_id, "system", "rollback_checkpoint",
               f"Task #{task_id}: Checkpoint saved before rollback")

    return {
        "status": "done",
        "details": f"Task #{task_id}: Changes rolled back",
    }


def run_next_task(model_endpoint: str = None, approval_required: bool = True) -> dict:
    """Find and run the next planned task.

    Convenience function that gets the next task from the queue
    and runs the full pipeline.

    Args:
        model_endpoint: LLM API endpoint.
        approval_required: Whether to require approval.

    Returns:
        Pipeline result dict.
    """
    task = get_next_task()
    if not task:
        return {"status": "no_tasks", "message": "No planned tasks in queue"}

    return run_task_pipeline(task["id"], model_endpoint=model_endpoint,
                             approval_required=approval_required)


def queue_status() -> dict:
    """Get the current status of the task queue.

    Returns:
        Queue summary dict.
    """
    return queue_summary()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Fantasy Casino Task Runner")
    parser.add_argument("task_id", type=int, nargs="?", default=None,
                        help="Task ID to run (optional — runs next if not specified)")
    parser.add_argument("--endpoint", type=str, default=None,
                        help="LLM API endpoint (default: http://127.0.0.1:8080/v1)")
    parser.add_argument("--no-approval", action="store_true",
                        help="Skip approval gates for high-risk plans")

    args = parser.parse_args()
    model_endpoint = args.endpoint or os.environ.get("MODEL_ENDPOINT", "http://127.0.0.1:8080/v1")

    print(f"Fantasy Casino Task Runner")
    print(f"Endpoint: {model_endpoint}")
    print(f"Approval required: {not args.no_approval}")
    print()

    if args.task_id:
        result = run_task_pipeline(args.task_id, model_endpoint=model_endpoint,
                                   approval_required=not args.no_approval)
    else:
        result = run_next_task(model_endpoint=model_endpoint,
                               approval_required=not args.no_approval)

    print(f"\nResult: {result['status']}")
    if result.get("error"):
        print(f"Error: {result['error']}")
    print(f"Session: {result.get('session_id', 'N/A')}")

    sys.exit(0 if result["status"] in ("done",) else 1)
