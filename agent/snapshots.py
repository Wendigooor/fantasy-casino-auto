"""
Fantasy Casino — Snapshot and Rollback.

Implements the rollback flow from the Agent Operating Manual.
Creates file snapshots before changes, enables rollback to previous state.

Usage:
    from agent.snapshots import create_snapshot, rollback_snapshot, list_snapshots, delete_snapshot

    # Before making changes
    snapshot_id = create_snapshot("before_config_change", files=["config.py", "settings.py"])

    # ... make changes ...

    # Rollback if needed
    rollback_snapshot(snapshot_id)

    # List all snapshots
    for snap in list_snapshots():
        print(f"#{snap['id']}: {snap['name']} - {len(snap['files'])} files at {snap['created_at']}")
"""

import os
import shutil
import json
import hashlib
import fcntl
import time
from datetime import datetime, timezone

SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")
METADATA_FILE = os.path.join(SNAPSHOT_DIR, "_snapshots.json")
LOCK_FILE = os.path.join(SNAPSHOT_DIR, "_snapshots.lock")

os.makedirs(SNAPSHOT_DIR, exist_ok=True)


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
    raise RuntimeError("Could not acquire lock on snapshot metadata")


def _release_lock(fd):
    """Release file lock."""
    fcntl.flock(fd, fcntl.LOCK_UN)
    os.close(fd)


def _load_metadata(fd=None) -> dict:
    """Load snapshot metadata from JSON file."""
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
    return {"snapshots": [], "total_snapshots": 0, "total_rollbacks": 0}


def _save_metadata(meta: dict, fd) -> None:
    """Save snapshot metadata to JSON file with exclusive lock + fsync."""
    fcntl.flock(fd, fcntl.LOCK_EX)
    try:
        with open(METADATA_FILE, "w") as f:
            json.dump(meta, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)


def _compute_file_hash(filepath: str) -> str:
    """Compute MD5 hash of a file."""
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _make_snapshot_dir(name: str, snapshot_id: int) -> str:
    """Create a directory for a snapshot."""
    snapshot_path = os.path.join(SNAPSHOT_DIR, str(snapshot_id), name)
    os.makedirs(snapshot_path, exist_ok=True)
    return snapshot_path


def _get_snapshot_file_path(snapshot_id: int, stored_name: str) -> str:
    """Get the full path to a stored snapshot file."""
    # Search in all subdirs of the snapshot directory
    snapshot_base = os.path.join(SNAPSHOT_DIR, str(snapshot_id))
    if os.path.exists(snapshot_base):
        for root, dirs, files in os.walk(snapshot_base):
            if stored_name in files:
                return os.path.join(root, stored_name)
    return os.path.join(snapshot_base, stored_name)


