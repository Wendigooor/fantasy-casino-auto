"""
Fantasy Casino — Domain Entity Definitions.

Extracts and maps casino-specific domain entities from research documents
and the codebase. Provides a centralized ENTITIES dictionary with fields,
relationships, and table mappings, plus helpers to scan source code, store
definitions in SQLite, and print summaries.

Usage:
    from agent.casino_entities import ENTITIES, list_entities, get_entity

    entity = get_entity("USER")
    print(entity["fields"])

    all_names = list_entities()
    print(all_names)
"""

import os
import sys
import json
import sqlite3
import ast
from datetime import datetime, timezone

_PARENT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PARENT not in sys.path:
    sys.path.insert(0, _PARENT)


# ---------------------------------------------------------------------------
# Entity definitions
# ---------------------------------------------------------------------------

ENTITIES = {
    "USER": {
        "fields": [
            "id",
            "username",
            "email",
            "password_hash",
            "status",
            "created_at",
            "updated_at",
            "kyc_status",
            "risk_level",
            "balance",
            "referral_code",
        ],
        "relationships": [
            "has_many -> WALLET",
            "has_many -> SESSION",
            "has_many -> TRANSACTION",
            "has_many -> BONUS",
        ],
        "table_name": "users",
        "description": "Player account with authentication, KYC, risk profile, and wallet reference.",
    },
    "WALLET": {
        "fields": [
            "id",
            "user_id",
            "currency",
            "balance",
            "total_deposits",
            "total_withdrawals",
            "status",
            "created_at",
        ],
        "relationships": [
            "belongs_to -> USER",
            "has_many -> TRANSACTION",
        ],
        "table_name": "wallets",
        "description": "Player financial ledger with per-currency balance tracking.",
    },
    "BALANCE": {
        "fields": [
            "wallet_id",
            "available",
            "locked",
            "frozen",
            "created_at",
            "updated_at",
        ],
        "relationships": [
            "belongs_to -> WALLET",
        ],
        "table_name": "balances",
        "description": "Granular balance breakdown with available, locked, and frozen portions.",
    },
    "TRANSACTION": {
        "fields": [
            "id",
            "wallet_id",
            "user_id",
            "type",
            "amount",
            "currency",
            "status",
            "reference_id",
            "ip",
            "metadata",
            "created_at",
        ],
        "relationships": [
            "belongs_to -> WALLET",
            "belongs_to -> USER",
        ],
        "table_name": "transactions",
        "description": "Append-only financial event (deposit, withdrawal, bonus, loss, win, refund).",
    },
    "SESSION": {
        "fields": [
            "id",
            "user_id",
            "token",
            "ip",
            "user_agent",
            "expires_at",
            "created_at",
        ],
        "relationships": [
            "belongs_to -> USER",
        ],
        "table_name": "sessions",
        "description": "Active player login session with token and expiry.",
    },
    "BONUS": {
        "fields": [
            "id",
            "user_id",
            "type",
            "name",
            "amount",
            "currency",
            "wager_required",
            "wager_met",
            "min_game_id",
            "max_game_id",
            "status",
            "expires_at",
            "created_at",
            "claimed_at",
        ],
        "relationships": [
            "belongs_to -> USER",
            "has_many -> WAGER",
        ],
        "table_name": "bonuses",
        "description": "Promotional offer with wagering requirements and game-range constraints.",
    },
    "WAGER": {
        "fields": [
            "id",
            "bonus_id",
            "user_id",
            "game_id",
            "round_id",
            "amount",
            "wagered_amount",
            "status",
            "created_at",
            "completed_at",
        ],
        "relationships": [
            "belongs_to -> BONUS",
            "belongs_to -> USER",
            "belongs_to -> GAME",
        ],
        "table_name": "wagers",
        "description": "Individual bet contributing to a bonus wagering requirement.",
    },
    "GAME": {
        "fields": [
            "id",
            "name",
            "type",
            "provider_id",
            "rtp",
            "volatility",
            "min_bet",
            "max_bet",
            "status",
            "metadata",
            "created_at",
        ],
        "relationships": [
            "belongs_to -> GAME_PROVIDER",
            "has_many -> ROUND",
        ],
        "table_name": "games",
        "description": "Casino game catalog entry with provider, RTP, and betting limits.",
    },
    "GAME_PROVIDER": {
        "fields": [
            "id",
            "name",
            "api_endpoint",
            "api_key_hash",
            "status",
            "config",
            "created_at",
            "updated_at",
        ],
        "relationships": [
            "has_many -> GAME",
        ],
        "table_name": "game_providers",
        "description": "External game provider configuration and connection details.",
    },
    "ROUND": {
        "fields": [
            "id",
            "game_id",
            "user_id",
            "round_number",
            "stake",
            "win_amount",
            "multiplier",
            "status",
            "game_data",
            "created_at",
            "completed_at",
        ],
        "relationships": [
            "belongs_to -> GAME",
            "belongs_to -> USER",
        ],
        "table_name": "rounds",
        "description": "Single game round capturing stake, result, and game payload.",
    },
    "GAME_CONFIG": {
        "fields": [
            "id",
            "game_id",
            "field",
            "value",
            "updated_by",
            "updated_at",
        ],
        "relationships": [
            "belongs_to -> GAME",
        ],
        "table_name": "game_config",
        "description": "Key-value game configuration overrides tracked per field.",
    },
    "AUDIT_LOG": {
        "fields": [
            "id",
            "actor_id",
            "actor_type",
            "action",
            "entity_type",
            "entity_id",
            "old_values",
            "new_values",
            "ip",
            "metadata",
            "created_at",
        ],
        "relationships": [],
        "table_name": "audit_log",
        "description": "Immutable audit trail for all player-facing and administrative actions.",
    },
    "RISK_SCORE": {
        "fields": [
            "id",
            "user_id",
            "score",
            "category",
            "flags",
            "evaluated_by",
            "evaluated_at",
            "updated_at",
        ],
        "relationships": [
            "belongs_to -> USER",
        ],
        "table_name": "risk_scores",
        "description": "AML / fraud risk score per player with category and flags.",
    },
    "KYC_DOCUMENT": {
        "fields": [
            "id",
            "user_id",
            "document_type",
            "file_url",
            "status",
            "verified_by",
            "verified_at",
            "rejected_reason",
            "created_at",
        ],
        "relationships": [
            "belongs_to -> USER",
        ],
        "table_name": "kyc_documents",
        "description": "KYC document submission with verification state machine.",
    },
}


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def get_entity(entity_name: str) -> dict:
    """Return the full entity definition dict by name.

    Args:
        entity_name: Case-sensitive entity key (e.g. 'USER', 'GAME').

    Returns:
        The entity dict with 'fields', 'relationships', 'table_name',
        and 'description'.

    Raises:
        KeyError: If the entity name is not found.
    """
    return ENTITIES[entity_name]


