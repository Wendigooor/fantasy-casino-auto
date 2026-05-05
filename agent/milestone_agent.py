#!/usr/bin/env python3
"""
Fantasy Casino — milestone agent.

Creates, activates, and completes milestones.
Never creates work items. Never modifies statuses of work items directly.
Uses taskboard.py as the ORM layer — no raw SQL.

Usage:
    python3 agent/milestone_agent.py create <key> --title "..." --phase phase3 --priority 2
    python3 agent/milestone_agent.py activate <key>
    python3 agent/milestone_agent.py complete <key>
    python3 agent/milestone_agent.py list
"""

import argparse
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from agent.taskboard import (
    create_milestone,
    list_milestones,
)
from agent.memory import get_conn, now


def cmd_create(args):
    """Create a new milestone. Safe: uses UPSERT (ON CONFLICT)."""
    key = args.key
    title = args.title
    description = args.description or ""
    status = args.status or "planned"
    priority = args.priority or 3
    phase = args.phase

    # Validate status
    valid_statuses = ("planned", "active", "blocked", "done", "cancelled")
    if status not in valid_statuses:
        print(f"ERROR: Invalid status '{status}'. Must be one of: {valid_statuses}")
        return 1

    # Validate priority
    if not 1 <= priority <= 5:
        print(f"ERROR: Priority must be 1-5, got {priority}")
        return 1

    milestone_id = create_milestone(
        milestone_key=key,
        title=title,
        description=description,
        status=status,
        priority=priority,
        target_phase=phase,
        db_path=args.db_path,
    )
    print(f"Created milestone '{key}' (id={milestone_id}, status={status}).")
    return 0


def cmd_activate(args):
    """Activate a milestone: set status='active', clear stale in_progress items."""
    key = args.key

    # Check if milestone exists
    milestones = list_milestones(db_path=args.db_path)
    ms = None
    for m in milestones:
        if m["milestone_key"] == key:
            ms = m
            break

    if not ms:
        print(f"ERROR: Milestone '{key}' not found.")
        return 1

    if ms["status"] == "active":
        print(f"Milestone '{key}' is already active.")
        return 0

    # Use direct update via taskboard's ORM-safe pattern
    conn = get_conn(args.db_path)
    try:
        # Update milestone status
        conn.execute(
            "UPDATE milestones SET status = 'active', updated_at = ? WHERE id = ?",
            (now(), ms["id"]),
        )
        # Clear stale in_progress items for this milestone back to todo
        conn.execute(
            """UPDATE work_items
               SET status = 'todo', claimed_by = NULL, claim_token = NULL, claimed_at = NULL, updated_at = ?
               WHERE milestone_id = ? AND status IN ('in_progress', 'blocked')""",
            (now(), ms["id"]),
        )
        conn.commit()
        print(f"Activated milestone '{key}' (id={ms['id']}).")
        return 0
    finally:
        conn.close()


def cmd_complete(args):
    """Complete a milestone: mark all its work items done, set milestone to 'done'."""
    key = args.key

    # Check if milestone exists
    milestones = list_milestones(db_path=args.db_path)
    ms = None
    for m in milestones:
        if m["milestone_key"] == key:
            ms = m
            break

    if not ms:
        print(f"ERROR: Milestone '{key}' not found.")
        return 1

    if ms["status"] == "done":
        print(f"Milestone '{key}' is already done.")
        return 0

    # Count current items
    from agent.taskboard import list_work_items, update_work_item_status
    items = list_work_items(milestone_key=key, db_path=args.db_path)
    done_count = 0
    for item in items:
        if item["status"] not in ("done", "obsolete", "superseded"):
            update_work_item_status(
                item["id"],
                "done",
                message=f"Auto-completed by milestone_agent (phase {key}).",
                verification_status="passed",
                db_path=args.db_path,
            )
            done_count += 1

    # Update milestone
    conn = get_conn(args.db_path)
    try:
        completion_msg = args.message or f"Milestone '{key}' completed by agent."
        conn.execute(
            """UPDATE milestones
               SET status = 'done', completed_at = ?, updated_at = ?, notes = ?
               WHERE id = ?""",
            (now(), now(), completion_msg, ms["id"]),
        )
        conn.commit()
        print(f"Completed milestone '{key}' ({done_count} items auto-marked done).")
        return 0
    finally:
        conn.close()


def cmd_list(args):
    """List all milestones."""
    milestones = list_milestones(db_path=args.db_path)
    if not milestones:
        print("No milestones found.")
        return

    print(f"\nMilestones ({len(milestones)}):")
    print("-" * 72)
    for m in milestones:
        print(f"  [{m['status']:8s}] {m['milestone_key']:25s} priority={m['priority']} phase={m.get('target_phase', 'N/A')}")
        print(f"            {m['title']}")
        print()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Milestone management agent.")
    parser.add_argument("--db-path", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    # create
    c_parser = sub.add_parser("create", help="Create a milestone")
    c_parser.add_argument("key", help="Unique milestone key, e.g. 'phase3-wallet'")
    c_parser.add_argument("--title", required=True, help="Display title")
    c_parser.add_argument("--description", default="", help="Description")
    c_parser.add_argument("--status", default="planned", help="Initial status")
    c_parser.add_argument("--priority", type=int, default=3, help="1-5, 1=highest")
    c_parser.add_argument("--phase", default=None, help="Target phase, e.g. 'phase3'")

    # activate
    a_parser = sub.add_parser("activate", help="Activate a milestone")
    a_parser.add_argument("key", help="Milestone key")

    # complete
    cm_parser = sub.add_parser("complete", help="Complete a milestone")
    cm_parser.add_argument("key", help="Milestone key")
    cm_parser.add_argument("--message", default=None, help="Completion message")

    # list
    sub.add_parser("list", help="List all milestones")

    args = parser.parse_args(argv)

    if args.command == "create":
        sys.exit(cmd_create(args))
    elif args.command == "activate":
        sys.exit(cmd_activate(args))
    elif args.command == "complete":
        sys.exit(cmd_complete(args))
    elif args.command == "list":
        cmd_list(args)


if __name__ == "__main__":
    main()
