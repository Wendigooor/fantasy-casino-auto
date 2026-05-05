import { Pool } from "pg";

export class DuelService {
  constructor(private pool: Pool) {}

  async create(creatorId: string, gameId: string, betAmount: number) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Lock wallet
      const w = await client.query("SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", [creatorId]);
      const wallet = w.rows[0];
      if (!wallet) throw new Error("Wallet not found");
      if (wallet.state !== "active") throw new Error(`Wallet is ${wallet.state}`);
      if (Number(wallet.balance) < betAmount) throw new Error("Insufficient funds");

      // Reserve funds
      await client.query("UPDATE wallets SET balance = balance - $1 WHERE id = $2", [betAmount, wallet.id]);
      await client.query(
        "INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description) VALUES ($1,$2,'bet_reserve',$3,$4,$5,$6)",
        [wallet.id, creatorId, betAmount, wallet.currency, Number(wallet.balance) - betAmount, "PvP duel reserve"]
      );

      const pot = betAmount * 2;
      const houseFee = Math.floor(pot * 0.05);

      const result = await client.query(
        `INSERT INTO duels (creator_id, game_id, bet_amount, status, pot, house_fee, expires_at)
         VALUES ($1,$2,$3,'open',$4,$5, NOW() + INTERVAL '5 minutes') RETURNING *`,
        [creatorId, gameId, betAmount, pot, houseFee]
      );
      const duel = result.rows[0];

      await client.query(
        "INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'created',$3)",
        [duel.id, creatorId, JSON.stringify({ betAmount, gameId, pot, houseFee })]
      );