def create_snapshot(
    name: str,
    files: list = None,
    directories: list = None,
    task_id: int = None,
    description: str = None,
) -> dict:
    """
    Create a snapshot of files or directories.

    Args:
        name: Human-readable name for the snapshot
        files: List of file paths to snapshot
        directories: List of directory paths to snapshot
        task_id: Optional task ID
        description: Optional description

    Returns:
        Dict with snapshot details including ID
    """
    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)
        snapshot_id = meta.get("total_snapshots", 0) + 1

        snapshot_path = _make_snapshot_dir(name, snapshot_id)
        files_in_snapshot = []

        # Snapshot individual files
        if files:
            for filepath in files:
                if not os.path.isabs(filepath):
                    filepath = os.path.abspath(filepath)

                if not os.path.exists(filepath):
                    print(f"  Warning: file not found, skipping: {filepath}")
                    continue

                # Compute hash
                file_hash = _compute_file_hash(filepath)
                size = os.path.getsize(filepath)

                # Copy file with unique name based on original path hash
                basename = os.path.basename(filepath)
                # Use first 8 chars of hash for uniqueness
                name_hash = hashlib.md5(filepath.encode()).hexdigest()[:8]
                if basename in ["", None]:
                    stored_name = f"file_{name_hash}"
                else:
                    parts = os.path.splitext(basename)
                    stored_name = f"{parts[0]}_{name_hash}{parts[1]}"

                dest = os.path.join(snapshot_path, stored_name)
                shutil.copy2(filepath, dest)

                files_in_snapshot.append({
                    "original_path": filepath,
                    "stored_name": stored_name,
                    "hash": file_hash,
                    "size": size,
                    "status": "copied",
                })

        # Snapshot directories (copy entire tree)
        if directories:
            for dirpath in directories:
                if not os.path.isabs(dirpath):
                    dirpath = os.path.abspath(dirpath)

                if not os.path.isdir(dirpath):
                    print(f"  Warning: directory not found, skipping: {dirpath}")
                    continue

                # Calculate total size
                total_size = 0
                valid_files = []
                for root, dirs, files_list in os.walk(dirpath):
                    # Skip pycache, .git, and other non-essential dirs
                    dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", ".venv")]
                    # Skip broken symlinks and non-existent files
                    dirs[:] = [d for d in dirs if os.path.isdir(os.path.join(root, d))]
                    for f in files_list:
                        full_path = os.path.join(root, f)
                        if os.path.exists(full_path) and not os.path.islink(full_path):
                            try:
                                total_size += os.path.getsize(full_path)
                                valid_files.append(full_path)
                            except (OSError, FileNotFoundError):
                                pass
                        elif os.path.islink(full_path):
                            try:
                                if os.path.exists(full_path):  # valid symlink
                                    total_size += os.path.getsize(full_path)
                                    valid_files.append(full_path)
                            except (OSError, FileNotFoundError):
                                pass

                rel_dir = os.path.relpath(dirpath, ".")
                dest_dir = os.path.join(snapshot_path, rel_dir)
                shutil.copytree(dirpath, dest_dir, dirs_exist_ok=True)

                file_count = len(valid_files)

                files_in_snapshot.append({
                    "original_path": dirpath,
                    "relative_path": rel_dir,
                    "hash": "dir",
                    "size": total_size,
                    "file_count": file_count,
                    "status": "directory_copied",
                })

        snapshot_record = {
            "id": snapshot_id,
            "name": name,
            "description": description,
            "task_id": task_id,
            "created_at": _now(),
            "files": files_in_snapshot,
            "file_count": len(files_in_snapshot),
            "total_size": sum(f.get("size", 0) for f in files_in_snapshot),
        }

        meta["snapshots"].append(snapshot_record)
        meta["total_snapshots"] = snapshot_id
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return snapshot_record


def rollback_snapshot(
    snapshot_id: int,
    dry_run: bool = False,
    task_id: int = None,
) -> dict:
    """
    Rollback to a previous snapshot.

    Args:
        snapshot_id: ID of the snapshot to rollback to
        dry_run: If True, only report what would happen
        task_id: Optional task ID for logging

    Returns:
        Dict with rollback results
    """
    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)

        # Find snapshot
        snapshot = None
        for s in meta["snapshots"]:
            if s["id"] == snapshot_id:
                snapshot = s
                break

        if not snapshot:
            raise ValueError(f"Snapshot not found: {snapshot_id}")

        if dry_run:
            return {
                "snapshot_id": snapshot_id,
                "dry_run": True,
                "files_to_restore": snapshot["files"],
                "total_files": snapshot["file_count"],
            }

        restored_files = []
        for file_info in snapshot["files"]:
            original_path = file_info["original_path"]

            if not os.path.isabs(original_path):
                original_path = os.path.abspath(original_path)

            # Find snapshot file by stored_name
            stored_name = file_info.get("stored_name")
            if stored_name:
                snapshot_file_path = _get_snapshot_file_path(snapshot_id, stored_name)
            else:
                rel_path = file_info.get("relative_path", "")
                snapshot_file_path = os.path.join(SNAPSHOT_DIR, str(snapshot_id), rel_path) if rel_path else ""

            if not snapshot_file_path or not os.path.exists(snapshot_file_path):
                print(f"  Warning: snapshot file not found, skipping: {snapshot_file_path}")
                continue

            # Ensure target directory exists
            os.makedirs(os.path.dirname(original_path), exist_ok=True)

            # Restore
            if file_info.get("status") == "directory_copied" and os.path.isdir(snapshot_file_path):
                if os.path.exists(original_path):
                    shutil.rmtree(original_path)
                shutil.copytree(snapshot_file_path, original_path)
            else:
                shutil.copy2(snapshot_file_path, original_path)

            restored_files.append({
                "path": original_path,
                "status": "restored",
            })

        result = {
            "snapshot_id": snapshot_id,
            "snapshot_name": snapshot["name"],
            "restored_at": _now(),
            "restored_files": restored_files,
            "total_restored": len(restored_files),
        }

        meta["total_rollbacks"] = meta.get("total_rollbacks", 0) + 1
        _save_metadata(meta, lock_fd)
    finally:
        _release_lock(lock_fd)

    return result


