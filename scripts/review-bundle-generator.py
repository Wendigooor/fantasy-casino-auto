#!/usr/bin/env python3
"""Wrapper that finds ATM's review-bundle-generator and delegates to it."""

import sys, os, subprocess

search_paths = [
    os.environ.get("ATM_HOME", ""),
    os.path.expanduser("~/Documents/projects/agent-task-manager"),
    os.path.expanduser("~/projects/agent-task-manager"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agent-task-manager"),
]

atm_script = None
for base in search_paths:
    if not base:
        continue
    candidate = os.path.join(base, "scripts", "review-bundle-generator.py")
    if os.path.exists(candidate):
        atm_script = candidate
        break

if not atm_script:
    print(
        "ERROR: ATM review-bundle-generator not found.\n"
        "Install agent-task-manager to one of:\n"
        + "\n".join(f"  - {p}" for p in search_paths if p) + "\n"
        "Or set ATM_HOME environment variable.",
        file=sys.stderr,
    )
    sys.exit(1)

cmd = [sys.executable, atm_script] + sys.argv[1:]
sys.exit(subprocess.run(cmd).returncode)
