"""
Fantasy Casino — Task Intake Module.

Parses the implementation backlog (research/10-implementation-backlog.md)
to extract tasks with priority and phase classification. Loads them into
SQLite and provides queue management functions.

Follows the task lifecycle from 09-agent-manual.md:
  1. ingest task -> 2. classify risk -> 3. gather context -> ...

Priority classification rules (P0-P9) are based on keyword matching
in task descriptions against the backlog structure.

Risk classification:
  - low: documentation, markdown, comments, glossary, content structure
  - medium: cross-file refactors, test additions, configuration changes
  - high: auth, secrets, money movement, provider adapters, compliance

Usage:
    from agent.task_intake import load_backlog, get_next_task, queue_task

    # Load backlog tasks into SQLite
    load_backlog()

    # Get the highest-priority planned task
    task = get_next_task()
    print(f"Next task: {task['title']}")
"""

import os
import re
import sqlite3

from agent.memory import (
    get_conn,
    create_task,
    update_task_status,
    log_action,
    add_tool,
)

BACKLOG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "research",
    "10-implementation-backlog.md",
)


# ---- Priority classification ----

PRIORITY_KEYWORDS = {
    "P0": [
        "safety", "guardrail", "no-delete", "approval gate", "secret handling",
        "logging schema", "rollback", "quarantine", "control", "no direct deletion",
    ],
    "P1": [
        "local model", "task intake", "planner", "executor", "verifier",
        "telegram", "diff preview", "verification command", "agent loop",
    ],
    "P2": [
        "index", "repository tree", "summarize", "analytics contract",
        "casino-specific", "missing runtime", "change impact",
    ],
    "P3": [
        "safe editing", "sandbox", "patch preview", "rollback snapshot",
        "create file", "update file", "quarantine",
    ],
    "P4": [
        "observability", "token usage", "latency", "command output",
        "verification result", "error pattern", "session artifact",
    ],
    "P5": [
        "skill", "detect project stack", "skill registry", "review skill",
        "activate skill", "install",
    ],
    "P6": [
        "auth model", "session model", "wallet ledger", "bonus engine",
        "provider adapter", "compliance state machine", "audit log",
        "casino runtime",
    ],
    "P7": [
        "analytics", "event emission", "clickhouse", "marts", "dashboard",
        "taxonomy", "metric definition",
    ],
    "P8": [
        "fraud", "responsible gaming", "reconciliation", "incident",
        "multi-user", "risk", "scale",
    ],
    "P9": [
        "visibility", "reputation", "slack", "public", "narrative",
        "diagram", "lesson", "post",
    ],
}


def classify_priority(description: str) -> str:
    """Classify priority level based on keyword matching.

    Checks each priority level's keywords against the description.
    Returns the highest priority (lowest P number) match, or 'P9' as default.
    """
    desc_lower = description.lower()
    for prio in ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]:
        for keyword in PRIORITY_KEYWORDS.get(prio, []):
            if keyword.lower() in desc_lower:
                return prio
    return "P9"


def classify_risk(description: str) -> str:
    """Classify risk level based on keyword matching.

    High risk: auth, secrets, money, provider adapters, compliance
    Medium risk: cross-file refactors, tests, configuration
    Low risk: everything else
    """
    desc_lower = description.lower()

    high_keywords = [
        "auth", "secret", "money", "wallet", "payment", "provider",
        "compliance", "kyc", "risk", "fraud", "token", "credential",
        "permission", "access control", "money movement",
    ]
    medium_keywords = [
        "refactor", "cross-file", "test", "configuration", "config",
        "migration", "schema", "database",
    ]

    for keyword in high_keywords:
        if keyword.lower() in desc_lower:
            return "high"

    for keyword in medium_keywords:
        if keyword.lower() in desc_lower:
            return "medium"

    return "low"


# ---- Backlog parsing ----

