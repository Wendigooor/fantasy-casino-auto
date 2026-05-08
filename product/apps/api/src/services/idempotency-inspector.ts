// idempotency-inspector.ts — inspect idempotency key replay safety

export interface IdempotencyInspection {
  key: string;
  status: "safe_replay" | "duplicate_applied" | "key_not_found" | "ambiguous" | "error";
  userId?: string;
  action?: string;
  records: number;
  ledgerEntries: number;
  balanceDelta: number;
  warnings: string[];
  checkedAt: string;
}

export async function inspectKey(pg: any, key: string): Promise<IdempotencyInspection> {
  const warnings: string[] = [];
  const keyR = await pg.query("SELECT * FROM idempotency_keys WHERE key = $1 ORDER BY created_at", [key]);
  if (keyR.rows.length === 0) {
    return { key, status: "key_not_found", records: 0, ledgerEntries: 0, balanceDelta: 0, warnings: [], checkedAt: new Date().toISOString() };
  }

  const record = keyR.rows[0];
  const userId = record.user_id;
  const action = record.action;
  const records = keyR.rows.length;

  // Find ledger entries associated with this key
  const ledgerR = await pg.query(
    "SELECT * FROM ledger_entries WHERE user_id = $1 AND reference_id = $2 ORDER BY created_at",
    [userId, key]
  );
  const ledgerEntries = ledgerR.rows.length;
  const balanceDelta = ledgerEntries > 0 ? Number(ledgerR.rows[0].amount) * (["deposit", "win_credit", "bonus_credit", "mission_reward"].includes(ledgerR.rows[0].type) ? 1 : -1) : 0;

  // Check for duplicates: multiple ledger entries for the same key
  if (ledgerEntries > 1) {
    warnings.push(`Multiple ledger entries (${ledgerEntries}) for same idempotency key`);
  }

  // Check wallet balance
  const walletR = await pg.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);
  const balance = walletR.rows.length > 0 ? Number(walletR.rows[0].balance) : 0;

  // Detect if replay caused duplicate balance change (balance > expected)
  // This is a simplified check; full reconciliation would need the full ledger
  let status: IdempotencyInspection["status"] = "safe_replay";
  if (ledgerEntries > 1) {
    status = "duplicate_applied";
    warnings.push("Duplicate ledger entries detected — possible double application");
  }
  if (warnings.length === 0 && records > 1) {
    warnings.push(`${records} idempotency records for this key`);
  }

  return {
    key,
    status,
    userId,
    action,
    records,
    ledgerEntries,
    balanceDelta,
    warnings,
    checkedAt: new Date().toISOString(),
  };
}
