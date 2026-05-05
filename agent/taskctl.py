#!/usr/bin/env python3
"""
Fantasy Casino — deterministic taskboard CLI.

This is the only supported shell-facing interface for the local agent to read
or mutate orchestration state. It keeps state transitions typed and resumable.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from agent.taskboard import (
    DEFAULT_AGENT_NAME,
    add_work_item_artifact,
    build_execution_context,
    claim_work_item,
    create_work_item,
    ensure_schema,
    get_next_work_item,
    list_milestones,
    list_work_items,
    log_work_item,
    seed_initial_execution_plan,
    update_work_item_status,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage the Fantasy Casino local taskboard.")
    parser.add_argument("--db-path", default=None, help="Optional SQLite database path.")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Ensure orchestration schema exists.")
    sub.add_parser("seed", help="Seed the initial execution milestone and starter work items.")

    next_parser = sub.add_parser("next", help="Show the next work item to execute.")
    next_parser.add_argument("--json", action="store_true", help="Print JSON.")

    claim_parser = sub.add_parser("claim", help="Claim a work item and mark it in progress.")
    claim_parser.add_argument("item_id", type=int)
    claim_parser.add_argument("--agent", default=DEFAULT_AGENT_NAME)
    claim_parser.add_argument("--json", action="store_true", help="Print JSON.")

    list_parser = sub.add_parser("list", help="List work items.")
    list_parser.add_argument("--status", default=None)
    list_parser.add_argument("--milestone", default=None)
    list_parser.add_argument("--json", action="store_true", help="Print JSON.")

    sub.add_parser("milestones", help="List milestones.")

    context_parser = sub.add_parser("context", help="Build narrow execution context for one work item.")
    context_parser.add_argument("item_id", type=int)
    context_parser.add_argument("--json", action="store_true", help="Print JSON.")

    complete_parser = sub.add_parser("complete", help="Mark a work item done.")
    complete_parser.add_argument("item_id", type=int)
    complete_parser.add_argument("--message", required=True)
    complete_parser.add_argument("--resume-hint", default=None)

    review_parser = sub.add_parser("needs-review", help="Mark a work item ready for review.")
    review_parser.add_argument("item_id", type=int)
    review_parser.add_argument("--message", required=True)
    review_parser.add_argument("--resume-hint", default=None)

    fail_parser = sub.add_parser("fail", help="Mark a work item failed.")
    fail_parser.add_argument("item_id", type=int)
    fail_parser.add_argument("--message", required=True)
    fail_parser.add_argument("--resume-hint", default=None)

    block_parser = sub.add_parser("block", help="Mark a work item blocked.")
    block_parser.add_argument("item_id", type=int)
    block_parser.add_argument("--message", required=True)
    block_parser.add_argument("--resume-hint", default=None)

    obsolete_parser = sub.add_parser("obsolete", help="Mark a work item obsolete.")
    obsolete_parser.add_argument("item_id", type=int)
    obsolete_parser.add_argument("--message", required=True)

    log_parser = sub.add_parser("log", help="Append a progress or summary log.")
    log_parser.add_argument("item_id", type=int)
    log_parser.add_argument("--type", required=True, choices=["summary", "progress", "verification", "blocker", "discovery", "review"])
    log_parser.add_argument("--message", required=True)
    log_parser.add_argument("--changed-files", default=None, help="JSON array or comma-separated list.")
    log_parser.add_argument("--metadata", default=None, help="JSON object.")

    artifact_parser = sub.add_parser("attach-artifact", help="Attach an artifact path to a work item.")
    artifact_parser.add_argument("item_id", type=int)
    artifact_parser.add_argument("--type", required=True, choices=["plan", "patch", "test_output", "report", "checkpoint", "other"])
    artifact_parser.add_argument("--path", required=True)
    artifact_parser.add_argument("--summary", default=None)

    create_parser = sub.add_parser("create-task", help="Create a work item.")
    create_parser.add_argument("--key", required=True)
    create_parser.add_argument("--title", required=True)
    create_parser.add_argument("--description", required=True)
    create_parser.add_argument("--milestone-id", type=int, default=None)
    create_parser.add_argument("--parent-id", type=int, default=None)
    create_parser.add_argument("--kind", default="task")
    create_parser.add_argument("--priority", type=int, default=3)
    create_parser.add_argument("--risk", default="low")
    create_parser.add_argument("--scope-files", default=None)
    create_parser.add_argument("--acceptance", default=None)
    create_parser.add_argument("--verify", default=None)
    create_parser.add_argument("--stale-check", default=None)
    create_parser.add_argument("--resume-hint", default=None)

    return parser


def _parse_list_or_json(raw: str | None) -> list[str] | dict | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    if text.startswith("[") or text.startswith("{"):
        return json.loads(text)
    return [part.strip() for part in text.split(",") if part.strip()]


def _print_json(payload) -> None:
    print(json.dumps(payload, ensure_ascii=True, indent=2))


def _print_item(item: dict) -> None:
    if not item:
        print("No work item found.")
        return
    print(f"[{item['status']}] #{item['id']} {item['item_key']} :: {item['title']}")
    print(f"priority={item['priority']} risk={item['risk_level']} kind={item['kind']}")
    if item.get("milestone_key"):
        print(f"milestone={item['milestone_key']}")
    if item.get("scope_files"):
        print("scope_files=" + ", ".join(item["scope_files"]))
    if item.get("verification_command"):
        print(f"verify={item['verification_command']}")
    if item.get("resume_hint"):
        print(f"resume_hint={item['resume_hint']}")


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    db_path = args.db_path

    if args.command == "init":
        ensure_schema(db_path=db_path)
        print("Taskboard schema ensured.")
        return 0

    if args.command == "seed":
        result = seed_initial_execution_plan(db_path=db_path)
        print(f"Seeded milestones={result['milestones']} work_items={result['work_items']}")
        return 0

    if args.command == "next":
        item = get_next_work_item(db_path=db_path)
        if args.json:
            _print_json(item or {})
        else:
            _print_item(item or {})
        return 0

    if args.command == "claim":
        item = claim_work_item(args.item_id, claimed_by=args.agent, db_path=db_path)
        if args.json:
            _print_json(item)
        else:
            _print_item(item)
        return 0

    if args.command == "list":
        items = list_work_items(status=args.status, milestone_key=args.milestone, db_path=db_path)
        if args.json:
            _print_json(items)
        else:
            for item in items:
                _print_item(item)
                print()
        return 0

    if args.command == "milestones":
        for milestone in list_milestones(db_path=db_path):
            print(f"[{milestone['status']}] {milestone['milestone_key']} :: {milestone['title']}")
        return 0

    if args.command == "context":
        ctx = build_execution_context(args.item_id, db_path=db_path)
        if args.json:
            _print_json(ctx)
        else:
            _print_item(ctx["work_item"])
            print()
            if ctx.get("milestone"):
                print(f"milestone_title={ctx['milestone']['title']}")
            if ctx["recent_logs"]:
                print("recent_logs:")
                for log in ctx["recent_logs"]:
                    print(f"- [{log['log_type']}] {log['message']}")
        return 0

    if args.command == "complete":
        update_work_item_status(
            args.item_id,
            "done",
            message=args.message,
            resume_hint=args.resume_hint,
            verification_status="passed",
            db_path=db_path,
        )
        print(f"Marked work item #{args.item_id} done.")
        return 0

    if args.command == "needs-review":
        update_work_item_status(
            args.item_id,
            "needs_review",
            message=args.message,
            resume_hint=args.resume_hint,
            verification_status="passed",
            db_path=db_path,
        )
        print(f"Marked work item #{args.item_id} needs review.")
        return 0

    if args.command == "fail":
        update_work_item_status(
            args.item_id,
            "failed",
            message=args.message,
            resume_hint=args.resume_hint,
            verification_status="failed",
            last_error=args.message,
            db_path=db_path,
        )
        print(f"Marked work item #{args.item_id} failed.")
        return 0

    if args.command == "block":
        update_work_item_status(
            args.item_id,
            "blocked",
            message=args.message,
            resume_hint=args.resume_hint,
            db_path=db_path,
        )
        print(f"Marked work item #{args.item_id} blocked.")
        return 0

    if args.command == "obsolete":
        update_work_item_status(
            args.item_id,
            "obsolete",
            message=args.message,
            verification_status="skipped",
            db_path=db_path,
        )
        print(f"Marked work item #{args.item_id} obsolete.")
        return 0

    if args.command == "log":
        changed_files = _parse_list_or_json(args.changed_files)
        metadata = _parse_list_or_json(args.metadata)
        log_work_item(
            args.item_id,
            args.type,
            args.message,
            changed_files=changed_files if isinstance(changed_files, list) else None,
            metadata=metadata if isinstance(metadata, dict) else None,
            db_path=db_path,
        )
        print(f"Appended {args.type} log to work item #{args.item_id}.")
        return 0

    if args.command == "attach-artifact":
        artifact_id = add_work_item_artifact(
            args.item_id,
            args.type,
            args.path,
            summary=args.summary,
            db_path=db_path,
        )
        print(f"Attached artifact #{artifact_id} to work item #{args.item_id}.")
        return 0

    if args.command == "create-task":
        item_id = create_work_item(
            item_key=args.key,
            title=args.title,
            description=args.description,
            milestone_id=args.milestone_id,
            parent_work_item_id=args.parent_id,
            kind=args.kind,
            priority=args.priority,
            risk_level=args.risk,
            scope_files=_parse_list_or_json(args.scope_files),
            acceptance_criteria=_parse_list_or_json(args.acceptance),
            verification_command=args.verify,
            stale_check=args.stale_check,
            resume_hint=args.resume_hint,
            db_path=db_path,
        )
        print(f"Created work item #{item_id}.")
        return 0

    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    sys.exit(main())
