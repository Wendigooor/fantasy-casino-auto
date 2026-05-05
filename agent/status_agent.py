#!/usr/bin/env python3
"""
Fantasy Casino — status agent.

Handles status transitions for milestones and work items in bulk.
Never creates or deletes data. Only reads and updates status fields.

Status transition map:
  Milestones: planned -> active -> done / blocked -> done
  Work items: todo -> in_progress -> done / failed / needs_review -> done

Usage:
    python3 agent/status_agent.py milestone-status <key> <new_status>
    python3 agent/status_agent.py item-status <item_id> <new_status> [--message "..."]
    python3 agent/status_agent.py phase-done <phase> [--milestone-key]
    python3 agent/status_agent.py reset <key> [--milestone]
    python3 agent/status_agent.py verify <item_id>
"""

import argparse
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from agent.taskboard import (
    list_milestones,
    list_work_items,
    update_work_item_status,
)
from agent.memory import get_conn, now


# Allowed transitions
MILESTONE_TRANSITIONS = {
    "planned": {"active", "blocked", "cancelled"},
    "active": {"done", "blocked"},
    "blocked": {"active", "done", "cancelled"},
    "done": set(),
    "cancelled": set(),
}

WORK_ITEM_TRANSITIONS = {
    "todo": {"in_progress", "blocked"},
    "in_progress": {"done", "failed", "needs_review", "blocked"},
    "blocked": {"todo", "done"},
    "needs_review": {"in_progress", "done"},
    "done": set(),
    "failed": {"todo", "in_progress"},
    "obsolete": set(),
    "superseded": set(),
}


def _check_transition(current, target, resource_type="item"):
    """Check if a status transition is allowed."""
    allowed = {
        "milestone": MILESTONE_TRANSITIONS,
        "work_item": WORK_ITEM_TRANSITIONS,
    }[resource_type]

    if current not in allowed:
        return False, f"Unknown current status: {current}"
    if target not in allowed[current]:
        return False, f"Cannot transition {current} -> {target}. Allowed: {allowed[current] or 'none (terminal)'}"
    return True, "OK"


def cmd_milestone_status(args):
    """Change a milestone's status with transition validation."""
    key = args.key
    new_status = args.new_status

    milestones = list_milestones(db_path=args.db_path)
    ms = None
    for m in milestones:
        if m["milestone_key"] == key:
            ms = m
            break

    if not ms:
        print(f"ERROR: Milestone '{key}' not found.")
        return 1

    valid, msg = _check_transition(ms["status"], new_status, "milestone")
    if not valid:
        print(f"ERROR: Transition rejected: {key} [{ms['status']}] -> [{new_status}]. {msg}")
        return 1

    conn = get_conn(args.db_path)
    try:
        updates = ["status = ?", "updated_at = ?"]
        params = [new_status, now()]

        if new_status == "active":
            updates.append("started_at = ?")
            params.append(now())
        elif new_status == "done":
            updates.append("completed_at = ?")
            params.append(now())

        sql = f"UPDATE milestones SET {', '.join(updates)} WHERE id = ?"
        params.append(ms["id"])
        conn.execute(sql, params)
        conn.commit()
        print(f"Milestone '{key}': {ms['status']} -> {new_status}")
        return 0
    finally:
        conn.close()


def cmd_item_status(args):
    """Change a work item's status with transition validation."""
    item_id = args.item_id
    new_status = args.new_status

    from agent.taskboard import get_work_item
    item = get_work_item(item_id, db_path=args.db_path)
    if not item:
        print(f"ERROR: Work item #{item_id} not found.")
        return 1

    valid, msg = _check_transition(item["status"], new_status, "work_item")
    if not valid:
        print(f"ERROR: Transition rejected: #{item_id} [{item['status']}] -> [{new_status}]. {msg}")
        return 1

    update_work_item_status(
        item_id,
        new_status,
        message=args.message,
        resume_hint=args.resume_hint,
        verification_status=args.verification,
        last_error=args.last_error,
        db_path=args.db_path,
    )
    print(f"Work item #{item_id} ({item['item_key']}): {item['status']} -> {new_status}")
    return 0


