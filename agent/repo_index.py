"""
Fantasy Casino — Repository Intelligence.

P2: Index the repository tree for context retrieval.

Scans all source files, extracts metadata (type, size, imports, classes,
functions, tags), and stores the index in the SQLite database.

Usage:
    from agent.repo_index import build_index, get_files_by_type, get_file_details, list_indexed_files

    build_index(repo_root=".", db_path="agent/plans.db")
    py_files = get_files_by_type("python", "agent/plans.db")
"""

import os
import ast
import json
import sys
from datetime import datetime, timezone

_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)

EXCLUDED_DIRS = {
    ".git", ".venv", "__pycache__", "node_modules", ".tox",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
    "quarantine", "work", "snapshots", "logs", "approvals",
    "plans", "tmp", "build", "dist", ".eggs", "egg-info",
}

FILE_TYPE_MAP = {
    ".py": "python",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sh": "shell",
    ".bash": "shell",
    ".bat": "shell",
    ".ps1": "shell",
    ".cfg": "config",
    ".ini": "config",
    ".conf": "config",
    ".env": "config",
    ".txt": "other",
    ".rst": "other",
    ".html": "other",
    ".css": "other",
    ".js": "other",
    ".ts": "other",
    ".svg": "image",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
}

TAG_PATTERNS = {
    "auth": ["auth", "login", "session", "token", "jwt", "oauth", "password"],
    "wallet": ["wallet", "balance", "deposit", "withdraw", "transaction", "ledger"],
    "game": ["game", "slot", "roulette", "poker", "bet", "spin", "round"],
    "bonus": ["bonus", "promotion", "reward", "free_spin", "cashback"],
    "kyc": ["kyc", "verify", "identity", "passport", "document"],
    "risk": ["risk", "fraud", "compliance", "monitor", "flag"],
    "analytics": ["analytics", "event", "metric", "track", "clickhouse"],
    "admin": ["admin", "dashboard", "report", "management"],
    "payment": ["payment", "stripe", "paypal", "crypto", "bitcoin", "bank"],
    "notification": ["telegram", "email", "notification", "alert", "webhook"],
}


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _classify_file_type(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return FILE_TYPE_MAP.get(ext.lower(), "other")


def _extract_first_lines(filepath: str, max_lines: int = 5, max_len: int = 200) -> str:
    try:
        with open(filepath, "r", errors="ignore") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= max_lines:
                    break
                lines.append(line.strip()[:max_len])
            return "\n".join(lines)
    except Exception:
        return ""


def _extract_python_metadata(filepath: str) -> dict:
    try:
        with open(filepath, "r", errors="ignore") as f:
            source = f.read()
    except Exception:
        return {"has_imports": 0, "imports": "", "has_classes": 0, "classes": "",
                "has_functions": 0, "functions": ""}

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError:
        return {"has_imports": 0, "imports": "", "has_classes": 0, "classes": "",
                "has_functions": 0, "functions": ""}

    imports = []
    classes = []
    functions = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imports.append(f"{module}.{alias.name}")
        elif isinstance(node, ast.ClassDef):
            classes.append(node.name)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.col_offset == 0:
                functions.append(node.name)

    return {
        "has_imports": 1 if imports else 0,
        "imports": json.dumps(imports),
        "has_classes": 1 if classes else 0,
        "classes": json.dumps(classes),
        "has_functions": 1 if functions else 0,
        "functions": json.dumps(functions),
    }


def _detect_tags(filepath: str, file_type: str) -> list:
    if file_type != "markdown":
        return []

    try:
        with open(filepath, "r", errors="ignore") as f:
            content = f.read(8192).lower()
    except Exception:
        return []

    tags = []
    for tag, patterns in TAG_PATTERNS.items():
        if any(p in content for p in patterns):
            tags.append(tag)
    return tags


def _get_file_size(filepath: str) -> int:
    try:
        return os.path.getsize(filepath)
    except Exception:
        return 0


def _get_line_count(filepath: str) -> int:
    try:
        with open(filepath, "r", errors="ignore") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def index_file(relative_path: str, repo_root: str, db_path: str,
               force: bool = False) -> dict:
    """Index a single file and store in the database.

    Args:
        relative_path: File path relative to repo_root.
        repo_root: Repository root directory.
        db_path: Path to the SQLite database.
        force: Force re-index even if already indexed.

    Returns:
        Dict with index result status.
    """
    from agent.memory import get_conn

    abs_path = os.path.join(repo_root, relative_path)
    if not os.path.isfile(abs_path):
        return {"status": "error", "message": f"File not found: {abs_path}"}

    file_type = _classify_file_type(relative_path)
    size = _get_file_size(abs_path)
    line_count = _get_line_count(abs_path)
    first_lines = _extract_first_lines(abs_path)
    last_modified = datetime.fromtimestamp(
        os.path.getmtime(abs_path), tz=timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    imports = ""
    classes = ""
    functions = ""
    has_imports = 0
    has_classes = 0
    has_functions = 0

    if file_type == "python":
        meta = _extract_python_metadata(abs_path)
        has_imports = meta["has_imports"]
        imports = meta["imports"]
        has_classes = meta["has_classes"]
        classes = meta["classes"]
        has_functions = meta["has_functions"]
        functions = meta["functions"]

    tags = _detect_tags(abs_path, file_type)

    conn = get_conn(db_path)
    try:
        if force:
            conn.execute(
                "DELETE FROM repo_index WHERE relative_path = ?",
                (relative_path,),
            )

        # Check if already indexed
        existing = conn.execute(
            "SELECT id FROM repo_index WHERE relative_path = ?",
            (relative_path,),
        ).fetchone()

        if existing and not force:
            return {"status": "skipped", "path": relative_path}

        conn.execute(
            """INSERT INTO repo_index (
                path, relative_path, file_type, size_bytes, line_count,
                first_lines, has_imports, imports, has_classes, classes,
                has_functions, functions, tags, last_modified, indexed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                abs_path, relative_path, file_type, size, line_count,
                first_lines, has_imports, imports, has_classes, classes,
                has_functions, functions, json.dumps(tags),
                last_modified, _now(),
            ),
        )
        conn.commit()
        return {"status": "indexed", "path": relative_path, "file_type": file_type}

    except Exception as e:
        conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()


def scan_directory(repo_root: str) -> list:
    """Scan repository directory and return list of relative file paths.

    Args:
        repo_root: Repository root directory.

    Returns:
        List of relative file paths.
    """
    files = []
    for root, dirs, filenames in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for filename in filenames:
            if filename.startswith("."):
                continue
            abs_path = os.path.join(root, filename)
            rel_path = os.path.relpath(abs_path, repo_root)
            files.append(rel_path)
    return sorted(files)


def build_index(repo_root: str = None, db_path: str = None,
                force: bool = False) -> dict:
    """Build or rebuild the repository index.

    Scans the entire repository and indexes all files.

    Args:
        repo_root: Repository root directory. Defaults to project root.
        db_path: Path to the SQLite database.
        force: Force re-index all files.

    Returns:
        Dict with indexing statistics.
    """
    if repo_root is None:
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    files = scan_directory(repo_root)
    stats = {
        "total_files": len(files),
        "indexed": 0,
        "skipped": 0,
        "errors": 0,
        "by_type": {},
    }

    for rel_path in files:
        result = index_file(rel_path, repo_root, db_path, force=force)
        if result["status"] == "indexed":
            stats["indexed"] += 1
            ft = result.get("file_type", "other")
            stats["by_type"][ft] = stats["by_type"].get(ft, 0) + 1
        elif result["status"] == "skipped":
            stats["skipped"] += 1
        else:
            stats["errors"] += 1

    return stats


def list_indexed_files(db_path: str = None) -> list:
    """List all indexed files.

    Args:
        db_path: Path to the SQLite database.

    Returns:
        List of file index dicts.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from agent.memory import get_conn
    conn = get_conn(db_path)
    rows = conn.execute(
        "SELECT relative_path, file_type, size_bytes, line_count, tags "
        "FROM repo_index ORDER BY relative_path"
    ).fetchall()
    conn.close()

    return [
        {
            "path": row["relative_path"],
            "file_type": row["file_type"],
            "size_bytes": row["size_bytes"],
            "line_count": row["line_count"],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
        }
        for row in rows
    ]


def get_files_by_type(file_type: str, db_path: str = None) -> list:
    """Get indexed files filtered by type.

    Args:
        file_type: File type to filter by (python, markdown, etc.).
        db_path: Path to the SQLite database.

    Returns:
        List of matching file index dicts.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from agent.memory import get_conn
    conn = get_conn(db_path)
    rows = conn.execute(
        "SELECT relative_path, size_bytes, line_count, "
        "first_lines, tags FROM repo_index "
        "WHERE file_type = ? ORDER BY relative_path",
        (file_type,),
    ).fetchall()
    conn.close()

    return [
        {
            "path": row["relative_path"],
            "size_bytes": row["size_bytes"],
            "line_count": row["line_count"],
            "first_lines": row["first_lines"],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
        }
        for row in rows
    ]


def get_files_by_tag(tag: str, db_path: str = None) -> list:
    """Get indexed files that have a specific tag.

    Tags are stored as JSON arrays, so we search within the tags column.

    Args:
        tag: Tag to search for.
        db_path: Path to the SQLite database.

    Returns:
        List of matching file index dicts.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from agent.memory import get_conn
    conn = get_conn(db_path)
    rows = conn.execute(
        "SELECT relative_path, file_type, size_bytes, "
        "line_count, first_lines, tags FROM repo_index "
        "WHERE tags LIKE ? ORDER BY relative_path",
        (f"%{tag}%",),
    ).fetchall()
    conn.close()

    return [
        {
            "path": row["relative_path"],
            "file_type": row["file_type"],
            "size_bytes": row["size_bytes"],
            "line_count": row["line_count"],
            "first_lines": row["first_lines"],
            "tags": json.loads(row["tags"]) if row["tags"] else [],
        }
        for row in rows
    ]


def get_file_details(relative_path: str, db_path: str = None) -> dict:
    """Get detailed information about a specific indexed file.

    Args:
        relative_path: File path relative to repo_root.
        db_path: Path to the SQLite database.

  Returns:
        List of matching file index dicts.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from agent.memory import get_conn
    conn = get_conn(db_path)
    row = conn.execute(
        "SELECT * FROM repo_index WHERE relative_path = ?",
        (relative_path,),
    ).fetchone()
    conn.close()

    if not row:
        return {}

    return {
        "path": row["path"],
        "relative_path": row["relative_path"],
        "file_type": row["file_type"],
        "size_bytes": row["size_bytes"],
        "line_count": row["line_count"],
        "first_lines": row["first_lines"],
        "imports": json.loads(row["imports"]) if row["imports"] else [],
        "classes": json.loads(row["classes"]) if row["classes"] else [],
        "functions": json.loads(row["functions"]) if row["functions"] else [],
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "last_modified": row["last_modified"],
        "indexed_at": row["indexed_at"],
    }


def print_index_summary(db_path: str = None):
    """Print a human-readable summary of the repository index.

    Args:
        db_path: Path to the SQLite database.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    _dir = os.path.dirname(os.path.abspath(__file__))
    if _dir not in sys.path:
        sys.path.insert(0, _dir)
    from agent.memory import get_conn
    conn = get_conn(db_path)

    total = conn.execute("SELECT COUNT(*) as cnt FROM repo_index").fetchone()["cnt"]
    total_size = conn.execute(
        "SELECT COALESCE(SUM(size_bytes), 0) as sz FROM repo_index"
    ).fetchone()["sz"]

    type_counts = conn.execute(
        "SELECT file_type, COUNT(*) as cnt, SUM(size_bytes) as sz "
        "FROM repo_index GROUP BY file_type ORDER BY cnt DESC"
    ).fetchall()

    tag_counts = conn.execute(
        "SELECT tags, COUNT(*) as cnt FROM repo_index GROUP BY tags ORDER BY cnt DESC LIMIT 10"
    ).fetchall()

    conn.close()

    print("\n" + "=" * 60)
    print("  REPOSITORY INDEX SUMMARY")
    print("=" * 60)
    print(f"  Total files:  {total}")
    print(f"  Total size:   {total_size / 1024:.1f} KB")
    print()
    print("  By type:")
    for tc in type_counts:
        print(f"    {tc['file_type']:15s} {tc['cnt']:5d} files  ({tc['sz'] / 1024:.1f} KB)")

    print()
    print("  Top tags:")
    for ttc in tag_counts:
        tags = json.loads(ttc["tags"]) if ttc["tags"] else []
        print(f"    {', '.join(tags):30s} {ttc['cnt']} files")

    print("=" * 60 + "\n")


if __name__ == "__main__":
    import sys
    repo = sys.argv[1] if len(sys.argv) > 1 else "."
    print(f"Indexing repository: {repo}")
    stats = build_index(repo_root=repo)
    print(f"\nIndexed {stats['indexed']} files ({stats['skipped']} skipped, {stats['errors']} errors)")
    print(f"By type: {json.dumps(stats['by_type'], indent=2)}")
    print()
    print_index_summary()
