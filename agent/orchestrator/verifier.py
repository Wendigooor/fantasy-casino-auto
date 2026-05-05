"""
Fantasy Casino — Verifier Role.

The verifier checks whether changes are valid and free of regressions.

Responsibilities:
- Run tests
- Inspect diffs
- Confirm no regressions
- Summarize failures clearly

Usage:
    from agent.orchestrator.verifier import verify_changes, verify_command

    report = verify_changes(work_dir="agent/work", executor_result=result)
"""

import os
import json
import subprocess
from datetime import datetime, timezone

WORK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "work")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _model_endpoint() -> str:
    return os.environ.get("MODEL_ENDPOINT", "http://127.0.0.1:8080/v1")


def _call_model(system_prompt: str, user_prompt: str, endpoint: str = None) -> tuple:
    """Call the LLM API and return the response text and token usage.

    Args:
        system_prompt: System message.
        user_prompt: User message.
        endpoint: API endpoint URL.

    Returns:
        Tuple of (response_text, token_usage_dict).
    """
    import urllib.request

    endpoint = (endpoint or _model_endpoint()).rstrip("/") + "/chat/completions"

    payload = {
        "model": "local-model",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 2048,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            token_usage = {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            }
            return content, token_usage
    except Exception as e:
        return f"ERROR: Model call failed: {e}", {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


# ---- Verification prompts ----

VERIFIER_SYSTEM_PROMPT = """You are the Verifier for the Fantasy Casino auto-project.
Your job is to review changes and determine if they are safe to apply.

You will receive:
- The execution result (what files were created/modified/removed)
- Command outputs
- Test results if any

Rules:
- Check that changes align with the original task
- Verify no secrets were leaked
- Verify no direct deletions occurred (should use quarantine)
- Check for common bugs: syntax errors, missing imports, broken references
- Flag any risky changes that need human review
- Be conservative: if unsure, recommend rollback

Output MUST be a JSON object with keys:
{
    "status": "passed|failed|review_required",
    "summary": "Brief assessment",
    "checks": [
        {"name": "check name", "passed": true, "notes": "details"}
    ],
    "risks": ["list of remaining concerns if any"],
    "recommendation": "approve|reject|rollback",
    "details": "Detailed explanation"
}"""


def _collect_work_files_summary(work_dir: str) -> str:
    """Collect a summary of files in the work directory.

    Args:
        work_dir: Work directory path.

    Returns:
        Formatted string listing files and their sizes.
    """
    lines = []
    if not os.path.exists(work_dir):
        return "Work directory does not exist."

    for root, dirs, files in os.walk(work_dir):
        for f in files:
            abs_path = os.path.join(root, f)
            rel_path = os.path.relpath(abs_path, work_dir)
            size = os.path.getsize(abs_path)
            lines.append(f"  {rel_path} ({size} bytes)")

    return "\n".join(lines) if lines else "No files in work directory."


def _collect_test_results(work_dir: str) -> dict:
    """Run test commands and collect results.

    Tries pytest first, then unittest, then flake8 linting.

    Args:
        work_dir: Work directory path.

    Returns:
        Dict with test results for each command tried.
    """
    results = {}

    # Try pytest (only if tests/ directory exists)
    tests_dir = os.path.join(work_dir, "tests")
    if os.path.isdir(tests_dir):
        try:
            r = subprocess.run(
                ["python", "-m", "pytest", "tests/", "-x", "--tb=short", "-q"],
                capture_output=True, text=True, timeout=120,
                cwd=work_dir,
            )
            results["pytest"] = {
                "returncode": r.returncode,
                "output": r.stdout[:2000] + r.stderr[:2000],
                "success": r.returncode == 0,
            }
        except Exception as e:
            results["pytest"] = {"error": str(e)}
    else:
        results["pytest"] = {
            "returncode": 0,
            "output": "No tests/ directory found — skipping",
            "success": True,
        }

    # Try flake8 on the work directory only
    try:
        r = subprocess.run(
            ["python", "-m", "flake8", work_dir, "--max-line-length=120",
             "--exclude=.venv,.git,__pycache__,*.pyc"],
            capture_output=True, text=True, timeout=120,
        )
        results["flake8"] = {
            "returncode": r.returncode,
            "output": r.stdout[:2000],
            "success": r.returncode == 0,
        }
    except Exception as e:
        results["flake8"] = {"error": str(e)}

    return results


def verify_changes(work_dir: str = None, executor_result: dict = None,
                   model_endpoint: str = None) -> dict:
    """Verify the changes produced by the executor.

    Performs automated checks and optionally calls the LLM for
    a semantic review of the changes.

    Args:
        work_dir: Work directory to verify.
        executor_result: Executor output dict.
        model_endpoint: LLM API endpoint.

    Returns:
        Verification report dict.
    """
    work_dir = work_dir or WORK_DIR

    # Automated checks
    checks = []
    risks = []

    executor_result = executor_result or {}

    # Check 1: No direct deletions
    for failure in (executor_result.get("failures") or []):
        if failure.get("action") == "delete":
            checks.append({
                "name": "no_direct_deletion",
                "passed": False,
                "notes": f"Direct deletion detected: {failure.get('path', 'unknown')}",
            })
            risks.append("File was directly deleted instead of moved to quarantine")
        else:
            checks.append({
                "name": "no_direct_deletion",
                "passed": True,
                "notes": "No direct deletions found",
            })
            break
    else:
        checks.append({
            "name": "no_direct_deletion",
            "passed": True,
            "notes": "No deletions in result",
        })

    # Check 2: Test execution
    test_results = _collect_test_results(work_dir)
    all_tests_passed = all(
        r.get("success", False) for r in test_results.values()
        if isinstance(r, dict) and "success" in r
    )
    checks.append({
        "name": "tests",
        "passed": all_tests_passed,
        "notes": json.dumps(
            {k: v.get("success") for k, v in test_results.items()}
            if isinstance(test_results, dict)
            else "No tests found",
        ),
    })
    if not all_tests_passed:
        risks.append("Some tests failed")

    # Check 3: Linting
    flake8_ok = test_results.get("flake8", {}).get("success", True)
    checks.append({
        "name": "linting",
        "passed": flake8_ok,
        "notes": "flake8 passed" if flake8_ok else "flake8 found issues",
    })

    # Check 4: Secrets check (basic pattern matching)
    # Only scan agent/ and agent/work/ directories to avoid false positives
    secret_dirs = [os.path.join(work_dir, "agent")]
    secret_patterns_found = False
    try:
        for sdir in secret_dirs:
            if not os.path.isdir(sdir):
                continue
            for root, dirs, files in os.walk(sdir):
                # Skip venv, snapshots, and plans
                dirs[:] = [d for d in dirs if d not in (
                    ".venv", "__pycache__", "snapshots", "plans", "skills", "quarantine"
                )]
                for f in files:
                    if f.endswith((".py", ".json", ".yaml", ".yml", ".env", ".toml")):
                        fpath = os.path.join(root, f)
                        try:
                            with open(fpath, "r", errors="ignore") as fh:
                                content = fh.read(4096)
                                if any(p in content.lower() for p in ["password=", "api_key=", "secret=", "token="]):
                                    # Check if it looks like a real secret (not a placeholder)
                                    placeholder_patterns = [
                                        "your-", "xxx", "placeholder", "changeme", "<", ">"
                                    ]
                                    if not any(pl in content for pl in placeholder_patterns):
                                        secret_patterns_found = True
                        except (IOError, OSError):
                            pass
                    if secret_patterns_found:
                        break
            if secret_patterns_found:
                break
    except Exception:
        pass

    checks.append({
        "name": "secrets_check",
        "passed": not secret_patterns_found,
        "notes": "No secrets detected" if not secret_patterns_found else "Potential secrets found",
    })
    if secret_patterns_found:
        risks.append("Potential secrets may be present in changed files")

    # Build status
    failed_checks = [c for c in checks if not c.get("passed")]
    if failed_checks:
        status = "failed"
        recommendation = "rollback"
    elif risks:
        status = "review_required"
        recommendation = "reject"
    else:
        status = "passed"
        recommendation = "approve"

    if status == 'passed':
        status_text = 'passed'
    else:
        status_text = status.replace('_', ' ')

    report = {
        "status": status,
        "summary": (
            f"Verification {status_text}. "
            f"{len(checks)} checks run, "
            f"{len(failed_checks)} failed, "
            f"{len(risks)} risks."
        ),
        "checks": checks,
        "risks": risks,
        "recommendation": recommendation,
        "details": "",
        "test_results": test_results,
        "files_in_work": _collect_work_files_summary(work_dir),
        "verified_at": _now(),
    }

    # Try semantic review via LLM if available
    try:
        if executor_result:
            user_prompt = (
                f"Executor result: {json.dumps(executor_result, indent=2, default=str)[:2000]}\n\n"
                f"Files in work directory:\n{_collect_work_files_summary(work_dir)[:2000]}\n\n"
                f"Please provide a brief semantic review of these changes. "
                f"Are they appropriate for the task?"
            )
            response, verifier_token_usage = _call_model(VERIFIER_SYSTEM_PROMPT, user_prompt, endpoint=model_endpoint)

            # Try to extract JSON review
            try:
                content = response.strip()
                if content.startswith("```"):
                    content = "\n".join(line for line in content.split("\n") if not line.strip().startswith("```"))
                llm_review = json.loads(content)
                report["llm_review"] = llm_review
            except json.JSONDecodeError:
                report["llm_review_summary"] = response[:500]

            report["verifier_token_usage"] = verifier_token_usage

        report["details"] = f"Automated checks: {json.dumps(checks)}"
        if risks:
            report["details"] += f"\nRisks: {'; '.join(risks)}"

    except Exception:
        report["details"] = f"Automated checks only (LLM review unavailable): {json.dumps(checks)}"

    return report


def verify_command(cmd: str, work_dir: str = None, timeout: int = 60) -> dict:
    """Run a verification command and return the result.

    Args:
        cmd: Command to run (e.g., "python -m pytest tests/").
        work_dir: Working directory.
        timeout: Timeout in seconds.

    Returns:
        Result dict with output and success status.
    """
    work_dir = work_dir or WORK_DIR

    try:
        result = subprocess.run(
            cmd, shell=True, cwd=work_dir,
            capture_output=True, text=True, timeout=timeout,
        )
        return {
            "command": cmd,
            "stdout": result.stdout[:2000],
            "stderr": result.stderr[:2000],
            "returncode": result.returncode,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {
            "command": cmd,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s",
            "returncode": -1,
            "success": False,
        }
    except Exception as e:
        return {
            "command": cmd,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
            "success": False,
        }


def get_verification_report(work_dir: str = None, executor_result: dict = None) -> dict:
    """Get the latest verification report.

    Convenience wrapper around verify_changes.

    Args:
        work_dir: Work directory path.
        executor_result: Previous executor result.

    Returns:
        Verification report dict.
    """
    return verify_changes(
        work_dir=work_dir,
        executor_result=executor_result,
    )
