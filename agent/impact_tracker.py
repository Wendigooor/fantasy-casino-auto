"""
Fantasy Casino — Change Impact Tracker by File Group.

Tracks which files depend on which, maps import relationships,
and surfaces the blast radius of changing any single file.

Usage:
    python agent/impact_tracker.py

Or import:
    from agent.impact_tracker import (
        compute_import_dependencies,
        get_impact_for_file,
        get_file_group,
        store_impact_data_in_db,
        print_impact_summary,
    )
"""

import os
import sys
import json
import sqlite3
import fnmatch
import glob as glob_module
import re
from datetime import datetime, timezone

_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)

FILE_GROUPS = {
    "agent_core": [
        "agent/memory.py",
        "agent/init_db.py",
        "agent/quarantine.py",
        "agent/snapshots.py",
        "agent/approval.py",
    ],
    "agent_orchestrator": [
        "agent/orchestrator/__init__.py",
        "agent/orchestrator/planner.py",
        "agent/orchestrator/executor.py",
        "agent/orchestrator/verifier.py",
        "agent/orchestrator/run_task.py",
    ],
    "agent_tools": [
        "agent/task_intake.py",
        "agent/diff_preview.py",
        "agent/verify_commands.py",
        "agent/telegram_notify.py",
    ],
    "research": ["research/*.md"],
    "product": ["product/**/*.py"],
    "analytics": ["analytics/**/*.py"],
    "config": [
        ".flake8",
        ".gitignore",
        "pyproject.toml",
        "setup.py",
    ],
    "prompts": ["agent/prompts/*.py"],
}


def _normalize_path(path, repo_root=None):
    if repo_root:
        full = os.path.join(repo_root, path)
    else:
        full = path
    return os.path.normpath(full)


def _resolve_group_members(group_name, repo_root=None):
    patterns = FILE_GROUPS.get(group_name, [])
    members = []
    for pattern in patterns:
        if "*" in pattern or "?" in pattern:
            base_dir = os.path.dirname(pattern) or "."
            if repo_root:
                search_dir = os.path.join(repo_root, base_dir)
                full_pattern = os.path.join(search_dir, os.path.basename(pattern))
            else:
                full_pattern = pattern
            found = sorted(glob_module.glob(full_pattern))
            for f in found:
                rel = os.path.relpath(f, repo_root or os.getcwd())
                members.append(rel)
        else:
            members.append(pattern)
    return members


def _scan_python_files(repo_root=None):
    if repo_root is None:
        repo_root = _PARENT
    py_files = []
    for dirpath, dirnames, filenames in os.walk(os.path.join(repo_root, "agent")):
        for fname in filenames:
            if fname.endswith(".py"):
                full = os.path.join(dirpath, fname)
                rel = os.path.relpath(full, repo_root)
                py_files.append(rel)
    return sorted(py_files)


def _extract_imports_from_file(filepath, repo_root=None):
    if repo_root:
        full_path = os.path.join(repo_root, filepath)
    else:
        full_path = filepath
    imports = []
    try:
        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except (OSError, IOError):
        return imports
    for line in content.splitlines():
        stripped = line.strip()
        m = re.match(r"^from\s+(\S+)\s+import", stripped)
        if m:
            imports.append(m.group(1))
            continue
        m = re.match(r"^import\s+(\S+)", stripped)
        if m:
            imports.append(m.group(1))
    return imports


def _resolve_import_to_file(import_module, all_py_files, repo_root=None):
    parts = import_module.split(".")
    for py_file in all_py_files:
        normalized_py = py_file.replace("/", ".").replace("\\", ".")
        if normalized_py.endswith(".py"):
            normalized_py = normalized_py[:-3]
        if normalized_py == import_module or normalized_py.endswith("." + import_module):
            return py_file
        base_name = parts[-1] if parts else ""
        candidate = os.path.join(*parts) + ".py" if len(parts) > 1 else base_name + ".py"
        candidate = candidate.replace(".", "/")
        if py_file == candidate:
            return py_file
    return None


