"""
Fantasy Casino — Executor Role.

The executor makes actual changes to files.

Responsibilities:
- Edit files in the sandbox (agent/work/)
- Run commands in the sandbox
- Collect outputs
- Never delete files directly (use quarantine)

The executor stays focused on implementation.

Usage:
    from agent.orchestrator.executor import execute_plan, execute_command

    result = execute_plan(plan=plan_dict, work_dir="agent/work")
"""

import os
import shutil
import subprocess
import hashlib
from datetime import datetime, timezone

from agent.quarantine import move_to_quarantine
from agent.snapshots import create_snapshot

WORK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "work")


def _validate_path(requested_path: str, work_dir: str) -> str:
    """Validate that a requested path is safely contained within the work directory.

    Checks:
    - No .. components in the path
    - Resolved realpath is inside work_dir
    - Path is not absolute outside work_dir

    Args:
        requested_path: The path to validate.
        work_dir: The allowed work directory.

    Returns:
        The validated, resolved absolute path.

    Raises:
        ValueError: If the path is not safely contained in work_dir.
    """
    abs_path = os.path.abspath(requested_path)
    real_work = os.path.realpath(work_dir)

    if ".." in requested_path:
        raise ValueError(f"Path traversal detected: {requested_path}")

    real_path = os.path.realpath(abs_path)
    if not real_path.startswith(real_work + os.sep) and real_path != real_work:
        raise ValueError(f"Path escape attempt: {abs_path} is outside {real_work}")

    return abs_path


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _file_hash(filepath: str) -> str:
    """Compute MD5 hash of a file's content.

    Args:
        filepath: Path to the file.

    Returns:
        Hex digest string.
    """
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:12]


