// reconciliation.ts — Wallet/ledger reconciliation service

const SIGN_MAP: Record<string, number> = {
  deposit: 1,
  reversal: 1,
  win_credit: 1,
  bonus_credit: 1,
  mission_reward: 1,
  bet_reserve: -1,
  bet_debit: -1,
  withdrawal: -1,
  wager_contribution: 0,
};

export function signedAmount(entry: { type: string; amount: number | string }): number {
  const sign = SIGN_MAP[entry.type] ?? 0;
  return Number(entry.amount) * sign;
}

export function computeExpectedBalance(entries: { type: string; amount: number | string }[]): number {
  return entries.reduce((sum, e) => sum + signedAmount(e), 0);
}

export async function reconcileWallet(pg: any, userId: string): Promise<any> {
  const issues: any[] = [];
  const warnings: any[] = [];

  const userR = await pg.query("SELECT id, email FROM users WHERE id = $1", [userId]);
  if (userR.rows.length === 0) return { status: "error", message: "User not found" };

  const walletR = await pg.query("SELECT * FROM wallets WHERE user_id = $1", [userId]);
  if (walletR.rows.length === 0) return { status: "error", message: "Wallet not found" };
  const wallet = walletR.rows[0];
  const actualBalance = Number(wallet.balance);

  const entriesR = await pg.query(
    "SELECT * FROM ledger_entries WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  const entries = entriesR.rows;
  const expectedBalance = computeExpectedBalance(entries);
  const drift = actualBalance - expectedBalance;

  if (drift !== 0) {
    issues.push({
      type: "balance_drift",
      severity: "critical",
      entity: "wallet",
      entityId: wallet.id,
      message: `Drift: actual=${actualBalance}, expected=${expectedBalance}, drift=${drift}`,
      drift,
    });
  }

  if (actualBalance < 0) {
    issues.push({
      type: "negative_balance",
      severity: "critical",
      entity: "wallet",
      entityId: wallet.id,
      message: `Negative balance: ${actualBalance}`,
    });
  }

  const roundsR = await pg.query(
    "SELECT * FROM game_rounds WHERE user_id = $1 ORDER BY created_at", [userId]
  );
  const rounds = roundsR.rows;

  for (const r of rounds) {
    if (Number(r.bet_amount) > 0 && !r.ledger_debit_id) {
      issues.push({
        type: "missing_bet_debit", severity: "critical",
        entity: "game_round", entityId: r.id,
        message: `Bet ${r.bet_amount} but no ledger debit ref`,
      });
    }
    if (Number(r.win_amount) > 0 && !r.ledger_credit_id) {
      issues.push({
        type: "missing_win_credit", severity: "critical",
        entity: "game_round", entityId: r.id,
        message: `Win ${r.win_amount} but no ledger credit ref`,
      });
    }
  }

  for (const e of entries) {
    if (!SIGN_MAP[e.type] && e.type !== "wager_contribution") {
      warnings.push({
        type: "unsupported_ledger_type", severity: "minor",
        entity: "ledger_entry", entityId: e.id,
        message: `Unsupported type: ${e.type}`,
      });
    }
  }

  const status = drift !== 0 ? "drift_detected" : issues.length > 0 ? "invalid_ledger" : "balanced";

  return {
    userId, status, actualBalance, expectedBalance, drift,
    currency: wallet.currency,
    checkedAt: new Date().toISOString(),
    summary: {
      ledgerEntries: entries.length,
      gameRounds: rounds.length,
      issues: issues.length,
      warnings: warnings.length,
    },
    issues, warnings,
  };
}