def compute_import_dependencies(repo_root=None):
    if repo_root is None:
        repo_root = _PARENT
    all_py_files = _scan_python_files(repo_root)
    dependencies = {}
    for py_file in all_py_files:
        raw_imports = _extract_imports_from_file(py_file, repo_root)
        resolved = []
        for imp in raw_imports:
            resolved_file = _resolve_import_to_file(imp, all_py_files, repo_root)
            if resolved_file:
                resolved.append(resolved_file)
        dependencies[py_file] = sorted(set(resolved))
    return {"dependencies": dependencies}


def _find_all_members(repo_root=None):
    all_files = set()
    for group_name, patterns in FILE_GROUPS.items():
        members = _resolve_group_members(group_name, repo_root)
        for m in members:
            all_files.add(os.path.normpath(m))
    all_py = set(_scan_python_files(repo_root))
    all_files.update(all_py)
    return all_files


def _find_research_mentions(filepath, repo_root=None):
    if repo_root is None:
        repo_root = _PARENT
    mentions = []
    research_dir = os.path.join(repo_root, "research")
    if not os.path.isdir(research_dir):
        return mentions
    basename = os.path.basename(filepath)
    filepath_rel = os.path.normpath(filepath)
    for fname in sorted(os.listdir(research_dir)):
        if not fname.endswith(".md"):
            continue
        fpath = os.path.join(research_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except (OSError, IOError):
            continue
        if basename in content or filepath_rel in content:
            rel_path = os.path.join("research", fname)
            mentions.append(rel_path)
    return mentions


def get_impact_for_file(filepath, repo_root=None):
    if repo_root is None:
        repo_root = _PARENT
    filepath = os.path.normpath(filepath)
    deps_data = compute_import_dependencies(repo_root)
    dep_graph = deps_data["dependencies"]
    direct_dependents = []
    for src, targets in dep_graph.items():
        if filepath in targets:
            direct_dependents.append(src)
    file_group = get_file_group(filepath)
    same_group_files = []
    if file_group:
        same_group_files = [
            m for m in _resolve_group_members(file_group, repo_root)
            if os.path.normpath(m) != filepath
        ]
    related_research = _find_research_mentions(filepath, repo_root)
    affected_groups = set()
    if file_group:
        affected_groups.add(file_group)
    for dep in direct_dependents:
        dep_group = get_file_group(dep)
        if dep_group:
            affected_groups.add(dep_group)
    for grp_patterns in FILE_GROUPS.values():
        for pattern in grp_patterns:
            if "*" in pattern or "?" in pattern:
                continue
            norm_pattern = os.path.normpath(pattern)
            if norm_pattern == filepath:
                grp_name = None
                for gname, gpats in FILE_GROUPS.items():
                    if pattern in gpats:
                        grp_name = gname
                        break
                if grp_name and grp_name not in affected_groups:
                    affected_groups.add(grp_name)
    total = len(direct_dependents) + len(same_group_files) + len(related_research)
    return {
        "file": filepath,
        "file_group": file_group,
        "direct_dependents": sorted(direct_dependents),
        "same_group_files": sorted(same_group_files),
        "related_research": related_research,
        "affected_groups": sorted(affected_groups),
        "total_impact_count": total,
    }


def get_file_group(filepath):
    filepath = os.path.normpath(filepath)
    for group_name, patterns in FILE_GROUPS.items():
        for pattern in patterns:
            if "*" in pattern or "?" in pattern:
                if fnmatch.fnmatch(filepath, pattern):
                    return group_name
                base_dir = os.path.dirname(pattern) or "."
                rel_dir = os.path.dirname(filepath)
                if base_dir and rel_dir != base_dir:
                    continue
            else:
                if filepath == os.path.normpath(pattern):
                    return group_name
    return None


def get_group_members(group_name):
    members = _resolve_group_members(group_name)
    return sorted(members)


def list_all_groups():
    result = []
    for group_name, patterns in FILE_GROUPS.items():
        members = _resolve_group_members(group_name)
        result.append({"group": group_name, "members": sorted(members), "size": len(members)})
    return result


def store_impact_data_in_db(repo_root=None, db_path=None):
    if repo_root is None:
        repo_root = _PARENT
    if db_path is None:
        db_path = os.path.join(repo_root, "agent", "impact_tracker.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS impact_tracker (
            filepath TEXT PRIMARY KEY,
            file_group TEXT,
            direct_dependents TEXT,
            same_group TEXT,
            affected_groups TEXT,
            import_targets TEXT,
            total_impact INTEGER DEFAULT 0,
            computed_at TEXT NOT NULL
        )
    """)
    conn.commit()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_files = _find_all_members(repo_root)
    deps_data = compute_import_dependencies(repo_root)
    dep_graph = deps_data["dependencies"]
    for filepath in sorted(all_files):
        impact = get_impact_for_file(filepath, repo_root)
        import_targets = dep_graph.get(filepath, [])
        conn.execute(
            """INSERT OR REPLACE INTO impact_tracker
               (filepath, file_group, direct_dependents, same_group,
                affected_groups, import_targets, total_impact, computed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                filepath,
                impact["file_group"] or get_file_group(filepath),
                json.dumps(impact["direct_dependents"]),
                json.dumps(impact["same_group_files"]),
                json.dumps(impact["affected_groups"]),
                json.dumps(import_targets),
                impact["total_impact_count"],
                now_str,
            ),
        )
    conn.commit()
    conn.close()
    return db_path


