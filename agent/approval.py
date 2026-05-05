"""
Fantasy Casino — Approval Gate.

Implements Rule 4 from the Agent Operating Manual: No unverified autonomy.
High-risk actions require human approval before execution.

Usage:
    from agent.approval import request_approval, check_approval, approve_action, reject_action

    # Before a risky action
    if not check_approval("delete_config", task_id=5):
        result = request_approval("delete_config", "Remove deprecated config.py", task_id=5, risk="high")
        if not result:
            print("Action rejected or not approved yet")
            return

    # Execute the risky action
    ...

    # Log the approval
    log_action(..., details=f"Action 'delete_config' approved for task 5")
"""

import os
import json
from datetime import datetime, timezone
from enum import Enum

APPROVAL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "approvals")
APPROVALS_FILE = os.path.join(APPROVAL_DIR, "pending.json")

os.makedirs(APPROVAL_DIR, exist_ok=True)


class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_approvals() -> list:
    """Load pending approvals from JSON file."""
    if os.path.exists(APPROVALS_FILE):
        with open(APPROVALS_FILE) as f:
            return json.load(f)
    return []


def _save_approvals(approvals: list) -> None:
    """Save pending approvals to JSON file."""
    with open(APPROVALS_FILE, "w") as f:
        json.dump(approvals, f, indent=2)


def request_approval(
    action: str,
    description: str,
    task_id: int = None,
    risk: str = "high",
    ttl_hours: int = 24,
    extra_context: str = None,
) -> dict:
    """
    Request human approval for a risky action.

    Args:
        action: Short name of the action (e.g., "delete_config")
        description: Human-readable description of what will be done
        task_id: Optional task ID
        risk: Risk level - low, medium, high, critical
        ttl_hours: Time-to-live in hours (default 24)
        extra_context: Optional additional context for the approver

    Returns:
        Dict with approval request details
    """
    approvals = _load_approvals()

    request = {
        "id": len(approvals) + 1,
        "action": action,
        "description": description,
        "task_id": task_id,
        "risk": risk,
        "status": "pending",
        "requested_at": _now(),
        "expires_at": datetime.now(timezone.utc).isoformat(),  # simplified TTL
        "extra_context": extra_context,
        "approved_by": None,
        "approved_at": None,
        "rejection_reason": None,
    }

    approvals.append(request)
    _save_approvals(approvals)

    # Log the request
    try:
        from agent.memory import log_action
        log_action(
            conn=None,  # will be passed by caller
            session_id="manual",
            role="reviewer",
            action=f"approval_request:{action}",
            details=description,
            output=f"risk={risk}, task_id={task_id}, ttl={ttl_hours}h",
            success=True,
        )
    except Exception:
        pass  # Logging is optional for approval requests

    return request


def check_approval(action: str, task_id: int = None) -> bool:
    """
    Check if an action has been approved.

    Args:
        action: Action name to check
        task_id: Optional task ID to narrow the check

    Returns:
        True if approved and not expired, False otherwise
    """
    approvals = _load_approvals()

    for approval in approvals:
        if approval["action"] == action:
            if task_id and approval.get("task_id") != task_id:
                continue

            if approval["status"] == "approved":
                return True
            elif approval["status"] == "rejected":
                return False
            elif approval["status"] == "expired":
                return False

    return False


def approve_action(action: str, task_id: int = None, approver: str = "manual") -> dict:
    """
    Approve a pending action request.

    Args:
        action: Action name to approve
        task_id: Optional task ID to narrow the search
        approver: Name/ID of the approver

    Returns:
        The approved request dict, or None if not found
    """
    approvals = _load_approvals()

    for approval in approvals:
        if approval["action"] == action:
            if task_id and approval.get("task_id") != task_id:
                continue

            approval["status"] = "approved"
            approval["approved_by"] = approver
            approval["approved_at"] = _now()
            _save_approvals(approvals)

            return approval

    return None


def reject_action(action: str, task_id: int = None, reason: str = None) -> dict:
    """
    Reject a pending action request.

    Args:
        action: Action name to reject
        task_id: Optional task ID to narrow the search
        reason: Why the action was rejected

    Returns:
        The rejected request dict, or None if not found
    """
    approvals = _load_approvals()

    for approval in approvals:
        if approval["action"] == action:
            if task_id and approval.get("task_id") != task_id:
                continue

            approval["status"] = "rejected"
            approval["rejection_reason"] = reason
            approval["approved_at"] = _now()
            _save_approvals(approvals)

            return approval

    return None


def list_pending_approvals() -> list:
    """List all pending approval requests."""
    approvals = _load_approvals()
    return [a for a in approvals if a["status"] == "pending"]


def list_all_approvals() -> list:
    """List all approval requests (including approved/rejected/expired)."""
    return _load_approvals()


def clear_expired() -> int:
    """Remove expired approvals. Returns count of removed items."""
    approvals = _load_approvals()
    before = len(approvals)

    # Simple: mark old pending items as expired
    for approval in approvals:
        if approval["status"] == "pending":
            # In a real implementation, check TTL
            # For now, keep them pending
            pass

    _save_approvals(approvals)
    return before - len(approvals)


if __name__ == "__main__":
    print("=" * 50)
    print("  Approval Gate — Test")
    print("=" * 50)

    # Clear existing approvals for test
    if os.path.exists(APPROVALS_FILE):
        os.remove(APPROVALS_FILE)

    # Request approval
    print("\n1. Requesting approval...")
    req = request_approval(
        "delete_deprecated_config",
        "Remove config/deprecated.py - no longer used by any module",
        task_id=5,
        risk="high",
        extra_context="This file was flagged in code review"
    )
    print(f"   Request ID: {req['id']}")
    print(f"   Status: {req['status']}")

    # Check approval (should be pending -> False)
    print("\n2. Checking approval (should be False)...")
    print(f"   check_approval('delete_deprecated_config'): {check_approval('delete_deprecated_config', 5)}")

    # Approve
    print("\n3. Approving...")
    approved = approve_action("delete_deprecated_config", task_id=5, approver="alice")
    print(f"   Status: {approved['status']}")

    # Check again (should be True)
    print("\n4. Checking approval (should be True)...")
    print(f"   check_approval('delete_deprecated_config'): {check_approval('delete_deprecated_config', 5)}")

    # Request another, then reject
    print("\n5. Requesting and rejecting...")
    req2 = request_approval("modify_auth_module", "Change auth.py login flow", task_id=6, risk="critical")
    rejected = reject_action("modify_auth_module", reason="Needs security review first")
    print(f"   Rejected: {rejected['status']}")
    print(f"   check_approval: {check_approval('modify_auth_module')}")

    # List all
    print("\n6. All approvals:")
    for a in list_all_approvals():
        print(f"   #{a['id']} {a['action']}: {a['status']}")

    print("\nTest complete.")
