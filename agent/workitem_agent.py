#!/usr/bin/env python3
"""
Fantasy Casino — work item agent.

Creates and updates work items. Never creates milestones.
Uses taskboard.py as the ORM layer — no raw SQL.

Usage:
    python3 agent/workitem_agent.py create --key phase3-001 --title "..." --milestone phase3-wallet
    python3 agent/workitem_agent.py list [--status todo] [--milestone phase3-wallet]
    python3 agent/workitem_agent.py update-status <item_id> --status done --message "..."
    python3 agent/workitem_agent.py claim <item_id> --agent my-agent
    python3 agent/workitem_agent.py log <item_id> --type progress --message "..."
"""

import argparse
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from agent.taskboard import (
    claim_work_item,
    create_work_item,
    list_work_items,
    log_work_item,
    update_work_item_status,
)
from agent.plan_maintainer import _get_milestone_id


def cmd_create(args):
    """Create a work item attached to a milestone."""
    key = args.key
    title = args.title
    description = args.description or ""
    milestone_key = args.milestone

    # Resolve milestone_id
    ms_id = _get_milestone_id(milestone_key, db_path=args.db_path)
    if ms_id is None:
        print(f"ERROR: Milestone '{milestone_key}' not found. Create it with milestone_agent first.")
        return 1

    # Validate status
    valid_statuses = ("todo", "in_progress", "blocked", "needs_review", "done", "failed", "obsolete", "superseded")
    if args.status not in valid_statuses:
        print(f"ERROR: Invalid status '{args.status}'. Must be one of: {valid_statuses}")
        return 1

    # Validate risk
    valid_risks = ("low", "medium", "high", "critical")
    if args.risk not in valid_risks:
        print(f"ERROR: Invalid risk '{args.risk}'. Must be one of: {valid_risks}")
        return 1

    # Parse lists
    scope_files = _parse_list(args.scope_files)
    acceptance = _parse_list(args.acceptance)

    item_id = create_work_item(
        item_key=key,
        title=title,
        description=description,
        milestone_id=ms_id,
        parent_work_item_id=args.parent_id,
        kind=args.kind,
        status=args.status,
        priority=args.priority,
        risk_level=args.risk,
        scope_files=scope_files,
        acceptance_criteria=acceptance,
        verification_command=args.verify,
        stale_check=args.stale_check,
        resume_hint=args.resume_hint,
        db_path=args.db_path,
    )
    print(f"Created work item '{key}' (id={item_id}, milestone={milestone_key}).")
    return 0


def cmd_list(args):
    """List work items with optional filters."""
    items = list_work_items(
        status=args.status,
        milestone_key=args.milestone,
        db_path=args.db_path,
    )
    if not items:
        print("No work items found.")
        return

    print(f"\nWork items ({len(items)}):")
    print("-" * 80)
    for item in items:
        print(f"  [{item['status']:12s}] #{item['id']} {item['item_key']} pri={item['priority']} risk={item['risk_level']}")
        print(f"            {item['title']}")
        if item.get("milestone_key"):
            print(f"            milestone={item['milestone_key']}")
        if item.get("claimed_by"):
            print(f"            claimed_by={item['claimed_by']}")
        if item.get("verification_command"):
            print(f"            verify={item['verification_command']}")
        print()


def cmd_update_status(args):
    """Update a work item's status."""
    item_id = args.item_id
    status = args.status

    valid_statuses = ("todo", "in_progress", "blocked", "needs_review", "done", "failed", "obsolete", "superseded")
    if status not in valid_statuses:
        print(f"ERROR: Invalid status '{status}'. Must be one of: {valid_statuses}")
        return 1

    update_work_item_status(
        item_id,
        status,
        message=args.message,
        resume_hint=args.resume_hint,
        verification_status=args.verification,
        last_error=args.last_error,
        db_path=args.db_path,
    )
    print(f"Updated work item #{item_id} -> status={status}")
    return 0


def cmd_claim(args):
    """Claim a work item."""
    item_id = args.item_id
    agent = args.agent

    item = claim_work_item(item_id, claimed_by=agent, db_path=args.db_path)
    print(f"Claimed work item #{item_id} by '{agent}' (token={item['claim_token']})")
    return 0


def cmd_log(args):
    """Append a log entry to a work item."""
    item_id = args.item_id
    log_type = args.type
    message = args.message
    changed_files = _parse_list(args.changed_files)

    log_work_item(
        item_id,
        log_type,
        message,
        changed_files=changed_files,
        db_path=args.db_path,
    )
    print(f"Added {log_type} log to work item #{item_id}: {message}")
    return 0


def _parse_list(raw):
    """Parse JSON array string or comma-separated list."""
    if not raw:
        return []
    raw = raw.strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return [part.strip() for part in raw.split(",") if part.strip()]


def main(argv=None):
    parser = argparse.ArgumentParser(description="Work item management agent.")
    parser.add_argument("--db-path", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    # create
    cr = sub.add_parser("create", help="Create a work item")
    cr.add_argument("--key", required=True, help="Unique item key")
    cr.add_argument("--title", required=True)
    cr.add_argument("--description", default="")
    cr.add_argument("--milestone", required=True, help="Milestone key")
    cr.add_argument("--parent-id", type=int, default=None)
    cr.add_argument("--kind", default="task", help="task|epic|subtask|bug|chore|research|review")
    cr.add_argument("--status", default="todo")
    cr.add_argument("--priority", type=int, default=3)
    cr.add_argument("--risk", default="low")
    cr.add_argument("--scope-files", default=None)
    cr.add_argument("--acceptance", default=None)
    cr.add_argument("--verify", default=None)
    cr.add_argument("--stale-check", default=None)
    cr.add_argument("--resume-hint", default=None)

    # list
    ls = sub.add_parser("list", help="List work items")
    ls.add_argument("--status", default=None)
    ls.add_argument("--milestone", default=None)

    # update-status
    us = sub.add_parser("update-status", help="Update work item status")
    us.add_argument("item_id", type=int)
    us.add_argument("--status", required=True)
    us.add_argument("--message", default=None)
    us.add_argument("--resume-hint", default=None)
    us.add_argument("--verification", default=None, help="passed|failed|skipped")
    us.add_argument("--last-error", default=None)

    # claim
    cl = sub.add_parser("claim", help="Claim a work item")
    cl.add_argument("item_id", type=int)
    cl.add_argument("--agent", default="local-agent")

    # log
    lg = sub.add_parser("log", help="Append log to work item")
    lg.add_argument("item_id", type=int)
    lg.add_argument("--type", required=True,
                    choices=["summary", "progress", "verification", "blocker", "discovery", "review"])
    lg.add_argument("--message", required=True)
    lg.add_argument("--changed-files", default=None)

    args = parser.parse_args(argv)

    if args.command == "create":
        sys.exit(cmd_create(args))
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "update-status":
        sys.exit(cmd_update_status(args))
    elif args.command == "claim":
        sys.exit(cmd_claim(args))
    elif args.command == "log":
        sys.exit(cmd_log(args))


if __name__ == "__main__":
    main()
