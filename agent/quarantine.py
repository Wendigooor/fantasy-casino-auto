"""
Fantasy Casino — Quarantine module.

Implements the no-delete policy from the agent manual (09-agent-manual.md).
All file removals go through quarantine, never direct deletion.

Usage:
    from agent.quarantine import move_to_quarantine, quarantine_list, restore_from_quarantine

    # Move a file to quarantine
    quarantine_path = move_to_quarantine("old_file.py", "replaced by new implementation", task_id=5)

    # List quarantined files
    for item in quarantine_list():
        print(f"{item['name']} -> moved from {item['original_path']} on {item['moved_at']}")

    # Restore a file
    restore_from_quarantine("old_file.py", "needed for rollback", task_id=5)
"""

import os
import shutil
import json
import fcntl
import time
from datetime import datetime, timezone

QUARANTINE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quarantine")
METADATA_FILE = os.path.join(QUARANTINE_DIR, "_meta.json")
LOCK_FILE = os.path.join(QUARANTINE_DIR, "_meta.lock")

# Ensure quarantine directory exists
os.makedirs(QUARANTINE_DIR, exist_ok=True)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _acquire_lock():
    """Acquire exclusive file lock. Returns lock fd."""
    for _ in range(50):  # Try up to 5 seconds
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_RDWR)
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except (IOError, OSError):
            time.sleep(0.1)
    raise RuntimeError("Could not acquire lock on quarantine metadata")


def _release_lock(fd):
    """Release file lock."""
    fcntl.flock(fd, fcntl.LOCK_UN)
    os.close(fd)


def _load_metadata(fd=None) -> dict:
    """Load quarantine metadata from JSON file."""
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r") as f:
            if fd is not None:
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                data = json.load(f)
            finally:
                if fd is not None:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            return data
    return {"files": [], "total_moves": 0, "total_restores": 0}


def _save_metadata(meta: dict, fd) -> None:
    """Save quarantine metadata to JSON file with exclusive lock + fsync."""
    fcntl.flock(fd, fcntl.LOCK_EX)
    try:
        with open(METADATA_FILE, "w") as f:
            json.dump(meta, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)


def _generate_quarantine_name(original_path: str, meta: dict) -> str:
    """Generate a unique quarantine path preserving directory structure."""
    base = os.path.basename(original_path)
    parent = os.path.dirname(original_path)

    # Create subdirectory structure from original path
    dir_part = parent.strip("/").replace("/", os.sep) if parent else ""
    target_dir = os.path.join(QUARANTINE_DIR, dir_part)

    # Make name unique
    name = base
    counter = 1
    while os.path.exists(os.path.join(target_dir, name)):
        name_parts = os.path.splitext(base)
        name = f"{name_parts[0]}_{counter}{name_parts[1]}"
        counter += 1

    os.makedirs(target_dir, exist_ok=True)
    return os.path.join(target_dir, name)


def move_to_quarantine(source_path: str, reason: str, task_id: int = None) -> str:
    """
    Move a file to quarantine instead of deleting it.

    Args:
        source_path: Path to the file to quarantine (relative or absolute)
        reason: Why the file is being quarantined
        task_id: Optional task ID for tracking

    Returns:
        The quarantine path where the file was moved

    Raises:
        FileNotFoundError: If source_path does not exist
        IsADirectoryError: If source_path is a directory (use quarantine_dir instead)
    """
    # Resolve the full source path
    if not os.path.isabs(source_path):
        source_path = os.path.abspath(source_path)

    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source path does not exist: {source_path}")

    if os.path.isdir(source_path):
        raise IsADirectoryError(
            f"Source is a directory. Use quarantine_dir() instead: {source_path}"
        )

    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)
        quarantine_path = _generate_quarantine_name(source_path, meta)

        # Move the file
        shutil.move(source_path, quarantine_path)

        # Record in metadata
        record = {
            "quarantine_path": quarantine_path,
            "original_path": source_path,
            "reason": reason,
            "task_id": task_id,
            "moved_at": _now(),
            "size_bytes": os.path.getsize(quarantine_path),
        }
        meta["files"].append(record)
        meta["total_moves"] = meta.get("total_moves", 0) + 1
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return quarantine_path


def quarantine_dir(dir_path: str, reason: str, task_id: int = None) -> str:
    """
    Move a directory to quarantine.

    Args:
        dir_path: Path to the directory to quarantine
        reason: Why the directory is being quarantined
        task_id: Optional task ID for tracking

    Returns:
        The quarantine path where the directory was moved
    """
    if not os.path.isabs(dir_path):
        dir_path = os.path.abspath(dir_path)

    if not os.path.isdir(dir_path):
        raise NotADirectoryError(f"Source is not a directory: {dir_path}")

    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)

        # Use directory name as quarantine name
        base_name = os.path.basename(dir_path)
        quarantine_path = os.path.join(QUARANTINE_DIR, base_name)

        counter = 1
        while os.path.exists(quarantine_path):
            quarantine_path = os.path.join(QUARANTINE_DIR, f"{base_name}_{counter}")
            counter += 1

        shutil.move(dir_path, quarantine_path)

        record = {
            "quarantine_path": quarantine_path,
            "original_path": dir_path,
            "reason": reason,
            "task_id": task_id,
            "moved_at": _now(),
            "size_bytes": sum(
                os.path.getsize(f)
                for root, dirs, files in os.walk(quarantine_path)
                for f in files
            ),
            "is_directory": True,
        }
        meta["files"].append(record)
        meta["total_moves"] = meta.get("total_moves", 0) + 1
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return quarantine_path


