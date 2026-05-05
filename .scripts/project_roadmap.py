#!/usr/bin/env python3
"""
Generate a Mermaid diagram from the project's plans.db database.

Usage (from project root):
    python3 .scripts/project_roadmap.py          # print to stdout
    python3 .scripts/project_roadmap.py --file   # save to .scripts/roadmap.md + .mmd only

Outputs:
    - stdout: Markdown with stats + Mermaid diagram
    - .scripts/roadmap.md    — full markdown (stats + diagram)
    - .scripts/roadmap.mmd   — pure Mermaid source
"""

import sqlite3
import sys
import os
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "agent" / "plans.db"
OUTPUT_DIR = Path(__file__).parent

# ── DB helpers ──────────────────────────────────────────────────────────────

def query_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_milestones(conn):
    return conn.execute(
        'SELECT * FROM milestones ORDER BY target_phase, priority'
    ).fetchall()


def get_tasks_by_milestone(conn, milestone_key):
    return conn.execute('''
        SELECT w.item_key, w.title, w.status, w.priority, w.risk_level
        FROM work_items w
        JOIN milestones m ON w.milestone_id = m.id
        WHERE m.milestone_key = ?
        ORDER BY w.priority DESC, w.item_key
    ''', (milestone_key,)).fetchall()


def get_task_summary(conn, milestone_key):
    return conn.execute('''
        SELECT
            sum(case when w.status="done" then 1 else 0 end) as done,
            sum(case when w.status="in_progress" then 1 else 0 end) as in_progress,
            sum(case when w.status="todo" then 1 else 0 end) as todo,
            sum(case when w.status="blocked" then 1 else 0 end) as blocked,
            sum(case when w.status="needs_review" then 1 else 0 end) as needs_review,
            sum(case when w.status="failed" then 1 else 0 end) as failed,
            count(w.id) as total
        FROM work_items w
        JOIN milestones m ON w.milestone_id = m.id
        WHERE m.milestone_key = ?
    ''', (milestone_key,)).fetchone()


def get_all_task_stats(conn):
    return conn.execute('''
        SELECT
            sum(case when w.status="done" then 1 else 0 end) as done,
            sum(case when w.status="in_progress" then 1 else 0 end) as in_progress,
            sum(case when w.status="todo" then 1 else 0 end) as todo,
            sum(case when w.status="blocked" then 1 else 0 end) as blocked,
            count(w.id) as total
        FROM work_items w
    ''').fetchone()


# ── Icons ───────────────────────────────────────────────────────────────────

STATUS_ICON = {
    'done': '✅', 'active': '🟡', 'planned': '⚪',
    'blocked': '🔴', 'cancelled': '⬛',
}
TASK_ICON = {
    'done': '✅', 'in_progress': '🔵', 'todo': '⚪',
    'blocked': '🔴', 'needs_review': '🟠', 'failed': '❌',
    'obsolete': '⬛', 'superseded': '⬛',
}
RISK_ICON = {
    'critical': '💀', 'high': '🔴', 'medium': '🟠', 'low': '🟢',
}
PHASE_COLOR = {
    'phase0': '#95a5a6', 'phase1': '#3498db', 'phase2': '#2ecc71',
    'phase3': '#e67e22', 'phase4': '#9b59b6', 'phase5': '#1abc9c',
    'phase6': '#e74c3c', 'phase7': '#f39c12', 'phase8': '#34495e',
}
PHASE_NAMES = {
    'phase0': 'Phase 0: Agent Setup',
    'phase1': 'Phase 1: CasCore',
    'phase2': 'Phase 2: Auth',
    'phase3': 'Phase 3: Wallet & Ledger',
    'phase4': 'Phase 4: Game Frontend',
    'phase5': 'Phase 5: Analytics & Scale',
    'phase6': 'Phase 6: Bonus & KYC',
    'phase7': 'Phase 7: Analytics',
    'phase8': 'Phase 8: Load Testing',
}


# ── Mermaid generator ───────────────────────────────────────────────────────