def cmd_phase_done(args):
    """Mark all work items in a phase as done. Only for final cleanup."""
    phase = args.phase
    milestone_key = args.milestone_key

    ms_key = milestone_key or phase
    items = list_work_items(milestone_key=ms_key, db_path=args.db_path)

    if not items:
        print(f"No work items found for milestone '{ms_key}'.")
        return 0

    done_count = 0
    for item in items:
        if item["status"] not in ("done", "obsolete", "superseded"):
            update_work_item_status(
                item["id"],
                "done",
                message=f"Bulk-completed by status_agent (phase {ms_key}).",
                verification_status="passed",
                db_path=args.db_path,
            )
            done_count += 1

    print(f"Phase '{ms_key}': {done_count}/{len(items)} items marked done.")
    return 0


def cmd_reset(args):
    """Reset a milestone and its work items back to planned/todo."""
    key = args.key
    is_milestone = not args.milestone_item

    if is_milestone:
        milestones = list_milestones(db_path=args.db_path)
        ms = None
        for m in milestones:
            if m["milestone_key"] == key:
                ms = m
                break

        if not ms:
            print(f"ERROR: Milestone '{key}' not found.")
            return 1

        conn = get_conn(args.db_path)
        try:
            conn.execute(
                """UPDATE milestones SET status = 'planned', updated_at = ?,
                   started_at = NULL, completed_at = NULL WHERE id = ?""",
                (now(), ms["id"]),
            )
            # Reset all work items back to todo
            conn.execute(
                """UPDATE work_items SET status = 'todo', claimed_by = NULL,
                   claim_token = NULL, claimed_at = NULL, updated_at = ?
                   WHERE milestone_id = ? AND status NOT IN ('done', 'obsolete', 'superseded')""",
                (now(), ms["id"]),
            )
            conn.commit()
            print(f"Reset milestone '{key}' and all its items to planned/todo.")
            return 0
        finally:
            conn.close()
    else:
        # Reset a specific work item
        from agent.taskboard import get_work_item
        item = get_work_item(args.item_id, db_path=args.db_path)
        if not item:
            print(f"ERROR: Work item #{args.item_id} not found.")
            return 1

        update_work_item_status(
            item["id"],
            "todo",
            message=f"Reset by status_agent.",
            db_path=args.db_path,
        )
        print(f"Reset work item #{item['id']} ({item['item_key']}) back to todo.")
        return 0


def cmd_verify(args):
    """Mark a work item as verification passed."""
    item_id = args.item_id

    from agent.taskboard import get_work_item
    item = get_work_item(item_id, db_path=args.db_path)
    if not item:
        print(f"ERROR: Work item #{item_id} not found.")
        return 1

    update_work_item_status(
        item_id,
        item["status"],
        message="Verification passed by status_agent.",
        verification_status="passed",
        db_path=args.db_path,
    )
    print(f"Work item #{item_id} ({item['item_key']}): verification=passed")
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Status transition agent.")
    parser.add_argument("--db-path", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    # milestone-status
    ms = sub.add_parser("milestone-status", help="Change milestone status")
    ms.add_argument("key", help="Milestone key")
    ms.add_argument("new_status", help="New status")

    # item-status
    is_parser = sub.add_parser("item-status", help="Change work item status")
    is_parser.add_argument("item_id", type=int)
    is_parser.add_argument("new_status", help="New status")
    is_parser.add_argument("--message", default=None)
    is_parser.add_argument("--resume-hint", default=None)
    is_parser.add_argument("--verification", default=None, help="passed|failed|skipped")
    is_parser.add_argument("--last-error", default=None)

    # phase-done
    pd = sub.add_parser("phase-done", help="Bulk mark phase items as done")
    pd.add_argument("phase", help="Phase or milestone key")
    pd.add_argument("--milestone-key", default=None)

    # reset
    rs = sub.add_parser("reset", help="Reset milestone or item back to planned/todo")
    rs.add_argument("--key", default=None, help="Milestone key")
    rs.add_argument("--item-id", type=int, default=None, help="Work item ID")
    rs.add_argument("--milestone-item", action="store_true",
                    help="If set, reset by milestone key; otherwise by item ID")

    # verify
    vr = sub.add_parser("verify", help="Mark work item verification as passed")
    vr.add_argument("item_id", type=int)

    args = parser.parse_args(argv)

    if args.command == "milestone-status":
        sys.exit(cmd_milestone_status(args))
    elif args.command == "item-status":
        sys.exit(cmd_item_status(args))
    elif args.command == "phase-done":
        sys.exit(cmd_phase_done(args))
    elif args.command == "reset":
        sys.exit(cmd_reset(args))
    elif args.command == "verify":
        sys.exit(cmd_verify(args))


if __name__ == "__main__":
    main()
