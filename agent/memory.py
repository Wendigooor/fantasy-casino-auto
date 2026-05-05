"""
Fantasy Casino — SQLite helper for agent operations.

Provides read/write access to plans.db with convenience methods
for task lifecycle, checkpoints, logging, and state management.
"""

import sqlite3
import os
from datetime import datetime, timezone

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "plans.db")


def get_conn(db_path: str = None) -> sqlite3.Connection:
    if db_path is None:
        db_path = DB_PATH
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---- Project state ----

def get_project_state(conn: sqlite3.Connection) -> dict:
    cur = conn.execute("SELECT key, value FROM project_state")
    return {row["key"]: row["value"] for row in cur.fetchall()}


def set_project_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO project_state (key, value, updated_at) VALUES (?, ?, ?)",
        (key, value, now()),
    )


# ---- Tasks ----

def get_task(conn: sqlite3.Connection, task_id: int):
    cur = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    return cur.fetchone()


def get_tasks(conn: sqlite3.Connection, status=None, priority=None, phase=None):
    sql = "SELECT * FROM tasks WHERE 1=1"
    params = []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if priority:
        sql += " AND priority = ?"
        params.append(priority)
    if phase:
        sql += " AND phase = ?"
        params.append(phase)
    sql += " ORDER BY priority, id"
    return conn.execute(sql, params).fetchall()


def update_task_status(conn: sqlite3.Connection, task_id: int, status: str) -> None:
    fields = []
    params = []
    fields.append("status = ?")
    params.append(status)
    fields.append("updated_at = ?")
    params.append(now())
    if status == "running":
        fields.append("started_at = ?")
        params.append(now())
    elif status == "done":
        fields.append("completed_at = ?")
        params.append(now())
    sql = f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?"
    params.append(task_id)
    conn.execute(sql, params)


