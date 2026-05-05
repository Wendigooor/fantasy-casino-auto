"""
Fantasy Casino — Analytics Event Contract.

Maps analytics events to the casino domain model. Each event type has a
defined schema of required and optional fields for validation at ingestion
time.

Usage:
    from agent.analytics_contract import (
        EVENTS, validate_event_schema, get_event_schema,
        list_events, get_events_by_property, store_events_in_db,
        get_analytics_events, print_contract_summary,
    )

    store_events_in_db()
    print_contract_summary()
"""

import os
import sys
import json
import sqlite3
from datetime import datetime, timezone

_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


EVENTS = {

    # ------------------------------------------------------------------ AUTH
    "user_registered": {
        "category": "AUTH",
        "description": "A new user created an account.",
        "required_fields": ["user_id", "email", "ip", "source"],
        "optional_fields": [],
    },
    "user_login": {
        "category": "AUTH",
        "description": "A user attempted to log in.",
        "required_fields": ["user_id", "ip", "success"],
        "optional_fields": ["user_agent"],
    },
    "session_created": {
        "category": "AUTH",
        "description": "A new session was created for a user.",
        "required_fields": ["session_id", "user_id", "expires_at"],
        "optional_fields": [],
    },
    "session_expired": {
        "category": "AUTH",
        "description": "A session expired.",
        "required_fields": ["session_id", "user_id"],
        "optional_fields": [],
    },
    "password_changed": {
        "category": "AUTH",
        "description": "A user changed their password.",
        "required_fields": ["user_id"],
        "optional_fields": [],
    },

    # ---------------------------------------------------------------- WALLET
    "wallet_funded": {
        "category": "WALLET",
        "description": "A user funded their wallet.",
        "required_fields": ["user_id", "amount", "currency", "method", "tx_id"],
        "optional_fields": [],
    },
    "wallet_withdrawn": {
        "category": "WALLET",
        "description": "A user withdrew funds from their wallet.",
        "required_fields": ["user_id", "amount", "currency", "method", "tx_id"],
        "optional_fields": [],
    },
    "balance_inquired": {
        "category": "WALLET",
        "description": "A user checked their wallet balance.",
        "required_fields": ["user_id", "balance"],
        "optional_fields": [],
    },
    "transaction_completed": {
        "category": "WALLET",
        "description": "A wallet-to-wallet transaction completed.",
        "required_fields": [
            "user_id", "tx_id", "from_wallet_id",
            "to_wallet_id", "amount",
        ],
        "optional_fields": [],
    },
    "bonus_credited": {
        "category": "WALLET",
        "description": "A bonus was credited to a user.",
        "required_fields": ["user_id", "amount", "bonus_type", "txn_id"],
        "optional_fields": [],
    },
    "bonus_wagered": {
        "category": "WALLET",
        "description": "A bonus was wagered on a game round.",
        "required_fields": [
            "user_id", "amount", "game_id",
            "round_id", "wager_id",
        ],
        "optional_fields": [],
    },
    "bonus_won": {
        "category": "WALLET",
        "description": "A bonus-related win was recorded.",
        "required_fields": [
            "user_id", "amount", "game_id",
            "round_id", "wager_id",
        ],
        "optional_fields": [],
    },
    "bonus_expired": {
        "category": "WALLET",
        "description": "A bonus expired without use.",
        "required_fields": ["user_id", "amount", "bonus_id"],
        "optional_fields": [],
    },

    # ------------------------------------------------------------------ GAME
    "game_launched": {
        "category": "GAME",
        "description": "A game was launched by a user.",
        "required_fields": ["user_id", "game_id", "provider_id", "game_type"],
        "optional_fields": [],
    },
    "round_started": {
        "category": "GAME",
        "description": "A new round began in a game.",
        "required_fields": ["user_id", "game_id", "round_id", "stake_amount"],
        "optional_fields": [],
    },
    "round_completed": {
        "category": "GAME",
        "description": "A round completed with a win.",
        "required_fields": [
            "user_id", "game_id", "round_id",
            "stake_amount", "win_amount", "multiplier",
        ],
        "optional_fields": [],
    },
    "round_lost": {
        "category": "GAME",
        "description": "A round completed with a loss.",
        "required_fields": ["user_id", "game_id", "round_id", "stake_amount"],
        "optional_fields": [],
    },
    "bet_placed": {
        "category": "GAME",
        "description": "A bet was placed inside a game round.",
        "required_fields": ["user_id", "game_id", "round_id", "bet_type", "amount"],
        "optional_fields": [],
    },
    "game_error": {
        "category": "GAME",
        "description": "An error occurred during game play.",
        "required_fields": ["user_id", "game_id", "round_id", "error_code", "message"],
        "optional_fields": [],
    },
    "provider_response": {
        "category": "GAME",
        "description": "A game provider returned a response.",
        "required_fields": [
            "provider_id", "game_id", "round_id",
            "response_time_ms", "status_code",
        ],
        "optional_fields": [],
    },

    # ------------------------------------------------------------------ BONUS
    "bonus_offered": {
        "category": "BONUS",
        "description": "A bonus was offered to a user.",
        "required_fields": ["user_id", "bonus_type", "amount", "conditions"],
        "optional_fields": [],
    },
    "bonus_claimed": {
        "category": "BONUS",
        "description": "A user claimed a bonus offer.",
        "required_fields": ["user_id", "bonus_id", "bonus_type", "amount"],
        "optional_fields": [],
    },
    "bonus_terms_accepted": {
        "category": "BONUS",
        "description": "A user accepted bonus terms.",
        "required_fields": ["user_id", "bonus_id"],
        "optional_fields": [],
    },
    "bonus_turnover_check": {
        "category": "BONUS",
        "description": "A turnover (wagering requirement) check was performed.",
        "required_fields": [
            "user_id", "bonus_id",
            "current_turnover", "required_turnover",
        ],
        "optional_fields": [],
    },

    # -------------------------------------------------------------------- KYC
    "kyc_started": {
        "category": "KYC",
        "description": "KYC verification was started by a user.",
        "required_fields": ["user_id", "id_document_type"],
        "optional_fields": [],
    },
    "kyc_document_uploaded": {
        "category": "KYC",
        "description": "An identity document was uploaded during KYC.",
        "required_fields": ["user_id", "id_document_type", "file_name"],
        "optional_fields": [],
    },
    "kyc_approved": {
        "category": "KYC",
        "description": "KYC verification was approved.",
        "required_fields": ["user_id", "approved_by"],
        "optional_fields": [],
    },
    "kyc_rejected": {
        "category": "KYC",
        "description": "KYC verification was rejected.",
        "required_fields": ["user_id", "rejection_reason", "reviewed_by"],
        "optional_fields": [],
    },
    "kyc_expired": {
        "category": "KYC",
        "description": "A user's KYC status expired.",
        "required_fields": ["user_id"],
        "optional_fields": [],
    },

    # ------------------------------------------------------------------ RISK
    "risk_flagged": {
        "category": "RISK",
        "description": "A user was flagged by risk monitoring.",
        "required_fields": ["user_id", "risk_score", "risk_category", "flags"],
        "optional_fields": [],
    },
    "transaction_reviewed": {
        "category": "RISK",
        "description": "A transaction was reviewed by a compliance officer.",
        "required_fields": ["tx_id", "user_id", "reviewer_id", "outcome"],
        "optional_fields": [],
    },
    "account_suspended": {
        "category": "RISK",
        "description": "An account was suspended.",
        "required_fields": ["user_id", "reason", "duration", "initiated_by"],
        "optional_fields": [],
    },
    "account_unsuspended": {
        "category": "RISK",
        "description": "A previously suspended account was unsuspended.",
        "required_fields": ["user_id", "initiated_by"],
        "optional_fields": [],
    },

    # ------------------------------------------------------------ ANALYTICS
    "page_view": {
        "category": "ANALYTICS",
        "description": "A page was viewed in the application.",
        "required_fields": ["user_id", "page_path", "referrer", "session_id"],
        "optional_fields": [],
    },
    "dashboard_accessed": {
        "category": "ANALYTICS",
        "description": "A dashboard was accessed by a user.",
        "required_fields": ["user_id", "dashboard_id"],
        "optional_fields": [],
    },
    "report_generated": {
        "category": "ANALYTICS",
        "description": "A report was generated by a user.",
        "required_fields": ["user_id", "report_type", "parameters"],
        "optional_fields": [],
    },

    # ----------------------------------------------------------------- ADMIN
    "config_changed": {
        "category": "ADMIN",
        "description": "A configuration value was changed.",
        "required_fields": ["admin_id", "config_key", "old_value", "new_value"],
        "optional_fields": [],
    },
    "user_banned": {
        "category": "ADMIN",
        "description": "A user was banned by an admin.",
        "required_fields": ["admin_id", "banned_user_id", "reason"],
        "optional_fields": [],
    },
    "user_unbanned": {
        "category": "ADMIN",
        "description": "A banned user was unbanned by an admin.",
        "required_fields": ["admin_id", "banned_user_id"],
        "optional_fields": [],
    },
    "game_config_changed": {
        "category": "ADMIN",
        "description": "A game configuration was changed.",
        "required_fields": [
            "admin_id", "game_id", "field",
            "old_value", "new_value",
        ],
        "optional_fields": [],
    },
    "provider_configured": {
        "category": "ADMIN",
        "description": "A game provider was configured.",
        "required_fields": ["admin_id", "provider_id", "config_keys"],
        "optional_fields": [],
    },
}

