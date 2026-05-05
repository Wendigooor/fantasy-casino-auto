import { Pool } from "pg";
import { WalletService } from "./wallet.js";
import { RNG } from "./rng.js";
import { BonusRuleEngine } from "./bonus.js";
import { ProviderRegistry, InternalSlotProvider } from "./provider.js";

export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
    this.name = "GameNotFoundError";
  }
}

export class RoundFailedError extends Error {
  constructor(roundId: string, reason: string) {
    super(`Round ${roundId} failed: ${reason}`);
    this.name = "RoundFailedError";
  }
}

export interface SpinResult {
  roundId: string;
  gameId: string;
  betAmount: number;
  winAmount: number;
  reels: number[];
  currency: string;
  state: string;
}

export class GameService {
  constructor(
    private pool: Pool,
    _walletService: WalletService,
    private registry: ProviderRegistry,
    private bonusEngine?: BonusRuleEngine
  ) {}

  setRNG(rng: RNG) {
    const provider = this.registry.get("internal") as InternalSlotProvider;
    if (provider) {
      provider.setRngFunction(() => rng.nextFloat());
    }
  }

  async listGames(): Promise<Array<{ id: string; name: string; type: string; minBet: number; maxBet: number; provider: string }>> {
    const result = await this.pool.query(
      `SELECT id, name, type, min_bet, max_bet, provider 
       FROM games WHERE is_active = true`
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      minBet: row.min_bet as number,
      maxBet: row.max_bet as number,
      provider: row.provider as string,
    }));
  }

  async getRoundHistory(userId: string, limit: number = 20, offset: number = 0) {
    const result = await this.pool.query(
      `SELECT id, game_id, bet_amount, win_amount, state, currency, result, created_at, settled_at
       FROM game_rounds 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      gameId: row.game_id as string,
      betAmount: row.bet_amount as number,
      winAmount: row.win_amount as number,
      state: row.state as string,
      currency: row.currency as string,
      result: row.result as Record<string, unknown> | null,
      createdAt: row.created_at as string,
      settledAt: row.settled_at as string | null,
    }));
  }

  async spin(
    userId: string,
    walletId: string,
    gameId: string,
    betAmount: number,
    idempotencyKey: string
  ): Promise<SpinResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Check idempotency
      const existing = await client.query(
        "SELECT result FROM idempotency_keys WHERE key = $1",
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        return existing.rows[0].result as SpinResult;
      }

      // Check wallet balance
      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      const wallet = walletResult.rows[0] as { balance: number; currency: string };
      if (!wallet) {
        throw new Error("Wallet not found");
      }
      if (wallet.balance < betAmount) {
        throw new Error(`Insufficient funds: balance=${wallet.balance}, required=${betAmount}`);
      }

      // Generate reels via provider
      const provider = this.registry.get("internal");
      if (!provider) throw new Error("No internal provider registered");
      const providerResult = await provider.spin(userId, walletId, gameId, betAmount, wallet.currency);
      const reels = providerResult.reels ?? [];
      const winAmount = providerResult.winAmount;

      // Create round
      const roundResult = await client.query(
        `INSERT INTO game_rounds (user_id, game_id, bet_amount, win_amount, state, currency, result) 
         VALUES ($1, $2, $3, $4, 'created', $5, $6) RETURNING *`,
        [userId, gameId, betAmount, 0, wallet.currency, JSON.stringify({ reels })]
      );
      const round = roundResult.rows[0];
      const roundId = round.id as string;

      // Debit bet
      await client.query(
        `UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [betAmount, walletId]
      );
      await client.query(
        `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, reference_id)
         VALUES ($1, $2, 'bet_debit', $3, $4, (SELECT balance FROM wallets WHERE id = $1), $5)`,
        [walletId, userId, betAmount, wallet.currency, roundId]
      );

      // Credit win if won
      let finalBalance = wallet.balance - betAmount;
      if (winAmount > 0) {
        await client.query(
          `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
          [winAmount, walletId]
        );
        await client.query(
          `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, reference_id)
           VALUES ($1, $2, 'win_credit', $3, $4, (SELECT balance FROM wallets WHERE id = $1), $5)`,
          [walletId, userId, winAmount, wallet.currency, roundId]
        );
        finalBalance = finalBalance + winAmount;
      }

      // Update round state
      await client.query(
        `UPDATE game_rounds SET state = 'settled', win_amount = $1, settled_at = NOW() 
         WHERE id = $2`,
        [winAmount, roundId]
      );

      // Store idempotency key
      const result: SpinResult = {
        roundId,
        gameId,
        betAmount,
        winAmount,
        reels,
        currency: wallet.currency,
        state: "settled",
      };
      await client.query(
        "INSERT INTO idempotency_keys (key, user_id, action, result) VALUES ($1, $2, 'spin', $3)",
        [idempotencyKey, userId, JSON.stringify(result)]
      );

      await client.query("COMMIT");

      // Track bonus wagering after commit (non-blocking)
      if (this.bonusEngine) {
        this.bonusEngine.recordWager(userId, gameId, betAmount).catch(() => {});
      }

      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

}
