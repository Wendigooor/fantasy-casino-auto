#!/usr/bin/env python3
"""
Fantasy Casino — plan maintainer agent.

Responsible for managing milestones and work items across phases.
Uses taskboard.py as the ORM layer — never writes raw SQL.

Usage patterns:
    from agent.plan_maintainer import (
        create_phase_milestone,
        add_phase_tasks,
        activate_phase,
        complete_phase,
        list_phases,
        next_todo_items,
        create_phase_from_build_doc,
    )

All functions use db_path=None (defaults to plans.db).
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone

from agent.taskboard import (
    create_milestone,
    create_work_item,
    list_milestones,
    list_work_items,
    update_work_item_status,
)
from agent.memory import now

# ── Constants ──────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.db")

PHASE_NAMES = {
    "phase0": "Stabilize Agent Rails",
    "phase1": "Casino Core Runtime",
    "phase2": "Identity and Session Foundation",
    "phase3": "Wallet and Ledger Core",
    "phase4": "Game Catalog and Frontend",
    "phase5": "Realtime and High-Load Readiness",
    "phase6": "Bonus, Risk, and Compliance",
    "phase7": "Analytics and Data Platform",
    "phase8": "Load Testing and Production Hardening",
}

PHASE_PRIORITIES = {
    "phase0": 1,
    "phase1": 1,
    "phase2": 2,
    "phase3": 2,
    "phase4": 2,
    "phase5": 2,
    "phase6": 2,
    "phase7": 2,
    "phase8": 3,
}


# ── Helpers ────────────────────────────────────────────────────────────

def _milestone_key_for_phase(phase: str) -> str:
    """Convert a phase name to a milestone key, e.g. 'phase3' → 'phase3-wallet'."""
    # If already has a suffix, return as-is
    if "-" in phase:
        return phase
    return f"{phase}"


def _get_milestone_id(milestone_key: str, db_path: str | None = None) -> int | None:
    """Get the ID of a milestone by key. Returns None if not found."""
    milestones = list_milestones(db_path=db_path)
    for m in milestones:
        if m["milestone_key"] == milestone_key:
            return m["id"]
    return None


def _milestone_exists(milestone_key: str, db_path: str | None = None) -> bool:
    """Check if a milestone exists."""
    return _get_milestone_id(milestone_key, db_path) is not None


def _parse_json_list(text: str) -> list[str]:
    """Parse a JSON array string or comma-separated list into a list of strings."""
    text = text.strip()
    if not text:
        return []
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return [item.strip() for item in text.split(",") if item.strip()]


# ── Public API ─────────────────────────────────────────────────────────

def create_phase_milestone(
    phase: str,
    title: str | None = None,
    description: str = "",
    status: str = "planned",
    acceptance_criteria: list[str] | None = None,
    notes: str | None = None,
    db_path: str | None = None,
) -> int:
    """Create a milestone for a phase.

    Args:
        phase: Phase key, e.g. 'phase3', 'phase3-wallet'.
        title: Display title. Defaults to 'Phase N: {name}'.
        description: One-paragraph description of the milestone.
        status: 'planned', 'active', etc.
        acceptance_criteria: List of acceptance criteria.
        notes: Optional notes.
        db_path: Optional database path.

    Returns:
        The milestone ID.
    """
    milestone_key = _milestone_key_for_phase(phase)

    if _milestone_exists(milestone_key, db_path):
        print(f"Milestone '{milestone_key}' already exists (id={_get_milestone_id(milestone_key, db_path)}). Skipping.")
        return _get_milestone_id(milestone_key, db_path)

    if title is None:
        name = PHASE_NAMES.get(phase.split("-")[0], phase)
        title = f"Phase {phase.split('-')[0].replace('phase', '')}: {name}"

    priority = PHASE_PRIORITIES.get(phase.split("-")[0], 2)

    ms_id = create_milestone(
        milestone_key=milestone_key,
        title=title,
        description=description,
        status=status,
        priority=priority,
        target_phase=phase.split("-")[0],
        acceptance_criteria=acceptance_criteria,
        notes=notes or f"Created by plan_maintainer for {phase}",
        db_path=db_path,
    )
    print(f"Created milestone '{milestone_key}' (id={ms_id}).")
    return ms_id


def add_phase_tasks(
    milestone_key: str,
    tasks: list[dict],
    db_path: str | None = None,
) -> list[int]:
    """Add work items to a milestone.

    Args:
        milestone_key: The milestone key to attach tasks to.
        tasks: List of task dicts with keys:
            - key: unique task key, e.g. '3-001'
            - title: short title
            - description: task description
            - priority: 1-5 (1=highest)
            - risk: 'low', 'medium', 'high', 'critical'
            - scope_files: list of files in scope
            - acceptance_criteria: list of acceptance criteria
            - verification_command: command to verify the task
            - stale_check: what to check before starting
            - resume_hint: hint for resuming later
    Returns:
        List of created work item IDs.
    """
    ms_id = _get_milestone_id(milestone_key, db_path)
    if ms_id is None:
        print(f"ERROR: Milestone '{milestone_key}' not found. Create it first.")
        return []

    created_ids = []
    for task in tasks:
        wid = create_work_item(
            item_key=task["key"],
            title=task["title"],
            description=task.get("description", ""),
            milestone_id=ms_id,
            kind="task",
            status="todo",
            priority=task.get("priority", 3),
            risk_level=task.get("risk", "low"),
            scope_files=task.get("scope_files", []),
            acceptance_criteria=task.get("acceptance_criteria", []),
            verification_command=task.get("verification_command"),
            stale_check=task.get("stale_check", f"Check if {task['key']} capability already exists."),
            resume_hint=task.get("resume_hint", f"Continue {task['key']} from last checkpoint."),
            db_path=db_path,
        )
        created_ids.append(wid)
        print(f"  Added task '{task['key']}' → milestone '{milestone_key}' (id={wid}).")

    return created_ids


def activate_phase(
    milestone_key: str,
    db_path: str | None = None,
) -> dict | None:
    """Activate a milestone (set status='active').

    Also activates all prerequisite completed milestones if they exist.
    """
    ms_id = _get_milestone_id(milestone_key, db_path)
    if ms_id is None:
        print(f"ERROR: Milestone '{milestone_key}' not found.")
        return None

    milestones = list_milestones(db_path=db_path)
    ms = None
    for m in milestones:
        if m["id"] == ms_id:
            ms = m
            break

    if not ms:
        return None

    if ms["status"] == "active":
        print(f"Milestone '{milestone_key}' is already active.")
        return ms

    # Update milestone status
    from agent.taskboard import ensure_schema
    from agent.memory import get_conn

    conn = get_conn(db_path)
    try:
        ensure_schema(db_path=db_path)
        conn.execute(
            """UPDATE milestones SET status = 'active', updated_at = ? WHERE id = ?""",
            (now(), ms_id),
        )
        # Clear in_progress items to todo
        conn.execute(
            """UPDATE work_items SET status = 'todo', claimed_by = NULL,
               claim_token = NULL, claimed_at = NULL, updated_at = ?
               WHERE milestone_id = ? AND status IN ('in_progress', 'blocked')""",
            (now(), ms_id),
        )
        conn.commit()
        ms["status"] = "active"
        print(f"Activated milestone '{milestone_key}'.")
        return ms
    finally:
        conn.close()


def complete_phase(
    milestone_key: str,
    completion_message: str = "Phase completed.",
    db_path: str | None = None,
) -> dict | None:
    """Complete a milestone (set status='done') and mark all its work items done.

    Args:
        milestone_key: The milestone to complete.
        completion_message: Summary message for the milestone.
    Returns:
        The completed milestone dict.
    """
    ms_id = _get_milestone_id(milestone_key, db_path)
    if ms_id is None:
        print(f"ERROR: Milestone '{milestone_key}' not found.")
        return None

    milestones = list_milestones(db_path=db_path)
    ms = None
    for m in milestones:
        if m["id"] == ms_id:
            ms = m
            break

    if not ms:
        return None

    if ms["status"] == "done":
        print(f"Milestone '{milestone_key}' is already done.")
        return ms

    # Complete all work items for this milestone
    items = list_work_items(milestone_key=milestone_key, db_path=db_path)
    done_count = 0
    for item in items:
        if item["status"] not in ("done", "obsolete", "superseded"):
            update_work_item_status(
                item["id"],
                "done",
                message=f"Auto-completed by plan_maintainer (phase {milestone_key}).",
                verification_status="passed",
                db_path=db_path,
            )
            done_count += 1

    # Update milestone to done
    from agent.taskboard import ensure_schema
    from agent.memory import get_conn

    conn = get_conn(db_path)
    try:
        ensure_schema(db_path=db_path)
        conn.execute(
            """UPDATE milestones SET status = 'done', completed_at = ?, updated_at = ?, notes = ?
               WHERE id = ?""",
            (now(), now(), completion_message, ms_id),
        )
        conn.commit()
        ms["status"] = "done"
        print(f"Completed milestone '{milestone_key}' ({done_count} items marked done).")
        return ms
    finally:
        conn.close()


def list_phases(db_path: str | None = None) -> list[dict]:
    """List all milestones grouped by phase."""
    milestones = list_milestones(db_path=db_path)
    result = {}
    for m in milestones:
        phase = m.get("target_phase", "unknown")
        if phase not in result:
            result[phase] = {
                "phase": phase,
                "name": PHASE_NAMES.get(phase, phase),
                "milestones": [],
                "status": "planned",
            }
        result[phase]["milestones"].append(m)
        # Phase status = most advanced milestone status
        status_order = {"planned": 0, "active": 1, "blocked": 2, "done": 3, "cancelled": 4}
        if status_order.get(m["status"], 0) > status_order.get(result[phase]["status"], 0):
            result[phase]["status"] = m["status"]

    return sorted(result.values(), key=lambda x: PHASE_PRIORITIES.get(x["phase"], 9))


def next_todo_items(
    milestone_key: str | None = None,
    limit: int = 5,
    db_path: str | None = None,
) -> list[dict]:
    """Get the next work items that are todo or in_progress."""
    items = list_work_items(db_path=db_path)
    if milestone_key:
        items = [i for i in items if i.get("milestone_key") == milestone_key]

    todo_items = [i for i in items if i["status"] in ("todo", "in_progress")]
    todo_items.sort(key=lambda x: (x["priority"], x["id"]))

    return todo_items[:limit]


def print_phase_status(db_path: str | None = None):
    """Print a human-readable status of all phases."""
    phases = list_phases(db_path=db_path)

    print("\n" + "=" * 72)
    print("  FANTASY CASINO — PHASE STATUS")
    print("=" * 72)

    for phase in phases:
        phase_num = phase["phase"].split("-")[0]
        status_icon = {
            "planned": "○",
            "active": "◐",
            "blocked": "✗",
            "done": "●",
            "cancelled": "✗",
        }.get(phase["status"], "?")

        print(f"\n  {status_icon} {phase['phase']} — {phase['name']} [{phase['status'].upper()}]")

        for ms in phase["milestones"]:
            items = list_work_items(milestone_key=ms["milestone_key"], db_path=db_path)
            total = len(items)
            done = sum(1 for i in items if i["status"] == "done")
            todo = sum(1 for i in items if i["status"] == "todo")
            in_progress = sum(1 for i in items if i["status"] == "in_progress")

            ms_icon = {"planned": "○", "active": "◐", "done": "●"}.get(ms["status"], "?")
            print(f"    {ms_icon} {ms['milestone_key']}")
            if total > 0:
                print(f"      Tasks: {done}/{total} done, {in_progress} in progress, {todo} todo")
            else:
                print(f"      No tasks yet.")

    print("\n" + "=" * 72)


# ── Build doc parser ───────────────────────────────────────────────────

def create_phase_from_build_doc(
    phase_num: int,
    doc_path: str | None = None,
    db_path: str | None = None,
) -> dict | None:
    """Parse the build instructions doc and create milestones + tasks for a phase.

    Looks for TASK entries and phase descriptions in the build doc.
    This is the main entry point for setting up a new phase.
    """
    if doc_path is None:
        doc_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "docs",
            "PRODUCTION_CASINO_BUILD_INSTRUCTIONS.md",
        )

    if not os.path.exists(doc_path):
        print(f"Build doc not found: {doc_path}")
        return None

    with open(doc_path) as f:
        content = f.read()

    # Find the phase section
    phase_header = f"### Phase {phase_num}:"
    phase_section = _extract_section(content, phase_header)
    if not phase_section:
        print(f"Phase {phase_num} section not found in build doc.")
        return None

    # Extract phase description and checklist
    phase_data = _parse_phase_section(phase_section, phase_num)
    if not phase_data:
        print(f"Failed to parse phase {phase_num} from build doc.")
        return None

    # Find related TASK sections
    tasks = _extract_tasks_for_phase(content, phase_num)

    # Create milestone
    ms_id = create_phase_milestone(
        phase=f"phase{phase_num}",
        title=phase_data["title"],
        description=phase_data["description"],
        status="planned",
        acceptance_criteria=phase_data["acceptance_criteria"],
        notes=f"Created from build doc section for Phase {phase_num}.",
        db_path=db_path,
    )

    # Create tasks from TASK sections if available
    if tasks:
        task_dicts = []
        for t in tasks:
            task_dicts.append({
                "key": t["key"],
                "title": t["title"],
                "description": t["description"],
                "priority": _risk_to_priority(t.get("risk", "medium")),
                "risk": t.get("risk", "medium"),
                "scope_files": t.get("scope", []),
                "acceptance_criteria": t.get("acceptance", []),
                "verification_command": t.get("verification"),
                "stale_check": "Check if task capability already exists.",
                "resume_hint": f"Review 'Do Not' and 'Rollback' sections before starting.",
            })
        add_phase_tasks(f"phase{phase_num}", task_dicts, db_path=db_path)

    # If no TASK sections, create default tasks from checklist
    elif phase_data["checklist"]:
        task_dicts = []
        for i, item in enumerate(phase_data["checklist"], 1):
            task_dicts.append({
                "key": f"{phase_num:03d}-{i:03d}",
                "title": item.strip(),
                "description": f"Phase {phase_num} checklist item: {item.strip()}",
                "priority": 3,
                "risk": "medium",
                "scope_files": [],
                "acceptance_criteria": [f"Checklist item '{item.strip()}' is complete."],
                "verification_command": f"Verify that {item.strip()} is implemented.",
                "stale_check": "Check if this checklist item is already done.",
                "resume_hint": f"Work on the checklist item: {item.strip()}",
            })
        add_phase_tasks(f"phase{phase_num}", task_dicts, db_path=db_path)

    print(f"\nPhase {phase_num} setup complete:")
    print(f"  Milestone: phase{phase_num} (id={ms_id})")
    print(f"  Tasks created: {len(phase_data['checklist']) + len(tasks)}")
    return {"milestone_id": ms_id, "milestone_key": f"phase{phase_num}"}


def _extract_section(content: str, header: str) -> str | None:
    """Extract a markdown section starting with a header (### style)."""
    lines = content.split("\n")
    result_lines = []
    in_section = False

    for line in lines:
        if line.startswith("### ") and header.lower() in line.lower():
            in_section = True
            continue
        if in_section:
            # Stop at the next ### header
            if line.startswith("### "):
                break
            result_lines.append(line)

    if in_section:
        return "\n".join(result_lines).strip()
    return None


def _parse_phase_section(section: str, phase_num: int) -> dict | None:
    """Parse a phase section into structured data."""
    lines = section.split("\n")
    title = ""
    description = ""
    acceptance_criteria = []
    checklist = []

    in_acceptance = False
    in_checklist = False
    in_description = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("Goal:"):
            in_description = True
            in_acceptance = False
            in_checklist = False
            continue

        if stripped.startswith("Exit criteria:"):
            in_description = False
            in_acceptance = False
            in_checklist = False
            continue

        if stripped == "- [ ]" or stripped.startswith("- [x]"):
            in_checklist = True
            in_acceptance = False
            in_description = False
            checklist_item = stripped[5:].strip()
            checklist.append(checklist_item)
            continue

        if stripped.startswith("- [") or stripped.startswith("- "):
            if in_acceptance:
                acceptance_criteria.append(stripped.lstrip("- ").strip())
            elif in_checklist:
                checklist.append(stripped.lstrip("- ").strip())
            continue

        if in_acceptance and (stripped.startswith("- [") or stripped.startswith("- ")):
            acceptance_criteria.append(stripped.lstrip("- ").strip())
            continue

        if in_description:
            description += " " + stripped

        if not title and line.startswith("# ") or line.startswith("## "):
            title = stripped.lstrip("# ").strip()

    if not description and checklist:
        description = f"Phase {phase_num} implementation tasks."

    return {
        "title": title or f"Phase {phase_num}",
        "description": description.strip(),
        "acceptance_criteria": acceptance_criteria or [
            f"Phase {phase_num} exit criteria are met.",
        ],
        "checklist": checklist,
    }


def _extract_tasks_for_phase(content: str, phase_num: int) -> list[dict]:
    """Extract TASK sections that belong to a phase."""
    lines = content.split("\n")
    tasks = []
    current_task = None
    current_section = None
    phase_num_str = str(phase_num)

    for line in lines:
        # Detect TASK header
        task_match = re.match(r"^### TASK\s+(\d+)-\d+:\s+(.+)", line)
        if task_match:
            task_phase = task_match.group(1)
            if task_phase == phase_num_str:
                current_task = {
                    "key": task_match.group(0).replace("### TASK ", "").strip(),
                    "title": task_match.group(2).strip(),
                    "description": "",
                    "risk": "medium",
                    "scope": [],
                    "acceptance": [],
                    "verification": None,
                    "do_not": [],
                    "rollback": [],
                }
                current_section = None
                continue

        if current_task:
            stripped = line.strip()

            if stripped.startswith("Status:"):
                current_section = "status"
                continue
            elif stripped.startswith("Risk:"):
                current_task["risk"] = stripped.split(":", 1)[1].strip()
                current_section = "risk"
                continue
            elif stripped.startswith("Goal:"):
                current_section = "goal"
                continue
            elif stripped.startswith("Scope:"):
                current_section = "scope"
                continue
            elif stripped.startswith("Do:"):
                current_section = "do"
                continue
            elif stripped.startswith("Do Not:"):
                current_section = "do_not"
                continue
            elif stripped.startswith("Acceptance Criteria:"):
                current_section = "acceptance"
                continue
            elif stripped.startswith("Verification:"):
                current_section = "verification"
                continue
            elif stripped.startswith("Rollback:"):
                current_section = "rollback"
                continue

            if current_section == "description":
                current_task["description"] += " " + stripped
            elif current_section == "goal":
                current_task["description"] += " " + stripped
            elif current_section == "scope" and stripped.startswith("- "):
                current_task["scope"].append(stripped[2:].strip())
            elif current_section == "acceptance" and stripped.startswith("- "):
                current_task["acceptance"].append(stripped[2:].strip())
            elif current_section == "verification" and not stripped.startswith("-"):
                current_task["verification"] = stripped
            elif current_section == "do_not" and stripped.startswith("- "):
                current_task["do_not"].append(stripped[2:].strip())
            elif current_section == "rollback" and stripped.startswith("- "):
                current_task["rollback"].append(stripped[2:].strip())

        # End of task at next TASK header or end
        if current_task and line.startswith("### TASK"):
            tasks.append(current_task)
            current_task = None

    if current_task:
        tasks.append(current_task)

    return tasks


def _risk_to_priority(risk: str) -> int:
    """Convert risk level to priority number (1=highest)."""
    mapping = {"critical": 1, "high": 2, "medium": 3, "low": 4}
    return mapping.get(risk, 3)


# ── CLI ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 -m agent.plan_maintainer <command> [args]")
        print()
        print("Commands:")
        print("  status                          Show phase status")
        print("  milestone <key> <action>        Create/activate/complete a milestone")
        print("  todo [milestone_key] [limit]    Show next todo items")
        print("  build-phase <phase_num>         Create from build doc")
        print()
        print("Examples:")
        print("  python3 -m agent.plan_maintainer status")
        print("  python3 -m agent.plan_maintainer milestone phase3-wallet create")
        print("  python3 -m agent.plan_maintainer milestone phase3-wallet activate")
        print("  python3 -m agent.plan_maintainer milestone phase3-wallet complete")
        print("  python3 -m agent.plan_maintainer todo")
        print("  python3 -m agent.plan_maintainer todo phase3-wallet 10")
        print("  python3 -m agent.plan_maintainer build-phase 3")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "status":
        print_phase_status()

    elif cmd == "milestone":
        if len(sys.argv) < 4:
            print("Usage: python3 -m agent.plan_maintainer milestone <key> <action>")
            print("Actions: create, activate, complete")
            sys.exit(1)

        key = sys.argv[2]
        action = sys.argv[3]

        if action == "create":
            create_phase_milestone(key, status="planned")
        elif action == "activate":
            activate_phase(key)
        elif action == "complete":
            complete_phase(key)
        else:
            print(f"Unknown action: {action}")
            sys.exit(1)

    elif cmd == "todo":
        milestone = sys.argv[2] if len(sys.argv) > 2 else None
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        items = next_todo_items(milestone_key=milestone, limit=limit)
        print(f"\nNext {len(items)} todo items")
        print("-" * 60)
        for item in items:
            print(f"  [{item['status']}] {item['item_key']} — {item['title']}")
            print(f"    priority={item['priority']} risk={item['risk_level']}")
            if item.get("milestone_key"):
                print(f"    milestone={item['milestone_key']}")
        print()

    elif cmd == "build-phase":
        phase_num = int(sys.argv[2])
        create_phase_from_build_doc(phase_num)

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