def list_entities() -> list:
    """Return a sorted list of all entity name strings.

    Returns:
        List of entity names in uppercase alphabetical order.
    """
    return sorted(ENTITIES.keys())


def get_entity_relationships(entity_name: str) -> list:
    """Return the relationships list for a given entity.

    Args:
        entity_name: Entity key.

    Returns:
        List of relationship strings.

    Raises:
        KeyError: If the entity name is not found.
    """
    return ENTITIES[entity_name]["relationships"]


def get_tables_mapping() -> dict:
    """Return a mapping of entity names to their table names.

    Returns:
        Dict mapping entity name (str) to table name (str).
    """
    return {name: info["table_name"] for name, info in ENTITIES.items()}


def extract_entities_from_code(repo_root: str = None) -> dict:
    """Scan Python files for class definitions that match casino entities.

    Walks the repository looking for Python .py files, parses their AST,
    and looks for classes whose names appear in ENTITIES. Also detects
    class attributes that look like database fields.

    Args:
        repo_root: Repository root directory. Defaults to project root.

    Returns:
        Dict mapping discovered entity names to metadata dicts containing
        source file path and detected field counts.
    """
    if repo_root is None:
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    discovered = {}
    excluded_dirs = {
        ".git", ".venv", "__pycache__", "node_modules", ".tox",
        ".mypy_cache", ".pytest_cache", ".ruff_cache",
        "quarantine", "work", "snapshots", "logs", "approvals",
        "plans", "tmp", "build", "dist", ".eggs", "egg-info",
    }

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = sorted([d for d in dirs if d not in excluded_dirs])
        for filename in sorted(files):
            if not filename.endswith(".py"):
                continue
            abs_path = os.path.join(root, filename)
            rel_path = os.path.relpath(abs_path, repo_root)

            try:
                with open(abs_path, "r", errors="ignore") as f:
                    source = f.read()
            except Exception:
                continue

            try:
                tree = ast.parse(source, filename=abs_path)
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    class_name = node.name
                    if class_name in ENTITIES:
                        field_count = 0
                        for item in node.body:
                            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                                if item.name.startswith("_"):
                                    continue
                                for arg in item.args.args:
                                    if arg.arg not in ("self", "cls"):
                                        field_count += 1

                        if field_count > 0 or len(node.body) > 0:
                            discovered[class_name] = {
                                "source_file": rel_path,
                                "field_count": field_count,
                                "line": node.lineno,
                            }

    return discovered