def parse_backlog(backlog_path: str = BACKLOG_PATH) -> list:
    """Parse the implementation backlog markdown file.

    Reads the backlog file, extracts sections by priority level,
    and returns a list of task dicts with title, description, priority,
    risk_class, and phase.

    Args:
        backlog_path: Path to the backlog markdown file.

    Returns:
        List of dicts with keys: title, description, priority, risk_class, phase.
    """
    if not os.path.exists(backlog_path):
        print(f"[task_intake] Backlog file not found: {backlog_path}")
        return []

    with open(backlog_path) as f:
        content = f.read()

    tasks = []
    current_phase = None

    for line in content.split("\n"):
        phase_match = re.match(r"^## (P\d+): (.+)", line)
        if phase_match:
            prio_str = phase_match.group(1)
            current_phase = prio_str.lower()
            continue

        task_match = re.match(r"^-\s+(.+)", line)
        if task_match and current_phase:
            title = task_match.group(1).strip()

            # Use priority from phase heading as base, but refine with keyword classification
            refined_priority = classify_priority(title)
            risk = classify_risk(title)

            tasks.append({
                "title": title,
                "description": title,
                "priority": refined_priority,
                "risk_class": risk,
                "phase": current_phase,
            })

    return tasks


def _task_key(task: dict) -> str:
    """Generate a dedup key for a task (lowercased, stripped title)."""
    return task["title"].strip().lower()


def load_backlog(db_path: str = None) -> list:
    """Load backlog tasks into SQLite that don't exist yet.

    Deduplicates by title. Only inserts tasks that are not already in
    the database with the same title (case-insensitive).

    Args:
        db_path: Optional SQLite database path.

    Returns:
        List of newly inserted task dicts.
    """
    tasks = parse_backlog()
    if not tasks:
        return []

    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    existing = conn.execute("SELECT title FROM tasks").fetchall()
    existing_keys = {row["title"].lower() for row in existing}

    inserted = []
    for task in tasks:
        if _task_key(task) not in existing_keys:
            task_id = create_task(
                conn=conn,
                title=task["title"],
                description=task["description"],
                priority=task["priority"],
                risk_class=task["risk_class"],
                phase=task["phase"],
            )
            inserted.append({
                **task,
                "id": task_id,
            })
            existing_keys.add(_task_key(task))
            log_action(
                conn=conn,
                session_id="task_intake",
                role="system",
                action="task_ingested",
                details=f"Task '{task['title']}' ingested with priority={task['priority']}, risk={task['risk_class']}",
                success=True,
            )

    conn.close()

    if inserted:
        print(f"[task_intake] Loaded {len(inserted)} new tasks from backlog.")
    else:
        print("[task_intake] No new tasks to load (already present).")

    return inserted


# ---- Queue management ----

def get_next_task(db_path: str = None) -> dict:
    """Get the highest-priority planned task.

    Returns the task with the lowest P-number that has status='planned'.
    If no planned tasks exist, returns None.

    Args:
        db_path: Optional SQLite database path.

    Returns:
        Task dict or None.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    task = conn.execute(
        "SELECT * FROM tasks WHERE status = 'planned' ORDER BY priority ASC, id ASC LIMIT 1"
    ).fetchone()

    conn.close()

    if task:
        print(f"[task_intake] Next task: [{task['priority']}] #{task['id']} {task['title']}")
    return dict(task) if task else None


def queue_task(title: str, description: str = "", priority: str = "P2",
               risk_class: str = "low", phase: str = None,
               db_path: str = None) -> int:
    """Add a task to the queue manually.

    Args:
        title: Task title.
        description: Task description.
        priority: Priority level (P0-P9).
        risk_class: Risk level (low, medium, high).
        phase: Phase identifier.
        db_path: Optional SQLite database path.

    Returns:
        The task ID.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    task_id = create_task(
        conn=conn,
        title=title,
        description=description,
        priority=priority,
        risk_class=risk_class,
        phase=phase,
    )

    log_action(
        conn=conn,
        session_id="task_intake",
        role="system",
        action="task_queued",
        details=f"Manual queue: {title} (priority={priority})",
        success=True,
    )

    conn.close()
    print(f"[task_intake] Queued task #{task_id}: {title}")
    return task_id