# -----------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------


def validate_event_schema(event_name, properties):
    """Validate that *properties* contains all required fields for *event_name*.

    Args:
        event_name: Name of the event to validate against.
        properties: Dict of event payload properties.

    Returns:
        Dict with keys ``valid``, ``missing``, and ``errors``.
    """
    schema = get_event_schema(event_name)
    if schema is None:
        return {
            "valid": False,
            "missing": [],
            "errors": [f"Unknown event: {event_name}"],
        }

    missing = [
        f for f in schema["required_fields"]
        if f not in properties
    ]

    errors = []
    # All valid fields are required + optional
    valid_fields = set(schema.get("required_fields", [])) | set(schema.get("optional_fields", []))
    unknown = [k for k in properties if k not in valid_fields]
    if unknown:
        errors.append(f"Unexpected fields: {', '.join(unknown)}")

    return {
        "valid": len(missing) == 0 and len(errors) == 0,
        "missing": missing,
        "errors": errors,
    }


def get_event_schema(event_name):
    """Return the full schema dict for *event_name*, or ``None`` if unknown."""
    event = EVENTS.get(event_name)
    if event is None:
        return None
    return {
        "category": event["category"],
        "description": event["description"],
        "required_fields": list(event["required_fields"]),
        "optional_fields": list(event["optional_fields"]),
    }


