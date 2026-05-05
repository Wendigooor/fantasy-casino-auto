import { Pool } from "pg";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

export async function createTestUser(
  pool: Pool,
  overrides: { id?: string; email?: string; role?: string } = {}
) {
  const id = overrides.id || randomUUID();
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const role = overrides.role || "player";
  const hash = await bcrypt.hash("TestPass123!", 12);

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (id) DO UPDATE SET email = $2`,
    [id, email, hash, role]
  );

  return { id, email, role };
}

export async function createTestWallet(
  pool: Pool,
  userId: string,
  overrides: { currency?: string; balance?: number; state?: string } = {}
) {
  const currency = overrides.currency || "USD";
  const balance = overrides.balance ?? 100000;
  const state = overrides.state || "active";

  const result = await pool.query(
    `INSERT INTO wallets (user_id, currency, balance, state)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, currency, balance, state]
  );

  return result.rows[0];
}

export async function createTestDeposit(
  pool: Pool,
  userId: string,
  amount: number = 10000
) {
  const walletResult = await pool.query(
    "SELECT id FROM wallets WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  let walletId = walletResult.rows[0]?.id;
  if (!walletId) {
    const w = await createTestWallet(pool, userId);
    walletId = w.id;
  }

  const idempotencyKey = randomUUID();
  const newBalance = amount;

  await pool.query(
    `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after)
     VALUES ($1, $2, 'deposit', $3, 'USD', $4)`,
    [walletId, userId, amount, newBalance]
  );

  await pool.query(
    "UPDATE wallets SET balance = balance + $1 WHERE id = $2",
    [amount, walletId]
  );

  return { walletId, idempotencyKey, balance: newBalance };
}

export async function cleanupTestData(pool: Pool, userId: string) {
  for (const query of [
    ["DELETE FROM casino_events WHERE player_id = $1", [userId]],
    ["DELETE FROM game_rounds WHERE user_id = $1", [userId]],
    ["DELETE FROM ledger_entries WHERE user_id = $1", [userId]],
    ["DELETE FROM idempotency_keys WHERE user_id = $1", [userId]],
    ["DELETE FROM bonus_wagering WHERE player_id = $1", [userId]],
    ["DELETE FROM risk_scores WHERE player_id = $1", [userId]],
    ["DELETE FROM kyc_verifications WHERE user_id = $1", [userId]],
    ["DELETE FROM wallets WHERE user_id = $1", [userId]],
    ["DELETE FROM users WHERE id = $1", [userId]],
  ]) {
    try {
      await pool.query(query[0] as string, query[1] as unknown[]);
    } catch {
      // Table may not exist — skip
    }
  }
}
