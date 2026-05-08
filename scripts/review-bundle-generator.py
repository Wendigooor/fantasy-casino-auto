#!/usr/bin/env python3
"""Wrapper that delegates to agent-task-manager review-bundle-generator."""
import sys, os, subprocess

atm_script = os.path.expanduser("~/projects/agent-task-manager/scripts/review-bundle-generator.py")
if not os.path.exists(atm_script):
    print(f"ERROR: ATM review-bundle-generator not found at {atm_script}")
    print("Install agent-task-manager or clone to ~/projects/agent-task-manager")
    sys.exit(1)

cmd = [sys.executable, atm_script] + sys.argv[1:]
sys.exit(subprocess.run(cmd).returncode)
