import { Pool } from "pg";

export class InvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Invalid amount: ${amount}. Amount must be positive.`);
    this.name = "InvalidAmountError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(userId: string) {
    super(`Wallet not found for user ${userId}`);
    this.name = "WalletNotFoundError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(balance: number, amount: number) {
    super(`Insufficient funds: balance=${balance}, required=${amount}`);
    this.name = "InsufficientFundsError";
  }
}

export class WalletFrozenError extends Error {
  constructor(walletId: string, state: string) {
    super(`Wallet ${walletId} is in state: ${state}`);
    this.name = "WalletFrozenError";
  }
}

export class WalletClosedError extends Error {
  constructor(walletId: string) {
    super(`Wallet ${walletId} is closed`);
    this.name = "WalletClosedError";
  }
}

export interface WalletRow {
  id: string;
  user_id: string;
  currency: string;
  balance: number;
  state: string;
  created_at: Date;
  updated_at: Date;
}

export interface LedgerEntryRow {
  id: string;
  wallet_id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  balance_after: number;
  reference_id?: string;
  description?: string;
  created_at: Date;
}

export class WalletService {
  constructor(private pool: Pool) {}

  async getOrCreateWallet(userId: string, currency: string = "USD"): Promise<WalletRow> {
    const result = await this.pool.query(
      "SELECT * FROM wallets WHERE user_id = $1 AND currency = $2",
      [userId, currency]
    );
    if (result.rows.length > 0) {
      return result.rows[0] as WalletRow;
    }
    const insertResult = await this.pool.query(
      `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, 0) RETURNING *`,
      [userId, currency]
    );
    return insertResult.rows[0] as WalletRow;
  }

  async getBalance(userId: string, currency: string = "USD"): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId, currency);
    return Number(wallet.balance);
  }

  async getLedger(userId: string, limit: number = 50, offset: number = 0): Promise<LedgerEntryRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM ledger_entries 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows as LedgerEntryRow[];
  }

  async deposit(
    userId: string,
    currency: string,
    amount: number,
    idempotencyKey: string,
    description?: string
  ): Promise<{ walletId: string; balance: number; entryId: string }> {
    if (amount <= 0) throw new InvalidAmountError(amount);
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
        return existing.rows[0].result as { walletId: string; balance: number; entryId: string };
      }

      // Get or create wallet
      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE",
        [userId, currency]
      );
      let wallet = walletResult.rows[0] as WalletRow | undefined;
      if (!wallet) {
        const insertResult = await client.query(
          `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, 0) RETURNING *`,
          [userId, currency]
        );
        wallet = insertResult.rows[0] as WalletRow;
      }

      // Check wallet state
      if (wallet.state === "closed") {
        throw new WalletClosedError(wallet.id);
      }
      if (wallet.state === "frozen") {
        throw new WalletFrozenError(wallet.id, "frozen");
      }

      // Create ledger entry
      const newBalance = Number(wallet.balance) + amount;
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description) 
         VALUES ($1, $2, 'deposit', $3, $4, $5, $6) RETURNING *`,
        [wallet.id, userId, amount, currency, newBalance, description || "Deposit"]
      );
      const entry = entryResult.rows[0] as LedgerEntryRow;

      // Update wallet balance
      await client.query(
        "UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2",
        [newBalance, wallet.id]
      );

      // Store idempotency key
      const result = { walletId: wallet.id, balance: newBalance, entryId: entry.id };
      await client.query(
        "INSERT INTO idempotency_keys (key, user_id, action, result) VALUES ($1, $2, 'deposit', $3)",
        [idempotencyKey, userId, JSON.stringify(result)]
      );

      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async reserveBet(
    userId: string,
    walletId: string,
    betAmount: number,
    idempotencyKey: string
  ): Promise<{ balance: number; entryId: string }> {
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
        return existing.rows[0].result as { balance: number; entryId: string };
      }

      // Lock wallet row
      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      const wallet = walletResult.rows[0] as WalletRow;
      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }
      if (Number(wallet.balance) < betAmount) {
        throw new InsufficientFundsError(Number(wallet.balance), betAmount);
      }

      // Create debit entry
      const newBalance = wallet.balance - betAmount;
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after) 
         VALUES ($1, $2, 'bet_debit', $3, $4, $5) RETURNING *`,
        [walletId, userId, betAmount, wallet.currency, newBalance]
      );
      const entry = entryResult.rows[0] as LedgerEntryRow;

      // Update wallet balance
      await client.query(
        "UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2",
        [newBalance, walletId]
      );

      // Store idempotency key
      const result = { balance: newBalance, entryId: entry.id };
      await client.query(
        "INSERT INTO idempotency_keys (key, user_id, action, result) VALUES ($1, $2, 'bet_reserve', $3)",
        [idempotencyKey, userId, JSON.stringify(result)]
      );

      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async creditWin(
    walletId: string,
    userId: string,
    winAmount: number,
    referenceId?: string,
    idempotencyKey?: string
  ): Promise<{ balance: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Check idempotency
      if (idempotencyKey) {
        const existing = await client.query(
          "SELECT result FROM idempotency_keys WHERE key = $1",
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          await client.query("COMMIT");
          return existing.rows[0].result as { balance: number };
        }
      }

      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      const wallet = walletResult.rows[0] as WalletRow;
      const newBalance = Number(wallet.balance) + winAmount;

      await client.query(
        `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, reference_id) 
         VALUES ($1, $2, 'win_credit', $3, $4, $5, $6)`,
        [walletId, userId, winAmount, wallet.currency, newBalance, referenceId]
      );

      await client.query(
        "UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2",
        [newBalance, walletId]
      );

      const result = { balance: newBalance };
      if (idempotencyKey) {
        await client.query(
          "INSERT INTO idempotency_keys (key, user_id, action, result) VALUES ($1, $2, 'win_credit', $3)",
          [idempotencyKey, userId, JSON.stringify(result)]
        );
      }

      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async withdrawal(
    userId: string,
    walletId: string,
    amount: number,
    idempotencyKey: string,
    destination: string,
    currency: string = "USD"
  ): Promise<{ walletId: string; balance: number; entryId: string }> {
    if (amount <= 0) throw new InvalidAmountError(amount);
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
        return existing.rows[0].result as { walletId: string; balance: number; entryId: string };
      }

      // Lock wallet row
      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE id = $1 FOR UPDATE",
        [walletId]
      );
      const wallet = walletResult.rows[0] as WalletRow;

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      // Check wallet state
      if (wallet.state === "closed") {
        throw new WalletClosedError(walletId);
      }
      if (wallet.state === "frozen") {
        throw new WalletFrozenError(walletId, "frozen");
      }

      // Check sufficient balance
      if (Number(wallet.balance) < amount) {
        throw new InsufficientFundsError(Number(wallet.balance), amount);
      }

      // Create ledger entry
      const newBalance = wallet.balance - amount;
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, reference_id, description) 
         VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6, $7) RETURNING *`,
        [walletId, userId, amount, currency, newBalance, destination, `Withdrawal to ${destination}`]
      );
      const entry = entryResult.rows[0] as LedgerEntryRow;

      // Update wallet balance
      await client.query(
        "UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2",
        [newBalance, walletId]
      );

      // Store idempotency key
      const result = { walletId: wallet.id, balance: newBalance, entryId: entry.id };
      await client.query(
        "INSERT INTO idempotency_keys (key, user_id, action, result) VALUES ($1, $2, 'withdrawal', $3)",
        [idempotencyKey, userId, JSON.stringify(result)]
      );

      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async freezeWallet(userId: string): Promise<{ walletId: string; state: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const wallet = walletResult.rows[0] as WalletRow;

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      if (wallet.state === "closed") {
        throw new WalletClosedError(wallet.id);
      }

      await client.query(
        "UPDATE wallets SET state = 'frozen', updated_at = NOW() WHERE id = $1",
        [wallet.id]
      );

      await client.query("COMMIT");
      return { walletId: wallet.id, state: "frozen" };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async unfreezeWallet(userId: string): Promise<{ walletId: string; state: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const wallet = walletResult.rows[0] as WalletRow;

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      if (wallet.state === "closed") {
        throw new WalletClosedError(wallet.id);
      }

      await client.query(
        "UPDATE wallets SET state = 'active', updated_at = NOW() WHERE id = $1",
        [wallet.id]
      );

      await client.query("COMMIT");
      return { walletId: wallet.id, state: "active" };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async closeWallet(userId: string): Promise<{ walletId: string; state: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const walletResult = await client.query(
        "SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      const wallet = walletResult.rows[0] as WalletRow;

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      if (Number(wallet.balance) !== 0) {
        throw new Error(`Cannot close wallet with non-zero balance: ${wallet.balance}`);
      }

      await client.query(
        "UPDATE wallets SET state = 'closed', updated_at = NOW() WHERE id = $1",
        [wallet.id]
      );

      await client.query("COMMIT");
      return { walletId: wallet.id, state: "closed" };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
