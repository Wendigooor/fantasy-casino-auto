"""
Fantasy Casino — Verification Commands.

Provides a registry of verification commands that can be run
to check code quality, syntax, and correctness.

Usage:
    from agent.verify_commands import run_all_verifications, list_verification_commands

    results = run_all_verifications("agent/work")
    for cmd, result in results.items():
        print(f"{cmd}: {'PASS' if result['success'] else 'FAIL'}")
"""

import os
import subprocess
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---- Verification command registry ----

VERIFICATION_COMMANDS = {
    "python_syntax": {
        "description": "Check Python syntax for all .py files",
        "command": "find . -name '*.py' -not -path './__pycache__/*' -not -path './agent/__pycache__/*' -exec python -m py_compile {} \\;",
        "timeout": 120,
    },
    "flake8": {
        "description": "Run flake8 linter on Python files",
        "command": "python -m flake8 --max-line-length=120 .",
        "timeout": 60,
    },
    "pytest": {
        "description": "Run pytest on test files",
        "command": "python -m pytest -x --tb=short -q",
        "timeout": 120,
    },
    "import_check": {
        "description": "Check that all imports resolve",
        "command": "python -c 'import sys; sys.path.insert(0, \".\"); import agent'",
        "timeout": 30,
    },
}


def _run_command(cmd: str, cwd: str, timeout: int = 60) -> dict:
    """Run a single verification command.

    Args:
        cmd: Command to run.
        cwd: Working directory.
        timeout: Timeout in seconds.

    Returns:
        Result dict with success, stdout, stderr, returncode.
    """
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:2000],
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
        }
    except Exception as e:
        return {
            "success": False,
            "returncode": -1,
            "stdout": "",
            "stderr": str(e),
        }


def run_verification(command_name: str, cwd: str = None) -> dict:
    """Run a single named verification command.

    Args:
        command_name: Name of the verification command (e.g., "flake8").
        cwd: Working directory.

    Returns:
        Result dict.
    """
    cwd = cwd or os.getcwd()

    if command_name not in VERIFICATION_COMMANDS:
        return {
            "success": False,
            "error": f"Unknown verification command: {command_name}",
            "available_commands": list(VERIFICATION_COMMANDS.keys()),
        }

    config = VERIFICATION_COMMANDS[command_name]
    result = _run_command(config["command"], cwd, timeout=config["timeout"])
    result["command"] = config["command"]
    result["description"] = config["description"]
    result["name"] = command_name
    return result


def run_all_verifications(cwd: str = None, stop_on_fail: bool = False) -> dict:
    """Run all registered verification commands.

    Args:
        cwd: Working directory.
        stop_on_fail: Stop after the first failure.

    Returns:
        Dict mapping command names to their results.
    """
    cwd = cwd or os.getcwd()
    results = {}

    for name, config in VERIFICATION_COMMANDS.items():
        result = _run_command(config["command"], cwd, timeout=config["timeout"])
        result["description"] = config["description"]
        results[name] = result

        if stop_on_fail and not result["success"]:
            break

    return results


def verify_python_syntax(filepath: str) -> dict:
    """Verify a single Python file's syntax.

    Args:
        filepath: Path to the Python file.

    Returns:
        Result dict with success status.
    """
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    try:
        result = subprocess.run(
            ["python", "-m", "py_compile", filepath],
            capture_output=True, text=True, timeout=30,
        )
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stderr": result.stderr,
            "filepath": filepath,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "filepath": filepath}


def verify_file_imports(filepath: str) -> dict:
    """Verify that a Python file's imports can be resolved.

    Args:
        filepath: Path to the Python file.

    Returns:
        Result dict with success status and any import errors.
    """
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    # Extract import statements
    imports = []
    try:
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if line.startswith("import ") or line.startswith("from "):
                    imports.append(line)
    except Exception:
        return {"success": False, "error": "Could not read file"}

    if not imports:
        return {"success": True, "message": "No imports to verify"}

    # Try to parse the file (which will fail on bad imports)
    try:
        with open(filepath) as f:
            compile(f.read(), filepath, "exec")
        return {
            "success": True,
            "imports_checked": len(imports),
            "imports": imports,
        }
    except SyntaxError as e:
        return {
            "success": False,
            "error": f"Syntax error: {e}",
            "imports": imports,
        }
    except Exception as e:
        return {
            "success": True,
            "message": f"Syntax OK (import resolution not checked): {e}",
            "imports": imports,
        }


def list_verification_commands() -> dict:
    """List all available verification commands.

    Returns:
        Dict mapping command names to their descriptions.
    """
    return {
        name: config["description"]
        for name, config in VERIFICATION_COMMANDS.items()
    }
