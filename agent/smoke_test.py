#!/usr/bin/env python3
"""Smoke test: verify all agent modules are importable and key functions work."""
import sys
import os
import subprocess

sys.path.insert(0, ".")

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"

results = []

def check(name, fn):
    try:
        fn()
        results.append((name, True))
        print(f"  {PASS} {name}")
    except Exception as e:
        results.append((name, False))
        print(f"  {FAIL} {name}: {e}")

def main():
    print("Agent Smoke Test\n")

    check("memory.get_conn", lambda: __import__("agent.memory", fromlist=["get_conn"]).get_conn())
    check("taskboard.list_milestones", lambda: len(__import__("agent.taskboard", fromlist=["list_milestones"]).list_milestones()) >= 0)
    check("taskboard.list_work_items", lambda: len(__import__("agent.taskboard", fromlist=["list_work_items"]).list_work_items()) >= 0)
    check("quarantine (import)", lambda: __import__("agent.quarantine"))
    check("snapshots (import)", lambda: __import__("agent.snapshots"))
    check("approval (import)", lambda: __import__("agent.approval"))
    check("task_intake (import)", lambda: __import__("agent.task_intake"))
    check("plan_maintainer (import)", lambda: __import__("agent.plan_maintainer"))
    check("prompts.base (import)", lambda: __import__("agent.prompts.base"))
    check("core.wallet (import)", lambda: __import__("agent.core.wallet"))

    # Verify no syntax errors
    agent_dir = os.path.join(os.path.dirname(__file__))
    for root, _, files in os.walk(agent_dir):
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                try:
                    subprocess.run(
                        [sys.executable, "-m", "py_compile", path],
                        capture_output=True, check=True
                    )
                except subprocess.CalledProcessError as e:
                    results.append((f"compiles: {path}", False))
                    print(f"  {FAIL} compiles: {path}")

    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"\n  {passed}/{total} checks passed")
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
