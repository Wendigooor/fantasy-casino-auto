#!/usr/bin/env python3
"""
Fantasy Casino — read-only agent.

Queries milestones, work items, and logs from plans.db.
Never writes, updates, or deletes anything.

Usage:
    python3 agent/read_agent.py milestones
    python3 agent/read_agent.py milestones --status done
    python3 agent/read_agent.py work-items
    python3 agent/read_agent.py work-items --status todo --milestone phase3-wallet
    python3 agent/read_agent.py next
    python3 agent/read_agent.py context <item_id>
    python3 agent/read_agent.py logs <item_id> --limit 10
    python3 agent/read_agent.py phases
"""

import argparse
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from agent.taskboard import (
    build_execution_context,
    get_next_work_item,
    get_recent_logs,
    list_milestones,
    list_work_items,
)


def _print_json(payload):
    print(json.dumps(payload, ensure_ascii=True, indent=2))


def cmd_milestones(args):
    milestones = list_milestones(db_path=args.db_path)
    if args.status:
        milestones = [m for m in milestones if m["status"] == args.status]
    if not milestones:
        print("No milestones found.")
        return
    print(f"\nMilestones ({len(milestones)} total):")
    print("-" * 72)
    for m in milestones:
        print(f"  [{m['status']:8s}] {m['milestone_key']:25s} priority={m['priority']} phase={m.get('target_phase', 'N/A')}")
        print(f"            {m['title']}")
        if m.get("description"):
            print(f"            {m['description'][:100]}")
        print()


def cmd_work_items(args):
    items = list_work_items(
        status=args.status,
        milestone_key=args.milestone,
        db_path=args.db_path,
    )
    if not items:
        print("No work items found.")
        return
    print(f"\nWork items ({len(items)} total):")
    print("-" * 72)
    for item in items:
        print(f"  [{item['status']:12s}] #{item['id']} {item['item_key']} priority={item['priority']} risk={item['risk_level']}")
        print(f"            {item['title']}")
        if item.get("milestone_key"):
            print(f"            milestone={item['milestone_key']}")
        if item.get("claimed_by"):
            print(f"            claimed_by={item['claimed_by']}")
        print()


def cmd_next(args):
    item = get_next_work_item(db_path=args.db_path)
    if not item:
        print("No next work item (all done or none planned).")
        return
    _print_json(item)


def cmd_context(args):
    ctx = build_execution_context(args.item_id, db_path=args.db_path)
    _print_json(ctx)


def cmd_logs(args):
    logs = get_recent_logs(item_id=args.item_id, limit=args.limit, db_path=args.db_path)
    if not logs:
        print("No logs found.")
        return
    for log in logs:
        print(f"  [{log['log_type']:12s}] #{log['work_item_id']} ({log.get('item_key', '?')}) {log['message']}")
        print(f"            created_at={log['created_at']}")
        if log.get("metadata"):
            print(f"            metadata={log['metadata']}")
        print()


def cmd_phases(args):
    milestones = list_milestones(db_path=args.db_path)
    phases = {}
    for m in milestones:
        phase = m.get("target_phase", "unknown")
        if phase not in phases:
            phases[phase] = {"phase": phase, "milestones": [], "statuses": set()}
        phases[phase]["milestones"].append(m)
        phases[phase]["statuses"].add(m["status"])

    status_order = {"planned": 0, "active": 1, "blocked": 2, "done": 3, "cancelled": 4}
    phase_order = {
        "phase0": 0, "phase1": 1, "phase2": 2, "phase3": 3, "phase4": 4,
        "phase5": 5, "phase6": 6, "phase7": 7, "phase8": 8,
    }

    for phase_key in sorted(phases.keys(), key=lambda p: phase_order.get(p, 99)):
        phase = phases[phase_key]
        adv_status = max(phase["statuses"], key=lambda s: status_order.get(s, -1))
        print(f"\n  {phase_key} [{adv_status.upper()}]")
        for m in phase["milestones"]:
            items = list_work_items(milestone_key=m["milestone_key"], db_path=args.db_path)
            total = len(items)
            done = sum(1 for i in items if i["status"] == "done")
            todo = sum(1 for i in items if i["status"] == "todo")
            in_progress = sum(1 for i in items if i["status"] == "in_progress")
            ms_icon = {"planned": "○", "active": "◐", "done": "●"}.get(m["status"], "?")
            print(f"    {ms_icon} {m['milestone_key']} [{m['status']}]")
            if total > 0:
                print(f"      {done}/{total} done, {in_progress} in progress, {todo} todo")
            else:
                print(f"      no tasks yet")
    print()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Read-only agent for plans.db.")
    parser.add_argument("--db-path", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    logs_parser = sub.add_parser("logs", help="Show recent logs")
    logs_parser.add_argument("item_id", type=int)
    logs_parser.add_argument("--limit", type=int, default=10)

    ctx_parser = sub.add_parser("context", help="Show execution context for a work item")
    ctx_parser.add_argument("item_id", type=int)

    ms_parser = sub.add_parser("milestones", help="List milestones")
    ms_parser.add_argument("--status", default=None)

    wi_parser = sub.add_parser("work-items", help="List work items")
    wi_parser.add_argument("--status", default=None)
    wi_parser.add_argument("--milestone", default=None)

    sub.add_parser("next", help="Show next work item")
    sub.add_parser("phases", help="Show phase overview")

    args = parser.parse_args(argv)

    if args.command == "milestones":
        cmd_milestones(args)
    elif args.command == "work-items":
        cmd_work_items(args)
    elif args.command == "next":
        cmd_next(args)
    elif args.command == "context":
        cmd_context(args)
    elif args.command == "logs":
        cmd_logs(args)
    elif args.command == "phases":
        cmd_phases(args)


if __name__ == "__main__":
    main()
