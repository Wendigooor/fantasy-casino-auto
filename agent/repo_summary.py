"""
Fantasy Casino — Research Page Summarizer.

Scans the research/ directory, generates summaries for each markdown page,
and stores them in the SQLite database for quick retrieval.

Usage:
    from agent.repo_summary import (
        summarize_file, summarize_research_dir,
        index_pages_to_db, get_page_summaries, print_summary
    )

    summaries = summarize_research_dir()
    print_summary()
"""

import os
import sys
import json
import re
import sqlite3

_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)

KEYWORDS = [
    ("security", [
        "security", "auth", "authentication", "authorization",
        "permission", "privilege", "access", "vulnerability", "exploit",
        "injection", "csrf", "xss", "encryption", "hash", "salt",
        "secret", "credential", "token",
    ]),
    ("auth", [
        "login", "logout", "session", "jwt", "oauth", "sso",
        "mfa", "2fa", "password", "signin", "signup",
    ]),
    ("wallet", [
        "wallet", "balance", "deposit", "withdraw", "transaction",
        "ledger", "funds", "payment", "payout", "bankroll",
    ]),
    ("game", [
        "game", "slot", "roulette", "poker", "blackjack", "bet",
        "spin", "round", "dealer", "table", "hand", "cards", "dice",
    ]),
    ("bonus", [
        "bonus", "promotion", "reward", "free_spin", "cashback",
        "match", "reload", "welcome", "loyalty", "vip", "tier",
        "gamification", "achievement",
    ]),
    ("kyc", [
        "kyc", "verify", "verification", "identity", "passport",
        "document", "compliance", "aml", "sanction", "pep",
    ]),
    ("analytics", [
        "analytics", "event", "metric", "tracking", "dashboard",
        "report", "clickhouse", "telemetry", "funnel", "cohort",
    ]),
    ("admin", [
        "admin", "administrator", "management", "panel", "console",
        "control", "moderation", "flag", "ban", "suspend",
    ]),
    ("api", [
        "api", "endpoint", "route", "rest", "graphql", "webhook",
        "request", "response", "header", "middleware", "rate limit",
    ]),
    ("database", [
        "database", "db", "sql", "postgresql", "sqlite",
        "migration", "schema", "table", "index", "query", "orm",
    ]),
    ("frontend", [
        "frontend", "ui", "interface", "component", "page",
        "template", "css", "html", "react", "vue", "angular",
    ]),
    ("agent", [
        "agent", "orchestrator", "planner", "executor", "task",
        "pipeline", "workflow", "automation", "ai", "llm",
        "prompt", "context",
    ]),
]

SIZE_LABELS = [
    (100, "very small"),
    (2000, "small"),
    (10000, "medium"),
    (50000, "large"),
    (200000, "very large"),
]


def _size_label(size_bytes):
    for threshold, label in SIZE_LABELS:
        if size_bytes < threshold:
            return label
    return "huge"


def _detect_keywords(content):
    content_lower = content.lower()
    matches = []
    for keyword, patterns in KEYWORDS:
        if any(p in content_lower for p in patterns):
            matches.append(keyword)
    return sorted(set(matches))