def list_snapshots(task_id: int = None) -> list:
    """
    List all snapshots, optionally filtered by task_id.

    Returns:
        List of snapshot summaries
    """
    meta = _load_metadata()
    snapshots = meta.get("snapshots", [])

    if task_id is not None:
        snapshots = [s for s in snapshots if s.get("task_id") == task_id]

    return [
        {
            "id": s["id"],
            "name": s["name"],
            "task_id": s.get("task_id"),
            "created_at": s["created_at"],
            "file_count": s["file_count"],
            "total_size": s.get("total_size", 0),
        }
        for s in snapshots
    ]


def delete_snapshot(snapshot_id: int) -> bool:
    """
    Permanently delete a snapshot and its data.

    Args:
        snapshot_id: ID of the snapshot to delete

    Returns:
        True if deleted, False if not found
    """
    lock_fd = _acquire_lock()
    try:
        meta = _load_metadata(lock_fd)

        snapshot = None
        for s in meta["snapshots"]:
            if s["id"] == snapshot_id:
                snapshot = s
                break

        if not snapshot:
            return False

        # Remove snapshot directory
        snapshot_dir = os.path.join(SNAPSHOT_DIR, str(snapshot_id))
        if os.path.exists(snapshot_dir):
            shutil.rmtree(snapshot_dir)

        # Remove from metadata
        meta["snapshots"] = [s for s in meta["snapshots"] if s["id"] != snapshot_id]
        _save_metadata(meta, lock_fd)

        return True
    finally:
        _release_lock(lock_fd)


def get_snapshot_detail(snapshot_id: int) -> dict:
    """
    Get full details of a specific snapshot.

    Args:
        snapshot_id: ID of the snapshot

    Returns:
        Full snapshot details
    """
    meta = _load_metadata()

    for s in meta.get("snapshots", []):
        if s["id"] == snapshot_id:
            return s

    raise ValueError(f"Snapshot not found: {snapshot_id}")


if __name__ == "__main__":
    print("=" * 50)
    print("  Snapshot Module — Test")
    print("=" * 50)

    # Clear existing snapshots for test
    import glob
    for d in glob.glob(os.path.join(SNAPSHOT_DIR, "*")):
        if os.path.isdir(d) and not d.endswith("_snapshots.json"):
            shutil.rmtree(d)
    if os.path.exists(METADATA_FILE):
        os.remove(METADATA_FILE)

    # Create test files
    test_dir = "/tmp/test_snapshot_dir"
    os.makedirs(test_dir, exist_ok=True)

    test_file1 = os.path.join(test_dir, "file1.txt")
    test_file2 = os.path.join(test_dir, "file2.txt")

    with open(test_file1, "w") as f:
        f.write("content of file 1\n")
    with open(test_file2, "w") as f:
        f.write("content of file 2\n")

    # Create snapshot
    print("\n1. Creating snapshot...")
    snap = create_snapshot(
        "test_snapshot",
        files=[test_file1, test_file2],
        task_id=999,
        description="Test snapshot with 2 files"
    )
    print(f"   Snapshot ID: {snap['id']}")
    print(f"   Files: {snap['file_count']}")
    print(f"   Total size: {snap['total_size']} bytes")

    # Modify files
    print("\n2. Modifying files...")
    with open(test_file1, "w") as f:
        f.write("MODIFIED content\n")
    with open(test_file2, "w") as f:
        f.write("MODIFIED content\n")

    # Dry run rollback
    print("\n3. Dry run rollback...")
    dry = rollback_snapshot(snap["id"], dry_run=True)
    print(f"   Files to restore: {dry['total_files']}")

    # Actual rollback
    print("\n4. Rolling back...")
    result = rollback_snapshot(snap["id"], task_id=999)
    print(f"   Restored: {result['total_restored']} files")

    # Verify content
    with open(test_file1) as f:
        print(f"   file1 content: {f.read().strip()}")
    with open(test_file2) as f:
        print(f"   file2 content: {f.read().strip()}")

    # List snapshots
    print("\n5. Listing snapshots:")
    for s in list_snapshots():
        print(f"   #{s['id']} {s['name']}: {s['file_count']} files")

    # Get detail
    print("\n6. Snapshot detail:")
    detail = get_snapshot_detail(snap["id"])
    print(f"   Name: {detail['name']}")
    print(f"   Description: {detail['description']}")

    # Clean up test
    shutil.rmtree(test_dir)
    delete_snapshot(snap["id"])

    print("\nTest complete.")