def _ensure_work_dir(base_dir: str) -> str:
    """Ensure the work directory exists and create a task-specific subdirectory.

    Args:
        base_dir: Base work directory path.

    Returns:
        Task-specific work directory path.
    """
    task_dir = os.path.join(base_dir, datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
    os.makedirs(task_dir, exist_ok=True)
    return task_dir


def write_file(filepath: str, content: str, work_dir: str = None) -> dict:
    """Write content to a file, creating parent directories as needed.

    Args:
        filepath: Absolute or relative file path.
        content: File content to write.
        work_dir: Optional work directory for sandbox validation.

    Returns:
        Result dict with path, action, and success status.
    """
    abs_path = os.path.abspath(filepath)
    if work_dir:
        abs_path = _validate_path(abs_path, work_dir)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    was_existing = os.path.exists(abs_path)

    with open(abs_path, "w") as f:
        f.write(content)

    return {
        "path": abs_path,
        "action": "update" if was_existing else "create",
        "success": True,
    }


def execute_file_step(step: dict, work_dir: str) -> dict:
    """Execute a single file-level step from a plan.

    Handles create_file, update_file, delete_file (via quarantine),
    and move_file operations.

    Args:
        step: Step dict from the plan.
        work_dir: Work directory to operate in.

    Returns:
        Result dict with file path, action, and success status.
    """
    action = step.get("action", "").lower()
    files = step.get("files", [])

    # Create file
    if "create_file" in action or "new file" in action:
        target = files[0] if files else step.get("file", "")
        # Enforce sandbox: reject absolute paths
        if os.path.isabs(target):
            return {"path": target, "action": action, "success": False,
                    "error": "Absolute paths not allowed in create step"}
        content = step.get("content", "")
        abs_path = os.path.join(work_dir, target) if not os.path.isabs(target) else target
        abs_path = _validate_path(abs_path, work_dir)

        # Create snapshot before modifying
        if os.path.exists(abs_path):
            create_snapshot(name=f"pre_update_{os.path.basename(abs_path)}", files=[abs_path])

        return write_file(abs_path, content, work_dir)

    # Update file
    if "update_file" in action or "update" in action:
        target = files[0] if files else step.get("file", "")
        if os.path.isabs(target):
            return {"path": target, "action": action, "success": False,
                    "error": "Absolute paths not allowed in update step"}
        abs_path = os.path.join(work_dir, target) if not os.path.isabs(target) else target
        abs_path = _validate_path(abs_path, work_dir)
        if not os.path.exists(abs_path):
            create_snapshot(name=f"pre_update_{os.path.basename(abs_path)}", files=[abs_path])
            content = step.get("content", "")
            return write_file(abs_path, content, work_dir)
        create_snapshot(name=f"pre_update_{os.path.basename(abs_path)}", files=[abs_path])
        content = step.get("content", "")
        return write_file(abs_path, content, work_dir)

    # Delete/move to quarantine
    if "delete" in action or "remove" in action:
        target = files[0] if files else step.get("file", "")
        # Enforce sandbox: reject absolute paths and path traversal
        if os.path.isabs(target):
            return {"path": target, "action": action, "success": False,
                    "error": "Absolute paths not allowed in delete step"}
        try:
            abs_path = _validate_path(os.path.join(work_dir, target), work_dir)
        except ValueError as e:
            return {"path": target, "action": action, "success": False,
                    "error": str(e)}

        if os.path.exists(abs_path):
            move_to_quarantine(abs_path, f"Step action: {action}")
            return {"path": abs_path, "action": "quarantined", "success": True}

        return {"path": abs_path, "action": "delete", "success": False, "error": "File not found"}

    # Move file
    if "move" in action or "rename" in action:
        source = files[0] if files else step.get("source", "")
        destination = step.get("destination", "")
        # Enforce sandbox on both source and destination
        if os.path.isabs(source) or os.path.isabs(destination):
            return {"error": "Absolute paths not allowed in move step", "success": False}
        try:
            src_path = _validate_path(os.path.join(work_dir, source), work_dir)
            dst_path = _validate_path(os.path.join(work_dir, destination), work_dir)
        except ValueError as e:
            return {"error": str(e), "success": False}

        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        shutil.move(src_path, dst_path)
        return {"source": src_path, "destination": dst_path, "action": "moved", "success": True}

    return {"error": f"Unknown step action: {action}", "success": False}


def execute_command(cmd: str, cwd: str = None, timeout: int = 60,
                    allowlist: list = None) -> dict:
    """Execute a command in the work directory with sandbox restrictions.

    Args:
        cmd: Command string to execute.
        cwd: Working directory. Defaults to WORK_DIR.
        timeout: Command timeout in seconds.
        allowlist: Optional list of allowed command names (e.g. ['python', 'flake8']).
                   If None, defaults to safe list.

    Returns:
        Result dict with stdout, stderr, returncode, and success status.
    """
    cwd = cwd or WORK_DIR

    # Default allowlist of safe commands
    if allowlist is None:
        allowlist = [
            "python", "python3", "pytest", "flake8", "pycodestyle",
            "grep", "wc", "cat", "ls", "echo", "date", "which",
            "npx", "npm", "node", "yarn", "tsc",
        ]

    # Parse the command to extract the executable name
    parts = cmd.split()
    if not parts:
        return {
            "command": cmd, "stdout": "", "stderr": "Empty command",
            "returncode": -1, "success": False,
        }

    exe = os.path.basename(parts[0])
    if exe not in allowlist:
        return {
            "command": cmd, "stdout": "",
            "stderr": f"Command '{exe}' not in allowlist",
            "returncode": -1, "success": False,
        }

    # Use shell=True for commands with shell operators (&&, ||, ;, |, cd)
    use_shell = any(op in cmd for op in ['&&', '||', ';', '|', 'cd '])
    try:
        if use_shell:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        else:
            result = subprocess.run(
                parts,
                shell=False,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        return {
            "command": cmd,
            "stdout": result.stdout[:4096],
            "stderr": result.stderr[:4096],
            "returncode": result.returncode,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {
            "command": cmd, "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
            "returncode": -1, "success": False,
        }
    except FileNotFoundError:
        return {
            "command": cmd, "stdout": "",
            "stderr": f"Command not found: {parts[0]}",
            "returncode": -1, "success": False,
        }
    except Exception as e:
        return {
            "command": cmd, "stdout": "",
            "stderr": str(e),
            "returncode": -1, "success": False,
        }


def execute_plan(plan: dict, work_dir: str = None, max_steps: int = 50) -> dict:
    """Execute all steps in a plan.

    Iterates through the plan's steps, executing each one sequentially.
    Stops on the first failure unless the step is marked as optional.

    Args:
        plan: Plan dict from the planner.
        work_dir: Work directory for file operations.
        max_steps: Maximum number of steps to execute.

    Returns:
        Result dict with steps_executed, successes, failures, and overall status.
    """
    work_dir = work_dir or WORK_DIR
    os.makedirs(work_dir, exist_ok=True)

    steps = plan.get("steps", [])
    if not steps:
        return {
            "status": "empty_plan",
            "steps_executed": 0,
            "successes": [],
            "failures": [],
            "error": "Plan has no steps",
        }

    successes = []
    failures = []
    step_count = 0

    for i, step in enumerate(steps):
        if step_count >= max_steps:
            failures.append({
                "step": i + 1,
                "error": f"Reached max_steps limit ({max_steps})",
            })
            break

        step_count += 1
        step_result = None

        # Check if step involves file operations
        if step.get("files") or step.get("file") or step.get("content"):
            step_result = execute_file_step(step, work_dir)

        # Check if step involves running a command
        if step.get("command"):
            cmd_result = execute_command(step["command"], cwd=work_dir)
            step_result = {
                "step": i + 1,
                "action": "command",
                **cmd_result,
            }

        if step_result and step_result.get("success"):
            successes.append(step_result)
        elif step_result:
            entry = {
                "step": i + 1,
                "action": step.get("action", "unknown"),
            }
            if step_result:
                entry.update(step_result)
            failures.append(entry)
        else:
            # Step has no actionable fields (files, command, content)
            # This is likely an informational step — skip it silently
            pass

    return {
        "plan_title": plan.get("title", "unknown"),
        "status": "success" if not failures else "partial" if successes else "failed",
        "steps_executed": len(successes) + len(failures),
        "total_steps": len(steps),
        "successes": successes,
        "failures": failures,
    }


def list_work_files(base_dir: str = None) -> list:
    """List all files in the work directory tree.

    Args:
        base_dir: Base work directory. Defaults to agent/work/.

    Returns:
        List of file paths relative to the work directory.
    """
    base_dir = base_dir or WORK_DIR
    files = []

    if not os.path.exists(base_dir):
        return files

    for root, dirs, filenames in os.walk(base_dir):
        for filename in filenames:
            abs_path = os.path.join(root, filename)
            rel_path = os.path.relpath(abs_path, base_dir)
            files.append(rel_path)

    return sorted(files)