def restore_from_quarantine(quarantine_name: str, reason: str, target_path: str = None,
                            task_id: int = None) -> str:
    """
    Restore a file or directory from quarantine.

    Args:
        quarantine_name: Name of the item in quarantine (basename)
        reason: Why restoring
        target_path: Where to restore to (defaults to original location)
        task_id: Optional task ID for tracking

    Returns:
        The restored file/directory path
    """
    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)

        # Find the item in metadata
        record = None
        for item in meta["files"]:
            if os.path.basename(item["quarantine_path"]) == quarantine_name or \
               item["quarantine_path"].endswith(os.sep + quarantine_name):
                record = item
                break

        if not record:
            # Search in quarantine directory directly
            for item in os.listdir(QUARANTINE_DIR):
                full_path = os.path.join(QUARANTINE_DIR, item)
                if os.path.basename(full_path) == quarantine_name or item == quarantine_name:
                    record = {
                        "quarantine_path": full_path,
                        "original_path": target_path or f"./{quarantine_name}",
                    }
                    break

        if not record:
            raise FileNotFoundError(f"Item not found in quarantine: {quarantine_name}")

        quarantine_path = record["quarantine_path"]

        # Determine target
        if target_path is None:
            target_path = record.get("original_path", f"./{quarantine_name}")

        if not os.path.isabs(target_path):
            target_path = os.path.abspath(target_path)

        # Ensure target directory exists
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        # Restore
        shutil.move(quarantine_path, target_path)

        # Remove from metadata
        meta["files"] = [f for f in meta["files"] if f["quarantine_path"] != quarantine_path]
        meta["total_restores"] = meta.get("total_restores", 0) + 1
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return target_path


def quarantine_list() -> list:
    """
    List all quarantined files and directories.

    Returns:
        List of dicts with quarantine info
    """
    return _load_metadata().get("files", [])


def quarantine_count() -> dict:
    """
    Get quarantine statistics.

    Returns:
        Dict with counts
    """
    meta = _load_metadata()
    return {
        "total_items": len(meta.get("files", [])),
        "total_moves": meta.get("total_moves", 0),
        "total_restores": meta.get("total_restores", 0),
    }


def quarantine_purge(quarantine_name: str, reason: str = "manual purge",
                     task_id: int = None) -> str:
    """
    Permanently delete a quarantined item. This is the only place
    where actual deletion should occur.

    Args:
        quarantine_name: Name of item to purge
        reason: Why purging
        task_id: Optional task ID for tracking

    Returns:
        Path of the purged item
    """
    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)

        record = None
        for item in meta["files"]:
            if item["quarantine_path"].endswith(os.sep + quarantine_name) or \
               os.path.basename(item["quarantine_path"]) == quarantine_name:
                record = item
                break

        if not record:
            raise FileNotFoundError(f"Item not found in quarantine: {quarantine_name}")

        quarantine_path = record["quarantine_path"]

        if os.path.isdir(quarantine_path):
            shutil.rmtree(quarantine_path)
        elif os.path.isfile(quarantine_path):
            os.remove(quarantine_path)

        meta["files"] = [f for f in meta["files"] if f["quarantine_path"] != quarantine_path]
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return quarantine_path


if __name__ == "__main__":
    # Demo / test
    print("=" * 50)
    print("  Quarantine Module — Test")
    print("=" * 50)

    # Show current state
    print(f"\nCurrent quarantine: {quarantine_count()}")

    # Create a test file and quarantine it
    test_file = "/tmp/test_quarantine_file.txt"
    with open(test_file, "w") as f:
        f.write("This is a test file for quarantine\n")

    print(f"\nCreated test file: {test_file}")

    qpath = move_to_quarantine(test_file, "test cleanup", task_id=999)
    print(f"Quarantined to: {qpath}")

    print(f"\nAfter quarantine: {quarantine_count()}")
    print("\nQuarantine list:")
    for item in quarantine_list():
        print(f"  - {os.path.basename(item['quarantine_path'])} "
              f"(from {item['original_path']}, {item['reason']})")

    # Test purge on a fresh quarantine
    with open("/tmp/test_purge.txt", "w") as f:
        f.write("purge test\n")
    qpath2 = move_to_quarantine("/tmp/test_purge.txt", "purge test", task_id=999)
    quarantine_purge(os.path.basename(qpath2), "purge test", task_id=999)

    print(f"\nFinal state: {quarantine_count()}")
    print("\nTest complete.")