def list_events(category=None):
    """List all event names, optionally filtered by *category*.

    Args:
        category: If given, only events in that category are returned.

    Returns:
        Sorted list of event name strings.
    """
    if category is None:
        return sorted(EVENTS.keys())
    return sorted(
        name for name, ev in EVENTS.items()
        if ev["category"] == category
    )


def get_events_by_property(prop_name):
    """Find all events that contain *prop_name* in their field list.

    Args:
        prop_name: Property name to search for.

    Returns:
        Sorted list of event name strings.
    """
    result = []
    for name, ev in EVENTS.items():
        all_fields = list(ev["required_fields"]) + list(ev.get("optional_fields", []))
        if prop_name in all_fields:
            result.append(name)
    return sorted(result)


def store_events_in_db(db_path=None):
    """Store event definitions into the ``analytics_events`` table.

    Args:
        db_path: Path to the SQLite database. Defaults to ``plans.db``
                 in the agent directory.
    """
    if db_path is None:
        _dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(_dir, "plans.db")

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                event_name TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                description TEXT,
                required_fields TEXT,
                optional_fields TEXT,
                created_at TEXT NOT NULL
            )
        """)

        conn.execute("DELETE FROM analytics_events WHERE event_name IN ({})".format(",".join("?" for _ in EVENTS)))

        for event_name, ev in EVENTS.items():
            conn.execute(
                """INSERT INTO analytics_events
                   (event_name, category, description, required_fields,
                    optional_fields, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    event_name,
                    ev["category"],
                    ev["description"],
                    json.dumps(ev["required_fields"]),
                    json.dumps(ev.get("optional_fields", [])),
                    _now(),
                ),
            )

        conn.commit()
    finally:
        conn.close()


def get_analytics_events(db_path=None):
    """Read event definitions from the database.

    Args:
        db_path: Path to the SQLite database.

    Returns:
        List of dicts, one per event row.
    """
    if db_path is None:
        _dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(_dir, "plans.db")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT event_name, category, description, "
            "required_fields, optional_fields, created_at "
            "FROM analytics_events ORDER BY event_name"
        ).fetchall()
        return [
            {
                "event_name": row["event_name"],
                "category": row["category"],
                "description": row["description"],
                "required_fields": json.loads(row["required_fields"]),
                "optional_fields": json.loads(row["optional_fields"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def print_contract_summary(db_path=None):
    """Print a human-readable summary of the event contract.

    Args:
        db_path: Path to the SQLite database.
    """
    categories = {}
    for name, ev in EVENTS.items():
        cat = ev["category"]
        categories.setdefault(cat, []).append(name)

    print()
    print("=" * 60)
    print("  ANALYTICS EVENT CONTRACT SUMMARY")
    print("=" * 60)
    print(f"  Total events: {len(EVENTS)}")
    print(f"  Categories:   {len(categories)}")
    print()

    for cat in sorted(categories):
        events = categories[cat]
        print(f"  [{cat}] ({len(events)} events)")
        for name in sorted(events):
            ev = EVENTS[name]
            req = ", ".join(ev["required_fields"]) or "(none)"
            print(f"    {name:35s}  fields: {req}")
        print()

    print("=" * 60)

    if db_path is not None:
        events_from_db = get_analytics_events(db_path)
        if events_from_db:
            print(f"  Stored in database: {len(events_from_db)} events  ({db_path})")
        else:
            print("  Database has no analytics_events rows yet.")
    print()


# -----------------------------------------------------------------------
# CLI entry point
# -----------------------------------------------------------------------

if __name__ == "__main__":
    db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.db")
    store_events_in_db(db)
    print_contract_summary(db)
