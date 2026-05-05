#!/usr/bin/env python3
"""
Sync active work_items from the milestones system into the legacy tasks table.

This allows `agent/orchestrator/run_task.py` to pick up active tasks.

Run from project root:
    python3 .scripts/sync_tasks.py          # dry run — what would be synced
    python3 .scripts/sync_tasks.py --apply  # actually insert into DB
"""

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "agent" / "plans.db"


def get_active_work_items(conn):
    return conn.execute('''
        SELECT w.item_key, w.title, w.description, w.priority, w.risk_level,
               m.target_phase as phase, w.status
        FROM work_items w
        JOIN milestones m ON w.milestone_id = m.id
        WHERE w.status IN ('todo', 'in_progress')
        ORDER BY w.priority DESC, w.item_key
    ''').fetchall()


def get_existing_titles(conn):
    return set(row[0] for row in conn.execute(
        'SELECT title FROM tasks'
    ).fetchall())


def sync(conn, dry_run=True):
    active = get_active_work_items(conn)
    existing_titles = get_existing_titles(conn)
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    if not active:
        print("No active work_items to sync.")
        return 0

    count = 0
    for wi in active:
        item_key = wi['item_key']
        if wi['title'] in existing_titles:
            print(f"  SKIP (already exists): {item_key}")
            continue

        # Map priority: work_items priority (1-5) → tasks priority (P0-P5)
        # Priority 1 = highest = P1, 2 = P2, etc.
        p = wi['priority']
        if p <= 1:
            task_priority = 'P1'
        elif p <= 2:
            task_priority = 'P2'
        elif p <= 3:
            task_priority = 'P3'
        elif p <= 4:
            task_priority = 'P4'
        else:
            task_priority = 'P5'

        risk = wi['risk_level']
        if risk == 'critical':
            task_risk = 'high'
        elif risk == 'high':
            task_risk = 'high'
        elif risk == 'medium':
            task_risk = 'medium'
        else:
            task_risk = 'low'

        phase = wi['phase'] or 'phase3'
        title = wi['title']
        desc = wi['description'] or title

        if dry_run:
            print(f"  INSERT: {item_key} [{task_priority}] status={wi['status']} | {title[:60]}")
        else:
            conn.execute('''
                INSERT INTO tasks (title, description, priority, status, risk_class, phase, created_at, updated_at, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                title,
                desc,
                task_priority,
                'planned' if wi['status'] == 'todo' else 'running',
                task_risk,
                phase,
                now,
                now,
                now if wi['status'] == 'in_progress' else None,
            ))
            print(f"  SYNCED: {item_key} [{task_priority}] | {title[:60]}")
        count += 1

    if not dry_run:
        conn.commit()

    print(f"\nSynced: {count} tasks ({'DRY RUN' if dry_run else 'APPLIED'})")
    return count


def main():
    if not DB_PATH.exists():
        print(f"Error: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Show current state
    active = get_active_work_items(conn)
    print(f"Active work_items: {len(active)}")
    for wi in active:
        status_icon = '🔵' if wi['status'] == 'in_progress' else '⚪'
        print(f"  {status_icon} {wi['item_key']} [{wi['priority']}] {wi['risk_level']:8s} | {wi['title'][:50]}")
    print()

    apply = '--apply' in sys.argv
    sync(conn, dry_run=not apply)
    conn.close()

    if not apply:
        print("\n(Run with --apply to actually sync)")


if __name__ == '__main__':
    main()
