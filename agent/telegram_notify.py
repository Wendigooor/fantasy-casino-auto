"""
Fantasy Casino — Telegram notification module.

Uses the format defined in research/12-telegram-status-format.md.
Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.

If no token is configured, messages are logged to agent/logs/ instead.
"""

import os
import httpx
from datetime import datetime, timezone

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S UTC")


def _format_status(task_id, role, doing, focus=None, status_text=None,
                   blocker=None, risk="low", next_step=None):
    lines = [f"[{_now()}] Task {task_id} | role: {role}"]
    lines.append(f"  Doing: {doing}")
    if focus:
        lines.append(f"  Focus: {focus}")
    if status_text:
        lines.append(f"  Status: {status_text}")
    if blocker:
        lines.append(f"  Blocker: {blocker}")
        lines.append(f"  Risk: {risk}")
        lines.append(f"  Need: {next_step or 'clarification'}")
    else:
        lines.append(f"  Risk: {risk}")
        if next_step:
            lines.append(f"  Next: {next_step}")
    return "\n".join(lines)


def _write_to_log(message: str, level: str = "info") -> None:
    os.makedirs(LOGS_DIR, exist_ok=True)
    log_file = os.path.join(LOGS_DIR, "notifications.log")
    with open(log_file, "a") as f:
        f.write(f"[{level.upper()}] {message}\n")


def send(task_id, role, doing, focus=None, status_text=None,
         blocker=None, risk="low", next_step=None) -> bool:
    """
    Send a status update via Telegram or fall back to file logging.
    Returns True if sent via Telegram, False if logged to file.
    """
    message = _format_status(
        task_id, role, doing, focus, status_text, blocker, risk, next_step
    )

    # Telegram fallback: if no token configured, log to file
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        _write_to_log(message, "info")
        return False

    # Send via Telegram Bot API
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        httpx.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown",
        }, timeout=10)
        return True
    except Exception as e:
        _write_to_log(f"Telegram send failed: {e}", "error")
        _write_to_log(message, "warning")
        return False


def send_progress(task_id, what_changed, what_learned, what_next) -> bool:
    """Progress heartbeat - every 5 minutes while active."""
    message = _format_status(
        task_id,
        role="executor",
        doing="progress heartbeat",
        status_text=f"Changed: {what_changed}\nLearned: {what_learned}",
        next_step=what_next,
    )

    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        _write_to_log(message, "info")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        httpx.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "Markdown",
        }, timeout=10)
        return True
    except Exception as e:
        _write_to_log(f"Telegram heartbeat failed: {e}", "error")
        return False


def send_approval_request(task_id, action, details, risk="high") -> bool:
    """Request human approval before risky action."""
    return send(task_id, "reviewer", f"approval request: {action}",
                status_text=details, risk=risk,
                next_step="awaiting user approval")
