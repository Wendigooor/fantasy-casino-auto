"""
Fantasy Casino — Diff Preview Utility.

Generates human-readable diffs before changes are applied.
Used by the Executor to show what will change before making modifications.

Usage:
    from agent.diff_preview import generate_diff, preview_files

    preview = generate_diff("/path/to/original", "/path/to/modified")
    print(preview)
"""

import os
import difflib
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def generate_diff(original_content: str, modified_content: str,
                  filepath: str = "") -> str:
    """Generate a unified diff between two strings.

    Args:
        original_content: Original file content.
        modified_content: Modified file content.
        filepath: Optional file path for the diff header.

    Returns:
        Formatted diff string.
    """
    original_lines = original_content.splitlines(keepends=True)
    modified_lines = modified_content.splitlines(keepends=True)

    diff = difflib.unified_diff(
        original_lines,
        modified_lines,
        fromfile=f"a/{filepath}" if filepath else "original",
        tofile=f"b/{filepath}" if filepath else "modified",
        lineterm="",
    )

    return "\n".join(diff)


def diff_file(original_path: str, modified_path: str) -> str:
    """Generate a diff between two files.

    Args:
        original_path: Path to the original file.
        modified_path: Path to the modified file.

    Returns:
        Formatted diff string, or error message.
    """
    try:
        with open(original_path) as f:
            original = f.read()
        with open(modified_path) as f:
            modified = f.read()

        return generate_diff(original, modified, filepath=modified_path)
    except FileNotFoundError as e:
        return f"File not found: {e}"
    except Exception as e:
        return f"Error generating diff: {e}"


def preview_file_change(filepath: str, new_content: str,
                        max_lines: int = 100) -> str:
    """Preview the diff for a file that will be created or modified.

    If the file doesn't exist yet, shows a "new file" preview.
    If it does exist, shows a unified diff.

    Args:
        filepath: Path to the file.
        new_content: The new content that will be written.
        max_lines: Maximum diff lines to show (to avoid huge diffs).

    Returns:
        Formatted preview string.
    """
    abs_path = os.path.abspath(filepath)

    if not os.path.exists(abs_path):
        # New file preview
        lines = new_content.splitlines()
        preview = f"\n  === NEW FILE: {filepath} ===\n"
        preview += f"  Size: {len(new_content)} bytes, {len(lines)} lines\n"
        preview += f"  First {min(max_lines, len(lines))} lines:\n"
        for i, line in enumerate(lines[:max_lines]):
            preview += f"  + {line}\n"
        if len(lines) > max_lines:
            preview += f"  ... ({len(lines) - max_lines} more lines)\n"
        return preview

    # Existing file: show diff
    try:
        with open(abs_path) as f:
            original = f.read()
        diff = generate_diff(original, new_content, filepath=filepath)

        # Truncate if too long
        diff_lines = diff.split("\n")
        if len(diff_lines) > max_lines * 2:
            diff_lines = diff_lines[:max_lines * 2] + ["... (diff truncated) ..."]

        preview = f"\n  === MODIFIED: {filepath} ===\n"
        for line in diff_lines[:max_lines * 2]:
            preview += f"  {line}\n"
        return preview

    except Exception as e:
        return f"  Error reading {filepath}: {e}"


def preview_batch_changes(changes: list, max_per_file: int = 100) -> str:
    """Preview multiple file changes at once.

    Args:
        changes: List of dicts with keys: filepath, new_content, action.
            action can be "create", "modify", or "delete".
        max_per_file: Max diff lines per file.

    Returns:
        Formatted batch preview string.
    """
    preview = "\n" + "=" * 60 + "\n"
    preview += "  DIFF PREVIEW\n"
    preview += f"  {len(changes)} change(s)\n"
    preview += f"  {_now()}\n"
    preview += "=" * 60 + "\n"

    for change in changes:
        filepath = change.get("filepath", "unknown")
        action = change.get("action", "unknown")
        new_content = change.get("new_content", "")

        if action == "delete":
            preview += f"\n  === DELETE: {filepath} ===\n"
        elif action == "create":
            preview += preview_file_change(filepath, new_content, max_lines=max_per_file)
        elif action == "modify":
            preview += preview_file_change(filepath, new_content, max_lines=max_per_file)
        else:
            preview += f"\n  === {action.upper()}: {filepath} ===\n"
            preview += f"  Content preview: {new_content[:200]}\n"

    preview += "\n" + "=" * 60 + "\n"
    return preview