def generate_mermaid(conn, milestones):
    lines = []
    lines.append("%%{init: {'securityLevel': 'loose', 'theme': 'default'}}%%")
    lines.append("mermaid")
    lines.append("graph TD")
    lines.append("    classDef phase_done fill:#27ae60,color:white,stroke:#1e8449,stroke-width:2px")
    lines.append("    classDef phase_active fill:#f39c12,color:black,stroke:#d68910,stroke-width:2px")
    lines.append("    classDef phase_planned fill:#bdc3c7,color:black,stroke:#95a5a6,stroke-width:2px")
    lines.append("")

    # Root
    lines.append("    Root[Fantasy Casino Auto — Agent Orchestration System]")
    lines.append("")

    # Group milestones by phase
    phases = {}
    for m in milestones:
        phase = m['target_phase']
        phases.setdefault(phase, []).append(m)

    # Phase subgraphs
    for phase in sorted(phases.keys()):
        phase_label = PHASE_NAMES.get(phase, phase)
        phase_statuses = [m['status'] for m in phases[phase]]
        if all(s == 'done' for s in phase_statuses):
            phase_class = 'phase_done'
            phase_status = '✅ done'
        elif any(s == 'active' for s in phase_statuses):
            phase_class = 'phase_active'
            phase_status = '🟡 in progress'
        else:
            phase_class = 'phase_planned'
            phase_status = '⚪ planned'

        lines.append(f'    subgraph {phase}["{phase_label} — {phase_status}"]')
        lines.append("        direction LR")
        lines.append("")

        for m in phases[phase]:
            key_safe = m['milestone_key'].replace('-', '_')
            stats = get_task_summary(conn, m['milestone_key'])
            tasks = get_tasks_by_milestone(conn, m['milestone_key'])
            total, done = stats['total'], stats['done']

            # Progress bar
            if total > 0:
                pct = int(done / total * 100)
                bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
                progress_str = f"[{bar}] {done}/{total}"
            else:
                progress_str = "0/0"

            milestone_icon = STATUS_ICON.get(m['status'], '❓')

            # Build task list
            task_lines = []
            for t in tasks:
                t_icon = TASK_ICON.get(t['status'], '⚪')
                r_icon = RISK_ICON.get(t['risk_level'], '⚪')
                t_short = t['title'][:40]
                task_lines.append(f"        {t_icon}{r_icon} {t['item_key']}: {t_short}")

            task_block = "\n".join(task_lines) if task_lines else ""

            lines.append(
                f'        M_{key_safe}["{milestone_icon} {m["milestone_key"]}\n'
                f'          {progress_str} | priority={m["priority"]}\n'
                f'          {task_block}"]'
            )
            lines.append("")

        lines.append("    end")
        lines.append("")

    # Connections
    lines.append("    Root --> phase0")
    lines.append("    phase0 --> phase1")
    lines.append("    phase1 --> phase2")
    lines.append("    phase2 --> phase3")
    lines.append("    phase3 --> phase4")
    lines.append("    phase4 --> phase5")
    lines.append("    phase5 --> phase6")
    lines.append("    phase6 --> phase7")
    lines.append("    phase7 --> phase8")
    lines.append("")

    # Link milestones to phases
    for phase in sorted(phases.keys()):
        for m in phases[phase]:
            key_safe = m['milestone_key'].replace('-', '_')
            lines.append(f"    {phase} --> M_{key_safe}")
    lines.append("")

    lines.append("    class phase0,phase1,phase2,phase3,phase4,phase5,phase6,phase7,phase8 phase_done")

    return "\n".join(lines)


# ── Stats markdown ──────────────────────────────────────────────────────────

def generate_stats(conn, milestones):
    stats = get_all_task_stats(conn)
    total_tasks, done_tasks = stats['total'], stats['done']
    in_progress, todo_tasks, blocked = stats['in_progress'], stats['todo'], stats['blocked']
    total_milestones = len(milestones)
    done_ms = sum(1 for m in milestones if m['status'] == 'done')
    active_ms = sum(1 for m in milestones if m['status'] == 'active')
    planned_ms = sum(1 for m in milestones if m['status'] == 'planned')

    lines = []
    lines.append(f"# 📊 Fantasy Casino Auto — Project Status\n")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    lines.append("## Summary\n")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| **Total Milestones** | {total_milestones} |")
    lines.append(f"| - Done | {done_ms} ✅ |")
    lines.append(f"| - In Progress | {active_ms} 🟡 |")
    lines.append(f"| - Planned | {planned_ms} ⚪ |")
    lines.append(f"| **Total Tasks** | {total_tasks} |")
    lines.append(f"| - Done | {done_tasks} ✅ |")
    lines.append(f"| - In Progress | {in_progress} 🔵 |")
    lines.append(f"| - Todo | {todo_tasks} ⚪ |")
    lines.append(f"| - Blocked | {blocked} 🔴 |")
    pct_str = f"{done_tasks}/{total_tasks} = {done_tasks/total_tasks*100:.1f}%" if total_tasks > 0 else "0%"
    lines.append(f"| **Completion** | {pct_str} |")
    lines.append("")

    lines.append("## Milestones Detail\n")
    lines.append("| Milestone | Phase | Status | Tasks |")
    lines.append("|-----------|-------|--------|-------|")

    for m in milestones:
        s = get_task_summary(conn, m['milestone_key'])
        icon = STATUS_ICON.get(m['status'], '❓')
        total, done = s['total'], s['done']
        if total > 0:
            pct = done / total * 100
            bar = '█' * int(pct // 10) + '░' * (10 - int(pct // 10))
            progress = f"{done}/{total} ({bar} {pct:.0f}%)"
        else:
            progress = "0/0"
        lines.append(f"| {m['milestone_key']} | {m['target_phase']} | {icon} {m['status']} | {progress} |")

    lines.append("")
    lines.append("---")
    lines.append(f"*Source: `agent/plans.db` | Script: `.scripts/project_roadmap.py`*")

    return "\n".join(lines)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    if not DB_PATH.exists():
        print(f"Error: DB not found at {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = query_db()
    milestones = get_milestones(conn)
    mermaid = generate_mermaid(conn, milestones)
    stats_md = generate_stats(conn, milestones)
    conn.close()

    # Output
    output = stats_md + "\n\n" + mermaid

    if '--file' in sys.argv:
        roadmap_md = OUTPUT_DIR / "roadmap.md"
        roadmap_mmd = OUTPUT_DIR / "roadmap.mmd"

        with open(roadmap_md, 'w') as f:
            f.write(output)

        with open(roadmap_mmd, 'w') as f:
            f.write(mermaid + '\n')

        print(f"✅ Saved: {roadmap_md}")
        print(f"✅ Saved: {roadmap_mmd}")
    else:
        print(output)


if __name__ == '__main__':
    main()
