"""
Fantasy Casino — task orchestration layer.

This module provides a typed, SQLite-backed kanban for local-agent execution.
It is intentionally deterministic: the agent should call these helpers through
`taskctl.py` instead of writing ad hoc SQL in shell commands.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from agent.memory import get_conn, now

# ── Inline schema (was in agent/init_db.py, removed) ──────────────────

_ORCHESTRATION_SQL = """
CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK(status IN ('planned','active','blocked','done','cancelled')),
    priority INTEGER NOT NULL DEFAULT 3,
    target_phase TEXT,
    acceptance_criteria TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_key TEXT NOT NULL UNIQUE,
    parent_work_item_id INTEGER REFERENCES work_items(id),
    milestone_id INTEGER REFERENCES milestones(id),
    source_task_id INTEGER REFERENCES tasks(id),
    kind TEXT NOT NULL DEFAULT 'task'
        CHECK(kind IN ('epic','task','subtask','bug','chore','research','review')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo'
        CHECK(status IN ('todo','in_progress','blocked','needs_review','done','failed','obsolete','superseded')),
    priority INTEGER NOT NULL DEFAULT 3,
    risk_level TEXT NOT NULL DEFAULT 'low'
        CHECK(risk_level IN ('low','medium','high','critical')),
    scope_files TEXT,
    acceptance_criteria TEXT,
    verification_command TEXT,
    stale_check TEXT,
    resume_hint TEXT,
    claimed_by TEXT,
    claim_token TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    verification_status TEXT CHECK(verification_status IN ('not_run','passed','failed','skipped')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    claimed_at TEXT,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_item_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_item_id INTEGER NOT NULL REFERENCES work_items(id),
    log_type TEXT NOT NULL
        CHECK(log_type IN ('summary','progress','verification','blocker','discovery','review')),
    message TEXT NOT NULL,
    changed_files TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_item_artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_item_id INTEGER NOT NULL REFERENCES work_items(id),
    artifact_type TEXT NOT NULL
        CHECK(artifact_type IN ('plan','patch','test_output','report','checkpoint','other')),
    path TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL
);
"""


def ensure_orchestration_schema(conn) -> None:
    for stmt in _ORCHESTRATION_SQL.strip().split(";"):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)


DEFAULT_AGENT_NAME = "local-agent"


def _json_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=True)


def ensure_schema(db_path: str | None = None) -> None:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        conn.commit()
    finally:
        conn.close()


def create_milestone(
    milestone_key: str,
    title: str,
    description: str = "",
    status: str = "planned",
    priority: int = 3,
    target_phase: str | None = None,
    acceptance_criteria: list[str] | None = None,
    notes: str | None = None,
    db_path: str | None = None,
) -> int:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        conn.execute(
            """INSERT INTO milestones (
                   milestone_key, title, description, status, priority,
                   target_phase, acceptance_criteria, notes, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(milestone_key) DO UPDATE SET
                   title = excluded.title,
                   description = excluded.description,
                   status = excluded.status,
                   priority = excluded.priority,
                   target_phase = excluded.target_phase,
                   acceptance_criteria = excluded.acceptance_criteria,
                   notes = excluded.notes,
                   updated_at = excluded.updated_at
            """,
            (
                milestone_key,
                title,
                description,
                status,
                priority,
                target_phase,
                _json_text(acceptance_criteria),
                notes,
                now(),
                now(),
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id FROM milestones WHERE milestone_key = ?",
            (milestone_key,),
        ).fetchone()
        return row["id"]
    finally:
        conn.close()


def list_milestones(db_path: str | None = None) -> list[dict[str, Any]]:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        rows = conn.execute(
            """SELECT id, milestone_key, title, description, status, priority,
                      target_phase, acceptance_criteria, notes,
                      created_at, updated_at, started_at, completed_at
               FROM milestones
               ORDER BY priority ASC, id ASC"""
        ).fetchall()
        return [_row_to_dict(row) for row in rows]
    finally:
        conn.close()


def create_work_item(
    item_key: str,
    title: str,
    description: str,
    milestone_id: int | None = None,
    parent_work_item_id: int | None = None,
    source_task_id: int | None = None,
    kind: str = "task",
    status: str = "todo",
    priority: int = 3,
    risk_level: str = "low",
    scope_files: list[str] | None = None,
    acceptance_criteria: list[str] | None = None,
    verification_command: str | None = None,
    stale_check: str | None = None,
    resume_hint: str | None = None,
    db_path: str | None = None,
) -> int:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        conn.execute(
            """INSERT INTO work_items (
                   item_key, parent_work_item_id, milestone_id, source_task_id, kind,
                   title, description, status, priority, risk_level, scope_files,
                   acceptance_criteria, verification_command, stale_check, resume_hint,
                   verification_status, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_run', ?, ?)
               ON CONFLICT(item_key) DO UPDATE SET
                   parent_work_item_id = excluded.parent_work_item_id,
                   milestone_id = excluded.milestone_id,
                   source_task_id = excluded.source_task_id,
                   kind = excluded.kind,
                   title = excluded.title,
                   description = excluded.description,
                   status = excluded.status,
                   priority = excluded.priority,
                   risk_level = excluded.risk_level,
                   scope_files = excluded.scope_files,
                   acceptance_criteria = excluded.acceptance_criteria,
                   verification_command = excluded.verification_command,
                   stale_check = excluded.stale_check,
                   resume_hint = excluded.resume_hint,
                   updated_at = excluded.updated_at
            """,
            (
                item_key,
                parent_work_item_id,
                milestone_id,
                source_task_id,
                kind,
                title,
                description,
                status,
                priority,
                risk_level,
                _json_text(scope_files or []),
                _json_text(acceptance_criteria or []),
                verification_command,
                stale_check,
                resume_hint,
                now(),
                now(),
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id FROM work_items WHERE item_key = ?",
            (item_key,),
        ).fetchone()
        return row["id"]
    finally:
        conn.close()


def list_work_items(
    status: str | None = None,
    milestone_key: str | None = None,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        sql = """
            SELECT wi.*, m.milestone_key
            FROM work_items wi
            LEFT JOIN milestones m ON m.id = wi.milestone_id
            WHERE 1 = 1
        """
        params: list[Any] = []
        if status:
            sql += " AND wi.status = ?"
            params.append(status)
        if milestone_key:
            sql += " AND m.milestone_key = ?"
            params.append(milestone_key)
        sql += " ORDER BY wi.priority ASC, wi.id ASC"
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_dict(row) for row in rows]
    finally:
        conn.close()


def get_work_item(item_id: int, db_path: str | None = None) -> dict[str, Any] | None:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        row = conn.execute(
            """SELECT wi.*, m.milestone_key
               FROM work_items wi
               LEFT JOIN milestones m ON m.id = wi.milestone_id
               WHERE wi.id = ?""",
            (item_id,),
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_next_work_item(
    include_in_progress: bool = True,
    db_path: str | None = None,
) -> dict[str, Any] | None:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        statuses = ["in_progress", "todo"] if include_in_progress else ["todo"]
        placeholders = ", ".join("?" for _ in statuses)
        row = conn.execute(
            f"""SELECT wi.*, m.milestone_key
                FROM work_items wi
                LEFT JOIN milestones m ON m.id = wi.milestone_id
                WHERE wi.status IN ({placeholders})
                ORDER BY CASE wi.status WHEN 'in_progress' THEN 0 ELSE 1 END,
                         wi.priority ASC, wi.id ASC
                LIMIT 1""",
            statuses,
        ).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def claim_work_item(
    item_id: int,
    claimed_by: str = DEFAULT_AGENT_NAME,
    db_path: str | None = None,
) -> dict[str, Any]:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        row = conn.execute(
            "SELECT status, attempt_count FROM work_items WHERE id = ?",
            (item_id,),
        ).fetchone()
        if not row:
            raise ValueError(f"Work item not found: {item_id}")
        if row["status"] not in ("todo", "in_progress", "blocked"):
            raise ValueError(f"Cannot claim work item in status={row['status']}")
        token = str(uuid.uuid4())
        conn.execute(
            """UPDATE work_items
               SET status = 'in_progress',
                   claimed_by = ?,
                   claim_token = ?,
                   attempt_count = attempt_count + 1,
                   claimed_at = COALESCE(claimed_at, ?),
                   updated_at = ?
               WHERE id = ?""",
            (claimed_by, token, now(), now(), item_id),
        )
        conn.commit()
        log_work_item(item_id, "progress", f"Claimed by {claimed_by}", db_path=db_path)
        item = get_work_item(item_id, db_path=db_path)
        item["claim_token"] = token
        return item
    finally:
        conn.close()


def update_work_item_status(
    item_id: int,
    status: str,
    message: str | None = None,
    resume_hint: str | None = None,
    verification_status: str | None = None,
    last_error: str | None = None,
    db_path: str | None = None,
) -> None:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        updates = ["status = ?", "updated_at = ?"]
        params: list[Any] = [status, now()]
        if resume_hint is not None:
            updates.append("resume_hint = ?")
            params.append(resume_hint)
        if verification_status is not None:
            updates.append("verification_status = ?")
            params.append(verification_status)
        if last_error is not None:
            updates.append("last_error = ?")
            params.append(last_error)
        if status in ("done", "obsolete", "superseded"):
            updates.append("completed_at = ?")
            params.append(now())
        params.append(item_id)
        conn.execute(
            f"UPDATE work_items SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        conn.commit()
        if message:
            log_type = "summary" if status in ("done", "obsolete", "superseded") else "progress"
            log_work_item(item_id, log_type, message, db_path=db_path)
    finally:
        conn.close()


def log_work_item(
    item_id: int,
    log_type: str,
    message: str,
    changed_files: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
    db_path: str | None = None,
) -> int:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        cur = conn.execute(
            """INSERT INTO work_item_logs (
                   work_item_id, log_type, message, changed_files, metadata, created_at
               ) VALUES (?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                log_type,
                message,
                _json_text(changed_files or []),
                _json_text(metadata or {}),
                now(),
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def add_work_item_artifact(
    item_id: int,
    artifact_type: str,
    path: str,
    summary: str | None = None,
    db_path: str | None = None,
) -> int:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        cur = conn.execute(
            """INSERT INTO work_item_artifacts (
                   work_item_id, artifact_type, path, summary, created_at
               ) VALUES (?, ?, ?, ?, ?)""",
            (item_id, artifact_type, path, summary, now()),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def get_recent_logs(
    item_id: int | None = None,
    limit: int = 5,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    conn = get_conn(db_path)
    try:
        ensure_orchestration_schema(conn)
        if item_id is None:
            rows = conn.execute(
                """SELECT wil.*, wi.item_key
                   FROM work_item_logs wil
                   JOIN work_items wi ON wi.id = wil.work_item_id
                   ORDER BY wil.id DESC
                   LIMIT ?""",
                (limit,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT wil.*, wi.item_key
                   FROM work_item_logs wil
                   JOIN work_items wi ON wi.id = wil.work_item_id
                   WHERE wil.work_item_id = ?
                   ORDER BY wil.id DESC
                   LIMIT ?""",
                (item_id, limit),
            ).fetchall()
        return [_row_to_dict(row) for row in rows]
    finally:
        conn.close()


def build_execution_context(item_id: int, db_path: str | None = None) -> dict[str, Any]:
    item = get_work_item(item_id, db_path=db_path)
    if not item:
        raise ValueError(f"Work item not found: {item_id}")
    logs = get_recent_logs(item_id=item_id, limit=5, db_path=db_path)
    milestone = None
    if item.get("milestone_key"):
        milestone = next(
            (m for m in list_milestones(db_path=db_path) if m["milestone_key"] == item["milestone_key"]),
            None,
        )
    return {
        "work_item": item,
        "milestone": milestone,
        "recent_logs": list(reversed(logs)),
    }


def seed_initial_execution_plan(db_path: str | None = None) -> dict[str, int]:
    ensure_schema(db_path=db_path)
    milestone_id = create_milestone(
        "phase0-agent-rails",
        "Phase 0: Stabilize Agent Rails",
        description="Make the local agent loop safe, resumable, and context-efficient before deeper product work.",
        status="active",
        priority=1,
        target_phase="phase0",
        acceptance_criteria=[
            "Agent task orchestration lives in SQLite with deterministic helpers.",
            "A single task can be claimed, completed, blocked, or marked obsolete safely.",
            "Resume context can be rebuilt without replaying the whole chat history.",
        ],
        db_path=db_path,
    )
    items = [
        (
            "phase0-001",
            "Create SQLite-backed task orchestration layer",
            "Add milestone/work-item tables and typed helpers so the agent never has to write raw SQL in shell commands.",
            ["agent/init_db.py", "agent/taskboard.py", "agent/taskctl.py"],
            ["Schema exists.", "Typed helpers exist.", "CLI can initialize and list work items."],
            "python3 -m py_compile agent/init_db.py agent/taskboard.py agent/taskctl.py",
        ),
        (
            "phase0-002",
            "Document local-agent operating rules",
            "Create a short contract that defines task size, status model, context rules, and resume expectations.",
            ["docs/LOCAL_AGENT_OPERATING_RULES.md", "docs/PRODUCTION_CASINO_BUILD_INSTRUCTIONS.md"],
            ["Rules are explicit.", "Resume instructions are short.", "Task sizing rules are present."],
            "python3 -m py_compile agent/taskctl.py",
        ),
        (
            "phase0-003",
            "Fix agent safety and runtime hygiene bugs",
            "Apply the currently known review findings so execution is safer before broader automation continues.",
            [
                "agent/orchestrator/executor.py",
                "agent/analytics_contract.py",
                "agent/repo_summary.py",
                ".gitignore",
            ],
            ["Known P1/P2 bugs are resolved.", "Generated runtime artifacts are not committed."],
            "python3 -m py_compile agent/orchestrator/executor.py agent/analytics_contract.py agent/repo_summary.py",
        ),
    ]
    created = 0
    for item_key, title, description, scope_files, acceptance, verify_cmd in items:
        create_work_item(
            item_key=item_key,
            milestone_id=milestone_id,
            kind="task",
            title=title,
            description=description,
            priority=1 if item_key == "phase0-001" else 2,
            risk_level="medium" if item_key != "phase0-002" else "low",
            scope_files=scope_files,
            acceptance_criteria=acceptance,
            verification_command=verify_cmd,
            stale_check="Check existing files first; mark obsolete if the capability already exists and verification passes.",
            db_path=db_path,
        )
        created += 1
    return {"milestones": 1, "work_items": created}


def _row_to_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    data = dict(row)
    for key in ("scope_files", "acceptance_criteria", "changed_files", "metadata"):
        if key in data and data[key]:
            try:
                data[key] = json.loads(data[key])
            except json.JSONDecodeError:
                pass
    return data