def _first_header(content):
    m = re.search(r"^(?:#+\s+)(.+)$", content, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return ""


def _build_summary(file_type, first_line, keywords, size, line_count):
    parts = []
    parts.append("{}. {}.".format(file_type.title(), first_line if first_line else "No header found"))
    size_label = _size_label(size)
    parts.append("{} file, {}.".format(size_label, _format_lines(line_count)))
    if keywords:
        parts.append("Keywords: {}.".format(", ".join(keywords)))
    return " ".join(parts)


def _format_lines(n):
    if n < 50:
        return "few lines"
    if n < 200:
        return "~{} lines".format(n)
    if n < 1000:
        return "~{} lines".format(n)
    if n < 5000:
        return "a few thousand lines"
    return "thousands of lines"


def summarize_file(filepath, max_chars=500):
    """Summarize a single file.

    Reads the first 30 lines of the file, detects the file type,
    extracts the first header, and identifies relevant keywords.

    Args:
        filepath: Path to the file to summarize.
        max_chars: Unused, kept for API compatibility.

    Returns:
        Dict with path, file_type, size, line_count, first_lines, summary.
    """
    if not os.path.isfile(filepath):
        return {
            "path": filepath,
            "file_type": "unknown",
            "size": 0,
            "line_count": 0,
            "first_lines": "",
            "summary": "File not found: {}".format(filepath),
        }

    _, ext = os.path.splitext(filepath)
    file_type_map = {
        ".py": "python",
        ".md": "markdown",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".sh": "shell",
        ".html": "html",
        ".css": "css",
        ".js": "javascript",
        ".sql": "sql",
        ".txt": "text",
        ".toml": "toml",
        ".cfg": "config",
        ".env": "environment",
    }
    file_type = file_type_map.get(ext.lower(), "other")

    size = os.path.getsize(filepath)

    first_lines_list = []
    full_content = ""
    try:
        with open(filepath, "r", errors="replace") as f:
            for i in range(30):
                line = f.readline()
                if not line:
                    break
                first_lines_list.append(line.rstrip())
            f.seek(0)
            full_content = f.read()
    except Exception:
        pass

    # Real line count from full content, not just first 30 lines
    line_count = full_content.count("\n") + (1 if full_content and not full_content.endswith("\n") else 0)
    first_lines_text = "\n".join(first_lines_list)

    first_header = _first_header(full_content)
    if not first_header and first_lines_list:
        first_header = first_lines_list[0].strip()[:120]

    keywords = _detect_keywords(full_content)

    summary = _build_summary(file_type, first_header, keywords, size, line_count)

    return {
        "path": filepath,
        "file_type": file_type,
        "size": size,
        "line_count": line_count,
        "first_lines": first_lines_text,
        "summary": summary,
    }


def summarize_research_dir(repo_root=None, db_path=None):
    """Scan the research/ directory and summarize all .md files.

    Args:
        repo_root: Repository root. Defaults to parent of agent/.
        db_path: Unused, kept for API consistency with other functions.

    Returns:
        Dict with "pages" list of summaries and "summary" combined overview.
    """
    if repo_root is None:
        repo_root = _PARENT

    research_dir = os.path.join(repo_root, "research")
    if not os.path.isdir(research_dir):
        return {"pages": [], "summary": "No research/ directory found."}

    try:
        md_files = sorted([
            f for f in os.listdir(research_dir)
            if f.endswith(".md") and os.path.isfile(os.path.join(research_dir, f))
        ])
    except OSError:
        return {"pages": [], "summary": "Cannot read research/ directory."}

    pages = []
    all_keywords = []
    total_lines = 0
    total_size = 0

    for fname in md_files:
        fpath = os.path.join(research_dir, fname)
        page = summarize_file(fpath)
        pages.append(page)

        keywords = []
        if page.get("summary"):
            summary_lower = page["summary"].lower()
            for kw, _ in KEYWORDS:
                if kw in summary_lower:
                    keywords.append(kw)
        all_keywords.extend(keywords)
        total_lines += page.get("line_count", 0)
        total_size += page.get("size", 0)

    combined = []
    combined.append("{} research pages analyzed.".format(len(pages)))
    combined.append("Total size: {} bytes, ~{} lines.".format(
        total_size, _format_lines(total_lines)))
    if all_keywords:
        unique_kw = sorted(set(all_keywords))
        combined.append("Dominant topics: {}.".format(", ".join(unique_kw)))
    combined.append("Files:")
    for p in pages:
        path_short = p["path"].replace(research_dir + "/", "")
        combined.append("  - {}: {}".format(path_short, p.get("summary", "")[:80]))

    return {
        "pages": pages,
        "summary": " ".join(combined),
    }


def _ensure_pages_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS research_pages (
            doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            file_type TEXT,
            size INTEGER,
            line_count INTEGER,
            first_lines TEXT,
            summary TEXT,
            keywords TEXT,
            indexed_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS repo_index (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT,
            relative_path TEXT UNIQUE,
            file_type TEXT,
            size_bytes INTEGER,
            line_count INTEGER,
            first_lines TEXT,
            has_imports INTEGER,
            imports TEXT,
            has_classes INTEGER,
            classes TEXT,
            has_functions INTEGER,
            functions TEXT,
            tags TEXT,
            last_modified TEXT,
            indexed_at TEXT,
            summary TEXT
        )
    """)
    conn.commit()


def index_pages_to_db(repo_root=None, db_path=None):
    """Store page summaries in the database.

    Updates the research_pages table with latest summaries.
    Also adds a 'summary' column to repo_index if it does not exist.

    Args:
        repo_root: Repository root. Defaults to parent of agent/.
        db_path: Path to SQLite DB. Defaults to agent/plans.db.

    Returns:
        Number of pages indexed.
    """
    if db_path is None:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.db")
    if repo_root is None:
        repo_root = _PARENT

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    _ensure_pages_table(conn)

    research_dir = os.path.join(repo_root, "research")
    if not os.path.isdir(research_dir):
        conn.close()
        return 0

    try:
        md_files = sorted([
            f for f in os.listdir(research_dir)
            if f.endswith(".md") and os.path.isfile(os.path.join(research_dir, f))
        ])
    except OSError:
        conn.close()
        return 0

    from datetime import datetime, timezone
    indexed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    count = 0
    try:
        for fname in md_files:
            fpath = os.path.join(research_dir, fname)
            page = summarize_file(fpath)

            keywords = page.get("keywords", [])
            keywords_json = json.dumps(keywords) if isinstance(keywords, list) else ""

            conn.execute("""
                INSERT OR REPLACE INTO research_pages (
                    path, file_type, size, line_count, first_lines,
                    summary, keywords, indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                page["path"], page["file_type"], page["size"],
                page["line_count"], page["first_lines"],
                page["summary"], keywords_json, indexed_at,
            ))
            count += 1
    finally:
        conn.commit()
        conn.close()
    return count


def get_page_summaries(db_path=None):
    """Read page summaries from the database.

    Args:
        db_path: Path to SQLite DB. Defaults to agent/plans.db.

    Returns:
        List of page summary dicts ordered by doc_id.
    """
    if db_path is None:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.db")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        _ensure_pages_table(conn)

        rows = conn.execute(
            "SELECT * FROM research_pages ORDER BY doc_id"
        ).fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        entry = {
            "doc_id": row["doc_id"],
            "path": row["path"],
            "file_type": row["file_type"],
            "size": row["size"],
            "line_count": row["line_count"],
            "first_lines": row["first_lines"],
            "summary": row["summary"],
            "keywords": json.loads(row["keywords"]) if row["keywords"] else [],
            "indexed_at": row["indexed_at"],
        }
        result.append(entry)
    return result


def print_summary(db_path=None):
    """Print a human-readable summary of the research repository.

    Args:
        db_path: Path to SQLite DB. Defaults to agent/plans.db.
    """
    result = summarize_research_dir()

    print("\n" + "=" * 70)
    print("  RESEARCH PAGE SUMMARY")
    print("=" * 70)
    print("\n" + result["summary"] + "\n")

    for page in result["pages"]:
        path_short = page["path"]
        print("-" * 70)
        print("  File: {}".format(path_short))
        print("  Type: {}".format(page.get("file_type", "unknown")))
        print("  Size: {} bytes  Lines: {}".format(
            page.get("size", 0), page.get("line_count", 0)))
        print("  Summary: {}".format(page.get("summary", "")[:120]))
        print()

    print("=" * 70 + "\n")


if __name__ == "__main__":
    print_summary()