def start_task(task_id: int, db_path: str = None) -> bool:
    """Mark a task as running.

    Args:
        task_id: Task ID to start.
        db_path: Optional SQLite database path.

    Returns:
        True if task was started, False if not found or already running.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        print(f"[task_intake] Task {task_id} not found.")
        conn.close()
        return False

    if task["status"] != "planned":
        print(f"[task_intake] Task {task_id} is already '{task['status']}'.")
        conn.close()
        return False

    update_task_status(conn, task_id, "running")

    log_action(
        conn=conn,
        session_id="task_intake",
        role="planner",
        action="task_started",
        details=f"Task #{task_id} '{task['title']}' started",
        success=True,
    )

    conn.close()
    print(f"[task_intake] Started task #{task_id}: {task['title']}")
    return True


def complete_task(task_id: int, status: str = "done",
                  db_path: str = None) -> bool:
    """Mark a task as completed (or paused/blocked/quarantine).

    Args:
        task_id: Task ID to complete.
        status: Final status (done, paused, blocked, quarantine).
        db_path: Optional SQLite database path.

    Returns:
        True if task was updated, False if not found or not running.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        print(f"[task_intake] Task {task_id} not found.")
        conn.close()
        return False

    if task["status"] != "running":
        print(f"[task_intake] Task {task_id} is not running (status={task['status']}).")
        conn.close()
        return False

    update_task_status(conn, task_id, status)

    log_action(
        conn=conn,
        session_id="task_intake",
        role="system",
        action="task_completed",
        details=f"Task #{task_id} '{task['title']}' completed with status={status}",
        success=status == "done",
    )

    conn.close()
    print(f"[task_intake] Task #{task_id} completed: {task['title']} [{status}]")
    return True