def get_impact_records(db_path=None):
    if db_path is None:
        default_path = os.path.join(_PARENT, "agent", "impact_tracker.db")
        if os.path.exists(default_path):
            db_path = default_path
        else:
            return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.execute(
        "SELECT * FROM impact_tracker ORDER BY total_impact DESC, filepath"
    )
    records = []
    for row in cursor.fetchall():
        record = dict(row)
        for key in ("direct_dependents", "same_group", "affected_groups", "import_targets"):
            if isinstance(record.get(key), str):
                try:
                    record[key] = json.loads(record[key])
                except (json.JSONDecodeError, TypeError):
                    record[key] = []
        records.append(record)
    conn.close()
    return records


def print_impact_summary(repo_root=None, db_path=None):
    if repo_root is None:
        repo_root = _PARENT
    if not db_path:
        default_path = os.path.join(repo_root, "agent", "impact_tracker.db")
        if os.path.exists(default_path):
            db_path = default_path
    print("=" * 64)
    print("  FANTASY CASINO — CHANGE IMPACT SUMMARY")
    print("=" * 64)
    print()
    if db_path and os.path.exists(db_path):
        records = get_impact_records(db_path)
        if records:
            print("--- Top impacted files (by total_impact) ---")
            for rec in records[:20]:
                fp = rec["filepath"]
                total = rec["total_impact"]
                fg = rec.get("file_group", "none")
                print(f"  [{total:>3}] {fg:25s} {fp}")
            print()
            print("--- File groups overview ---")
            groups = list_all_groups()
            for g in sorted(groups, key=lambda x: x["size"], reverse=True):
                print(f"  {g['group']:25s} {g['size']:4d} files")
            print()
            print("--- Highest impact files ---")
            high_impact = [r for r in records if r["total_impact"] > 0]
            if high_impact:
                for rec in high_impact[:10]:
                    fp = rec["filepath"]
                    total = rec["total_impact"]
                    dependents = rec.get("direct_dependents", [])
                    same_group = rec.get("same_group", [])
                    affected = rec.get("affected_groups", [])
                    print(f"\n  File: {fp} (impact: {total})")
                    if dependents:
                        print(f"    Direct dependents: {', '.join(dependents)}")
                    if same_group:
                        print(f"    Same group ({len(same_group)}): {', '.join(same_group[:5])}")
                    if affected:
                        print(f"    Affected groups: {', '.join(affected)}")
            print()
        else:
            print("  No impact records found in database.")
            print("  Run store_impact_data_in_db() first.")
    else:
        print("  No database found. Run store_impact_data_in_db() first.")
    print()
    print("=" * 64)


if __name__ == "__main__":
    store_impact_data_in_db()
    print_impact_summary()