def create_task(
    conn: sqlite3.Connection,
    title: str,
    description: str = "",
    priority: str = "P2",
    risk_class: str = "low",
    phase: str = None,
) -> int:
    conn.execute(
        """INSERT INTO tasks (title, description, priority, status, risk_class, phase, created_at, updated_at)
           VALUES (?, ?, ?, 'planned', ?, ?, ?, ?)""",
        (title, description, priority, risk_class, phase, now(), now()),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


# ---- Checkpoints ----

def create_checkpoint(
    conn: sqlite3.Connection,
    task_id: int,
    project_state: str,
    summary: str,
    changed_files: str = None,
    next_step: str = None,
    blockers: str = None,
    tool_set: str = None,
) -> int:
    cur = conn.execute(
        """INSERT INTO checkpoints (task_id, project_state, summary, changed_files,
           next_step, blockers, tool_set, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (task_id, project_state, summary, changed_files, next_step, blockers, tool_set, now()),
    )
    conn.execute("UPDATE tasks SET checkpoint_id = ? WHERE id = ?", (cur.lastrowid, task_id))
    conn.commit()
    return cur.lastrowid


def get_last_checkpoint(conn: sqlite3.Connection, task_id: int):
    cur = conn.execute(
        "SELECT * FROM checkpoints WHERE task_id = ? ORDER BY id DESC LIMIT 1",
        (task_id,),
    )
    return cur.fetchone()


# ---- Logs ----

def log_action(
    conn: sqlite3.Connection,
    session_id: str,
    role: str,
    action: str,
    details: str = None,
    output: str = None,
    success: bool = True,
    tokens_used: int = 0,
    latency_ms: int = None,
) -> int:
    cur = conn.execute(
        """INSERT INTO logs (session_id, role, action, details, output, success,
           tokens_used, latency_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, role, action, details, output, int(success), tokens_used, latency_ms, now()),
    )
    conn.commit()
    return cur.lastrowid


def get_session_logs(conn: sqlite3.Connection, session_id: str):
    return conn.execute(
        "SELECT * FROM logs WHERE session_id = ? ORDER BY id", (session_id,)
    ).fetchall()


# ---- Token usage ----

def record_token_usage(
    conn: sqlite3.Connection,
    session_id: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    cost_estimate: float = 0,
) -> None:
    conn.execute(
        """INSERT INTO token_usage (session_id, model, tokens_in, tokens_out, cost_estimate, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, model, tokens_in, tokens_out, cost_estimate, now()),
    )
    conn.commit()


# ---- Artifacts ----

def add_artifact(
    conn: sqlite3.Connection,
    task_id: int,
    artifact_type: str,
    path: str,
    reference: str = None,
    summary: str = None,
) -> int:
    cur = conn.execute(
        """INSERT INTO artifacts (task_id, artifact_type, path, reference, summary, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (task_id, artifact_type, path, reference, summary, now()),
    )
    conn.commit()
    return cur.lastrowid


# ---- Tools ----

def get_active_tools(conn: sqlite3.Connection):
    return conn.execute(
        "SELECT * FROM tools WHERE active = 1 ORDER BY name"
    ).fetchall()


def add_tool(
    conn: sqlite3.Connection,
    name: str,
    purpose: str = None,
    safety_class: str = "low",
    version: str = "1",
) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO tools (name, purpose, safety_class, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, purpose, safety_class, version, now(), now()),
    )
    conn.commit()


# ---- Skills ----

def get_skills(conn: sqlite3.Connection, review_status=None):
    sql = "SELECT * FROM skills WHERE 1=1"
    params = []
    if review_status:
        sql += " AND review_status = ?"
        params.append(review_status)
    return conn.execute(sql, params).fetchall()


def add_skill(
    conn: sqlite3.Connection,
    name: str,
    trigger_condition: str = None,
    description: str = None,
    required_tools: str = None,
    expected_output: str = None,
    known_limitations: str = None,
) -> int:
    cur = conn.execute(
        """INSERT INTO skills (name, trigger_condition, description, required_tools,
           expected_output, known_limitations, review_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
        (name, trigger_condition, description, required_tools, expected_output, known_limitations, now()),
    )
    conn.commit()
    return cur.lastrowid


# ---- Status summary ----

# ---- Token summary ----

def get_token_summary(conn: sqlite3.Connection, session_id: str = None):
    """Return token usage summary, optionally filtered by session.

    Args:
        conn: SQLite connection.
        session_id: Optional session to filter by.

    Returns:
        Dict with total tokens breakdown.
    """
    sql = (
        "SELECT COALESCE(SUM(tokens_in), 0) as total_in, "
        "COALESCE(SUM(tokens_out), 0) as total_out, "
        "COUNT(*) as call_count, "
        "COALESCE(SUM(cost_estimate), 0) as total_cost "
        "FROM token_usage"
    )
    params = []
    if session_id:
        sql += " WHERE session_id = ?"
        params.append(session_id)

    row = conn.execute(sql, params).fetchone()
    return {
        "total_tokens_in": row["total_in"],
        "total_tokens_out": row["total_out"],
        "total_tokens": row["total_in"] + row["total_out"],
        "total_calls": row["call_count"],
        "total_cost_estimate": row["total_cost"],
    }


def get_status_summary(conn: sqlite3.Connection):
    """Return a compact summary of the current project state."""
    state = get_project_state(conn)
    tasks = get_tasks(conn)

    status_counts = {}
    for t in tasks:
        s = t["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    next_task = None
    for t in tasks:
        if t["status"] == "planned":
            next_task = {
                "id": t["id"],
                "title": t["title"],
                "priority": t["priority"],
                "risk": t["risk_class"],
            }
            break

    return {
        "project_state": state.get("current_state", "unknown"),
        "session_id": state.get("session_id", "unknown"),
        "started_at": state.get("started_at", "unknown"),
        "task_counts": status_counts,
        "total_tasks": len(tasks),
        "next_task": next_task,
    }


def print_status(db_path: str = DB_PATH):
    """Print a human-readable status report."""
    conn = get_conn(db_path)
    summary = get_status_summary(conn)
    token_stats = get_token_summary(conn)

    print("\n" + "=" * 60)
    print("  FANTASY CASINO — STATUS")
    print("=" * 60)
    print(f"  Project:    {summary['project_state']}")
    print(f"  Session:    {summary['session_id']}")
    print(f"  Started:    {summary['started_at']}")
    print(f"  Total tasks: {summary['total_tasks']}")
    print()

    counts = summary["task_counts"]
    if counts:
        print("  Task breakdown:")
        for status, count in sorted(counts.items()):
            print(f"    {status:15s} {count}")
    else:
        print("  No tasks yet.")

    if summary["next_task"]:
        nt = summary["next_task"]
        print(f"\n  Next task:   [{nt['priority']}] {nt['title']}")

    print()
    ts = token_stats
    print(f"  Token usage:  in={ts['total_tokens_in']}, out={ts['total_tokens_out']}, total={ts['total_tokens']}")
    print(f"  API calls:    {ts['total_calls']}")
    if token_stats['total_cost_estimate'] > 0:
        print(f"  Est. cost:    ${token_stats['total_cost_estimate']:.4f}")
    print("=" * 60 + "\n")

    conn.close()


if __name__ == "__main__":
    print_status()
