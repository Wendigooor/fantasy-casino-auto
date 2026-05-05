#!/usr/bin/env python3
"""
Fix task ordering in the legacy tasks table.

The legacy tasks from `research/10-implementation-backlog.md` were auto-classified
as P0-P9, but phases 0-5 are already completed. This script:

1. Marks legacy tasks for completed phases (p0-p5) as 'done'
2. Ensures running/in_progress tasks from phase3-wallet are prioritized first

Run from project root:
    python3 .scripts/fix_task_order.py       # dry run
    python3 .scripts/fix_task_order.py --apply  # actually fix
"""

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "agent" / "plans.db"

# Completed phases from milestones system
COMPLETED_PHASES = {'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'}
# Phase 8 has some legacy tasks that overlap with future work

# Tasks that are actually active (synced from work_items)
ACTIVE_PHASE3_IDS = set()


def main():
    if not DB_PATH.exists():
        print(f"Error: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    dry_run = '--apply' not in sys.argv

    conn = sqlite3.connect(DB_PATH)

    # Get current state
    rows = conn.execute(
        'SELECT id, title, priority, phase, status FROM tasks ORDER BY priority, id'
    ).fetchall()

    print(f"Total tasks: {len(rows)}")
    print()

    # Categorize tasks
    phase3_running = []
    phase3_todo = []
    legacy_done = []
    legacy_planned = []

    for r in rows:
        rid, title, prio, phase, status = r
        if phase == 'phase3':
            if status == 'running':
                phase3_running.append(r)
            else:
                phase3_todo.append(r)
        elif phase in ('p0', 'p1', 'p2', 'p3', 'p4', 'p5') and status == 'planned':
            legacy_done.append(r)
        else:
            legacy_planned.append(r)

    print("=== Phase3 active tasks (should be first) ===")
    for r in phase3_running:
        print(f"  🔵 #{r[0]} [{r[2]}] {r[4]:10s} | {r[1][:50]}")
    for r in phase3_todo:
        print(f"  ⚪ #{r[0]} [{r[2]}] {r[4]:10s} | {r[1][:50]}")
    print()

    print(f"=== Legacy tasks to mark done (completed phases): {len(legacy_done)} ===")
    for r in legacy_done:
        print(f"  #{r[0]} [{r[2]}] {r[3]:4s} | {r[1][:50]}")
    print()

    print(f"=== Legacy planned tasks (future phases): {len(legacy_planned)} ===")
    for r in legacy_planned:
        print(f"  #{r[0]} [{r[2]}] {r[3]:4s} | {r[1][:50]}")
    print()

    # Calculate new priorities
    # Phase3 running tasks: P0 (highest priority, should be next)
    # Phase3 todo tasks: P1
    # Future legacy tasks: P2+
    # Completed legacy tasks: will be marked done

    if not dry_run:
        # Mark completed phase tasks as done
        for r in legacy_done:
            conn.execute(
                "UPDATE tasks SET status = 'done' WHERE id = ?",
                (r[0],)
            )
        print(f"✅ Marked {len(legacy_done)} tasks as done")

        # Update phase3 task priorities
        phase3_ids = [r[0] for r in phase3_running + phase3_todo]
        for tid in phase3_ids:
            conn.execute(
                "UPDATE tasks SET priority = 'P0' WHERE id = ?",
                (tid,)
            )
        print(f"✅ Updated {len(phase3_ids)} phase3 tasks to P0")

        # Reset phase3 running task to planned so orchestrator picks it up
        for r in phase3_running:
            conn.execute(
                "UPDATE tasks SET status = 'planned' WHERE id = ?",
                (r[0],)
            )
        print(f"✅ Reset {len(phase3_running)} running task(s) to planned for re-queue")

        conn.commit()

    # Show what the queue will look like
    if dry_run:
        print("=== Expected next tasks after fix ===")
        print(f"  P0 phase3 (running → planned):")
        for r in phase3_running:
            print(f"    #{r[0]} [{r[2]}] planned | {r[1][:50]}")
        print(f"  P0 phase3 (todo):")
        for r in phase3_todo:
            print(f"    #{r[0]} [{r[2]}] {r[4]:10s} | {r[1][:50]}")
        print(f"  P2+ legacy (future):")
        for r in legacy_planned[:5]:
            print(f"    #{r[0]} [{r[2]}] {r[4]:10s} | {r[1][:50]}")
        print(f"    ... ({len(legacy_planned) - 5} more)")
        print()
        print(f"(Run with --apply to apply changes)")
    else:
        # Verify
        next_task = conn.execute(
            "SELECT * FROM tasks WHERE status = 'planned' ORDER BY priority ASC, id ASC LIMIT 1"
        ).fetchone()
        if next_task:
            print(f"\n✅ Next task will be: #{next_task['id']} [{next_task['priority']}] {next_task['title']}")
        conn.close()


if __name__ == '__main__':
    main()