def block_task(task_id: int, reason: str, db_path: str = None) -> bool:
    """Mark a task as blocked.

    Args:
        task_id: Task ID to block.
        reason: Reason for blocking.
        db_path: Optional SQLite database path.

    Returns:
        True if task was blocked, False if not found.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    task = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        print(f"[task_intake] Task {task_id} not found.")
        conn.close()
        return False

    if task["status"] not in ("planned", "running"):
        conn.close()
        print(f"[task_intake] Cannot block task {task_id} (status={task['status']}).")
        return False

    update_task_status(conn, task_id, "blocked")

    log_action(
        conn=conn,
        session_id="task_intake",
        role="reviewer",
        action="task_blocked",
        details=f"Task #{task_id} '{task['title']}' blocked: {reason}",
        success=True,
    )

    conn.close()
    print(f"[task_intake] Task #{task_id} blocked: {reason}")
    return True


def queue_summary(db_path: str = None) -> dict:
    """Return a summary of all tasks in the queue.

    Groups tasks by status and priority. Returns a dict with:
    - total_tasks: total count
    - by_status: dict of status -> count
    - by_priority: dict of priority -> count
    - planned: list of planned tasks
    - running: list of running tasks

    Args:
        db_path: Optional SQLite database path.

    Returns:
        Summary dict.
    """
    conn = get_conn(db_path)
    conn.execute("PRAGMA foreign_keys=ON")

    tasks = conn.execute("SELECT * FROM tasks ORDER BY priority, id").fetchall()
    conn.close()

    by_status = {}
    by_priority = {}
    planned = []
    running = []

    for t in tasks:
        s = t["status"]
        by_status[s] = by_status.get(s, 0) + 1
        p = t["priority"]
        by_priority[p] = by_priority.get(p, 0) + 1

        tdict = dict(t)
        if s == "planned":
            planned.append(tdict)
        elif s == "running":
            running.append(tdict)

    return {
        "total_tasks": len(tasks),
        "by_status": by_status,
        "by_priority": by_priority,
        "planned": planned,
        "running": running,
    }


def register_task_intake_tools(conn: sqlite3.Connection) -> None:
    """Register task intake tools in the SQLite tools table.

    Called automatically by load_backlog() and on module import.
    """
    tools = [
        ("load_backlog", "Parse implementation backlog markdown and load tasks into SQLite", "low"),
        ("get_next_task", "Get the highest-priority planned task from the queue", "low"),
        ("queue_task", "Manually add a task to the task queue", "low"),
        ("start_task", "Mark a task as running (begin execution)", "low"),
        ("complete_task", "Mark a task as done, paused, blocked, or quarantined", "low"),
        ("block_task", "Mark a task as blocked with a reason", "low"),
        ("queue_summary", "Return a structured summary of all tasks in the queue", "low"),
    ]
    for name, purpose, safety in tools:
        add_tool(conn, name, purpose, safety)


if __name__ == "__main__":
    import shutil

    # Use a temporary database for testing
    test_db = "/tmp/fantasy_casino_test_backlog.db"
    if os.path.exists(test_db):
        os.remove(test_db)

    # Copy the real DB or use init_db to set up schema
    real_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.db")
    if os.path.exists(real_db):
        shutil.copy(real_db, test_db)

    conn = get_conn(test_db)
    register_task_intake_tools(conn)
    conn.close()

    print("=" * 60)
    print("  Task Intake Module — Test")
    print("=" * 60)

    # Test 1: parse_backlog
    print("\n1. Parsing backlog...")
    tasks = parse_backlog()
    print(f"   Found {len(tasks)} tasks in backlog.")
    for t in tasks[:5]:
        print(f"   [{t['priority']}] {t['title'][:60]}")
    print(f"   ... ({len(tasks) - 5} more)")

    # Test 2: classify_priority
    print("\n2. Priority classification tests...")
    assert classify_priority("create auth session model") == "P6", "P6 auth test failed"
    assert classify_priority("define approval gates") == "P0", "P0 safety test failed"
    assert classify_priority("add documentation") == "P9", "P9 default test failed"
    assert classify_priority("start local model") == "P1", "P1 model test failed"
    print("   All priority tests passed.")

    # Test 3: classify_risk
    print("\n3. Risk classification tests...")
    assert classify_risk("add auth module") == "high", "high risk test failed"
    assert classify_risk("add unit tests") == "medium", "medium risk test failed"
    assert classify_risk("fix typo in README") == "low", "low risk test failed"
    assert classify_risk("change wallet ledger schema") == "high", "money risk test failed"
    print("   All risk tests passed.")

    # Test 4: load_backlog
    print("\n4. Loading backlog into SQLite...")
    inserted = load_backlog(test_db)
    print(f"   Inserted {len(inserted)} tasks.")

    # Test 5: get_next_task
    print("\n5. Getting next task...")
    next_task = get_next_task(test_db)
    if next_task:
        print(f"   Next: [{next_task['priority']}] {next_task['title']}")

    # Test 6: queue_task / start_task / complete_task
    print("\n6. Queue lifecycle test...")
    tid = queue_task("test task", "A test task for lifecycle", "P1", "low", "p1")
    assert start_task(tid), f"Failed to start task {tid}"
    assert complete_task(tid), f"Failed to complete task {tid}"
    print(f"   Task #{tid} lifecycle: planned -> running -> done")

    # Test 7: block_task
    print("\n7. Block task test...")
    tid2 = queue_task("blocked test", "Should be blocked", "P2", "low", "p2")
    assert start_task(tid2), f"Failed to start task {tid2}"
    assert block_task(tid2, "waiting on dependency"), f"Failed to block task {tid2}"
    print(f"   Task #{tid2} blocked: waiting on dependency")

    # Test 8: queue_summary
    print("\n8. Queue summary...")
    summary = queue_summary(test_db)
    print(f"   Total tasks: {summary['total_tasks']}")
    print(f"   By status: {summary['by_status']}")
    print(f"   By priority: {summary['by_priority']}")
    print(f"   Planned: {len(summary['planned'])}, Running: {len(summary['running'])}")

    conn = get_conn(test_db)
    sql = """SELECT name FROM tools
             WHERE name LIKE '%task_intake%'
                OR name IN ('load_backlog','get_next_task','queue_task',
                            'start_task','complete_task','block_task','queue_summary')"""
    tools = conn.execute(sql).fetchall()
    conn.close()
    print(f"\n9. Tools registered: {[t['name'] for t in tools]}")

    # Cleanup
    if os.path.exists(test_db):
        os.remove(test_db)

    print("\nAll tests passed.")