      await client.query("COMMIT");
      return this._map(duel);
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally { client.release(); }
  }

  async accept(duelId: string, acceptorId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const d = await client.query("SELECT * FROM duels WHERE id = $1 FOR UPDATE", [duelId]);
      if (d.rows.length === 0) throw new Error("Duel not found");
      const duel = d.rows[0];
      if (duel.status !== "open") throw new Error(`Duel is ${duel.status}`);
      if (duel.creator_id === acceptorId) throw new Error("Cannot accept own duel");
      if (new Date(duel.expires_at) < new Date()) throw new Error("Duel expired");

      // Lock acceptor wallet
      const w = await client.query("SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE", [acceptorId]);
      const wallet = w.rows[0];
      if (!wallet) throw new Error("Wallet not found");
      if (wallet.state !== "active") throw new Error(`Wallet is ${wallet.state}`);
      if (Number(wallet.balance) < Number(duel.bet_amount)) throw new Error("Insufficient funds");

      // Reserve funds
      await client.query("UPDATE wallets SET balance = balance - $1 WHERE id = $2", [duel.bet_amount, wallet.id]);
      await client.query(
        "INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description) VALUES ($1,$2,'bet_reserve',$3,$4,$5,$6)",
        [wallet.id, acceptorId, duel.bet_amount, wallet.currency, Number(wallet.balance) - Number(duel.bet_amount), "PvP duel accept"]
      );

      await client.query(
        "UPDATE duels SET acceptor_id = $1, status = 'active', accepted_at = NOW() WHERE id = $2",
        [acceptorId, duelId]
      );

      await client.query(
        "INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'accepted',$3)",
        [duelId, acceptorId, "{}"]
      );

      await client.query("COMMIT");
      return { duelId, status: "active", acceptorId };
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally { client.release(); }
  }

  async spin(duelId: string, userId: string, spinResult: { reels: number[]; winAmount: number }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const d = await client.query("SELECT * FROM duels WHERE id = $1 FOR UPDATE", [duelId]);
      if (d.rows.length === 0) throw new Error("Duel not found");
      const duel = d.rows[0];
      if (duel.status !== "active") throw new Error(`Duel is ${duel.status}`);
      if (duel.creator_id !== userId && duel.acceptor_id !== userId) throw new Error("Not in this duel");

      const isCreator = duel.creator_id === userId;
      const betAmount = Number(duel.bet_amount);
      const multiplier = betAmount > 0 ? spinResult.winAmount / betAmount : 0;

      const spinData = JSON.stringify({ reels: spinResult.reels, winAmount: spinResult.winAmount, multiplier });

      if (isCreator) {
        await client.query("UPDATE duels SET creator_spin = $1, creator_multiplier = $2 WHERE id = $3", [spinData, multiplier, duelId]);
        await client.query("INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'spun',$3)", [duelId, userId, spinData]);
      } else {
        await client.query("UPDATE duels SET acceptor_spin = $1, acceptor_multiplier = $2 WHERE id = $3", [spinData, multiplier, duelId]);
        await client.query("INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'spun',$3)", [duelId, userId, spinData]);
      }

      // Check if both spun
      const updated = await client.query("SELECT * FROM duels WHERE id = $1", [duelId]);
      const u = updated.rows[0];

      if (u.creator_spin && u.acceptor_spin) {
        await this._settle(client, u);
      }

      // Re-query to get settled state
      const final = await client.query("SELECT * FROM duels WHERE id = $1", [duelId]);

      await client.query("COMMIT");
      return this._map(final.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally { client.release(); }
  }

  private async _settle(client: any, duel: any) {
    const cMult = Number(duel.creator_multiplier);
    const aMult = Number(duel.acceptor_multiplier);
    const bet = Number(duel.bet_amount);
    const houseFee = Number(duel.house_fee);
    const pot = Number(duel.pot);
    let winnerId: string | null = null;

    if (cMult > aMult) winnerId = duel.creator_id;
    else if (aMult > cMult) winnerId = duel.acceptor_id;

    if (winnerId) {
      const payout = pot - houseFee;
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", [payout, winnerId]);
      await client.query(
        "INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description) SELECT id, $1, 'win_credit', $2, currency, balance FROM wallets WHERE user_id = $1",
        [winnerId, payout]
      );
    } else {
      // Tie — refund both
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", [bet, duel.creator_id]);
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", [bet, duel.acceptor_id]);
    }

    await client.query(
      "UPDATE duels SET status = 'settled', winner_id = $1, settled_at = NOW() WHERE id = $2",
      [winnerId, duel.id]
    );

    await client.query(
      "INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1, $2, 'settled', $3)",
      [duel.id, winnerId || duel.creator_id, JSON.stringify({ winnerId, houseFee, cMult, aMult })]
    );
  }

  async cancel(duelId: string, userId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const d = await client.query("SELECT * FROM duels WHERE id = $1 FOR UPDATE", [duelId]);
      if (d.rows.length === 0) throw new Error("Duel not found");
      const duel = d.rows[0];
      if (duel.creator_id !== userId) throw new Error("Only creator can cancel");
      if (duel.status !== "open") throw new Error(`Duel is ${duel.status}`);

      // Refund creator
      const bet = Number(duel.bet_amount);
      await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", [bet, duel.creator_id]);

      await client.query("UPDATE duels SET status = 'cancelled' WHERE id = $1", [duelId]);
      await client.query("INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'cancelled',$3)", [duelId, userId, "{}"]);
      await client.query("COMMIT");
      return { duelId, status: "cancelled" };
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally { client.release(); }
  }

  async getOpen() {
    const r = await this.pool.query(
      `SELECT d.*, u.email as creator_email FROM duels d JOIN users u ON u.id = d.creator_id WHERE d.status = 'open' AND d.expires_at > NOW() ORDER BY d.created_at DESC LIMIT 20`
    );
    return r.rows.map((r: Record<string, unknown>) => ({ ...this._map(r), creatorEmail: r.creator_email }));
  }

  async getMine(userId: string) {
    const r = await this.pool.query(
      "SELECT * FROM duels WHERE creator_id = $1 OR acceptor_id = $1 ORDER BY created_at DESC LIMIT 50",
      [userId]
    );
    return r.rows.map((r: Record<string, unknown>) => this._map(r));
  }

  async getOne(duelId: string) {
    const r = await this.pool.query(
      `SELECT d.*, c.email as creator_email, a.email as acceptor_email FROM duels d LEFT JOIN users c ON c.id = d.creator_id LEFT JOIN users a ON a.id = d.acceptor_id WHERE d.id = $1`,
      [duelId]
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Record<string, unknown>;
    return { ...this._map(row), creatorEmail: row.creator_email, acceptorEmail: row.acceptor_email };
  }

  private _map(r: Record<string, unknown>) {
    return {
      id: r.id, creatorId: r.creator_id, acceptorId: r.acceptor_id,
      gameId: r.game_id, betAmount: Number(r.bet_amount), status: r.status,
      creatorSpin: r.creator_spin, acceptorSpin: r.acceptor_spin,
      creatorMultiplier: r.creator_multiplier ? Number(r.creator_multiplier) : null,
      acceptorMultiplier: r.acceptor_multiplier ? Number(r.acceptor_multiplier) : null,
      winnerId: r.winner_id, houseFee: Number(r.house_fee || 0), pot: Number(r.pot || 0),
      createdAt: r.created_at, acceptedAt: r.accepted_at, settledAt: r.settled_at, expiresAt: r.expires_at,
    };
  }

  async expireOld(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const expired = await client.query(
        `SELECT * FROM duels WHERE status = 'open' AND expires_at < NOW() FOR UPDATE`
      );
      let count = 0;
      for (const duel of expired.rows) {
        await client.query("UPDATE wallets SET balance = balance + $1 WHERE user_id = $2", [duel.bet_amount, duel.creator_id]);
        await client.query(
          "INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description) SELECT id, $1, 'refund', $2, currency, balance FROM wallets WHERE user_id = $1",
          [duel.creator_id, duel.bet_amount]
        );
        await client.query("UPDATE duels SET status = 'cancelled' WHERE id = $1", [duel.id]);
        await client.query(
          "INSERT INTO duel_events (duel_id, user_id, event_type, payload) VALUES ($1,$2,'expired',$3)",
          [duel.id, duel.creator_id, JSON.stringify({ reason: "timeout", refundAmount: duel.bet_amount })]
        );
        count++;
      }
      await client.query("COMMIT");
      return count;
    } catch (e) {
      await client.query("ROLLBACK"); throw e;
    } finally { client.release(); }
  }

  async getStats(userId: string): Promise<Record<string, unknown>> {
    const r = await this.pool.query(
      `SELECT
        COUNT(*)::int as total_duels,
        COUNT(*) FILTER (WHERE winner_id = $1)::int as wins,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != $1)::int as losses,
        COUNT(*) FILTER (WHERE status = 'settled' AND winner_id IS NULL)::int as ties,
        COALESCE(MAX(bet_amount) FILTER (WHERE winner_id = $1), 0)::int as biggest_win,
        COALESCE(SUM(bet_amount), 0)::int as total_wagered
      FROM duels
      WHERE (creator_id = $1 OR acceptor_id = $1) AND status = 'settled'`,
      [userId]
    );
    const row = r.rows[0];
    const total = Number(row.total_duels);
    const wins = Number(row.wins);
    const losses = Number(row.losses);
    const ties = Number(row.ties);
    return {
      userId,
      totalDuels: total,
      wins,
      losses,
      ties,
      winRate: total > 0 ? Math.round((wins / total) * 10000) / 100 : 0,
      biggestWin: Number(row.biggest_win),
      totalWagered: Number(row.total_wagered),
      totalWon: 0, // Would need sum of win amounts
    };
  }

  async getLeaderboard(): Promise<Array<Record<string, unknown>>> {
    const r = await this.pool.query(
      `SELECT
        u.id as user_id,
        u.email,
        COUNT(*)::int as total_duels,
        COUNT(*) FILTER (WHERE d.winner_id = u.id)::int as wins,
        COUNT(*) FILTER (WHERE d.winner_id IS NOT NULL AND d.winner_id != u.id)::int as losses,
        ROUND(COUNT(*) FILTER (WHERE d.winner_id = u.id)::decimal / NULLIF(COUNT(*), 0) * 100, 2) as win_rate,
        COALESCE(SUM(d.bet_amount) FILTER (WHERE d.winner_id = u.id), 0)::int as total_won
      FROM duels d
      JOIN users u ON u.id = d.creator_id OR u.id = d.acceptor_id
      WHERE d.status = 'settled' AND u.id IN (
        SELECT DISTINCT unnest(ARRAY[d2.creator_id, d2.acceptor_id])
        FROM duels d2 WHERE d2.status = 'settled'
      )
      GROUP BY u.id, u.email
      HAVING COUNT(*) >= 5
      ORDER BY win_rate DESC
      LIMIT 20`
    );
    return r.rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      totalDuels: Number(row.total_duels),
      wins: Number(row.wins),
      losses: Number(row.losses),
      winRate: Number(row.win_rate),
      totalWon: Number(row.total_won),
    }));
  }
}