def store_entities_in_db(db_path: str = None) -> int:
    """Store all entity definitions into a casino_entities SQLite table.

    Creates the table if it does not exist, then inserts or replaces each
    entity definition.

    Args:
        db_path: Path to the SQLite database. Defaults to plans.db in agent/.

    Returns:
        Number of entity rows inserted.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS casino_entities (
                entity_name TEXT PRIMARY KEY,
                fields TEXT NOT NULL,
                relationships TEXT,
                table_name TEXT,
                description TEXT,
                discovered_from TEXT,
                indexed_at TEXT NOT NULL
            )
        """)

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        inserted = 0

        for name, info in ENTITIES.items():
            discovered = extract_entities_from_code(_PARENT)
            source = ""
            if name in discovered:
                source = discovered[name]["source_file"]

            conn.execute(
                """INSERT OR REPLACE INTO casino_entities (
                    entity_name, fields, relationships, table_name,
                    description, discovered_from, indexed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    name,
                    json.dumps(info["fields"]),
                    json.dumps(info["relationships"]),
                    info["table_name"],
                    info["description"],
                    source,
                    now,
                ),
            )
            inserted += 1

        conn.commit()
        return inserted

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_entity_definitions(db_path: str = None) -> list:
    """Read entity definitions from the casino_entities database table.

    Args:
        db_path: Path to the SQLite database. Defaults to plans.db in agent/.

    Returns:
        List of dicts, one per entity, with keys matching the table columns
        and JSON arrays for fields and relationships.
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "plans.db"
        )

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT entity_name, fields, relationships, table_name, "
            "description, discovered_from, indexed_at "
            "FROM casino_entities ORDER BY entity_name"
        ).fetchall()

        return [
            {
                "entity_name": row["entity_name"],
                "fields": json.loads(row["fields"]),
                "relationships": json.loads(row["relationships"])
                if row["relationships"]
                else [],
                "table_name": row["table_name"],
                "description": row["description"],
                "discovered_from": row["discovered_from"],
                "indexed_at": row["indexed_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def print_entity_summary(db_path: str = None):
    """Print a human-readable summary of all entity definitions.

    Prints the entity count, then for each entity its name, table mapping,
    field count, and relationships. Also shows code discovery results.

    Args:
        db_path: Path to the SQLite database. Defaults to plans.db in agent/.
    """
    definitions = get_entity_definitions(db_path)
    discovered = extract_entities_from_code(_PARENT)

    print("\n" + "=" * 64)
    print("  CASINO ENTITIES SUMMARY")
    print("=" * 64)
    print(f"\n  Total entities: {len(definitions)}\n")

    for defn in definitions:
        name = defn["entity_name"]
        table = defn["table_name"]
        field_count = len(defn["fields"])
        rels = defn["relationships"]
        rel_count = len(rels)
        found_str = ""
        if name in discovered:
            found_str = f" [found in {discovered[name]['source_file']}:{discovered[name]['line']}]"

        print(f"  {name}{found_str}")
        print(f"    Table:    {table}")
        print(f"    Fields:   {field_count}")
        print(f"    Relations: {rel_count}")
        for rel in rels:
            print(f"      - {rel}")
        print()

    print("=" * 64 + "\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    """Run the module as a standalone script."""
    import sys

    command = sys.argv[1] if len(sys.argv) > 1 else "summary"

    if command == "store":
        count = store_entities_in_db()
        print(f"Stored {count} entity definitions in database.")

    elif command == "list":
        names = list_entities()
        print("Entities:")
        for name in names:
            entity = get_entity(name)
            print(f"  {name} -> {entity['table_name']} ({len(entity['fields'])} fields)")

    elif command == "extract":
        discovered = extract_entities_from_code()
        if discovered:
            print("Discovered entities in codebase:")
            for name, meta in sorted(discovered.items()):
                print(f"  {name}: {meta['source_file']}:{meta['line']} ({meta['field_count']} fields)")
        else:
            print("No entities found in source code. (Expected for bootstrap stage.)")

    elif command == "tables":
        mapping = get_tables_mapping()
        print("Entity-to-table mapping:")
        for name, table in sorted(mapping.items()):
            print(f"  {name} -> {table}")

    else:
        print_entity_summary()


if __name__ == "__main__":
    main()
