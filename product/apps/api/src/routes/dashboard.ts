import { FastifyInstance } from "fastify";
import { verifyAdmin } from "../middlewares/auth-middleware.js";
import { pool } from "../index.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/dashboard/ops",
    { preHandler: verifyAdmin },
    async () => {
      const [
        totalUsers,
        totalRevenue,
        totalWagered,
        totalWins,
        activePlayers,
        recentDeposits,
        gameStats,
        riskAlerts,
      ] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM users"),
        pool.query(
          `SELECT COALESCE(SUM(
            (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries e 
             WHERE e.wallet_id = w.id AND e.type = 'deposit')
            - (SELECT COALESCE(SUM(amount), 0) FROM ledger_entries e 
               WHERE e.wallet_id = w.id AND e.type = 'bet_debit')
          ), 0) as revenue FROM wallets w`
        ),
        pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total FROM ledger_entries WHERE type IN ('bet_reserve', 'bet_debit')`
        ),
        pool.query(
          `SELECT COALESCE(SUM(win_amount), 0) as total FROM game_rounds`
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM users WHERE is_active = true AND created_at > NOW() - INTERVAL '24 hours'`
        ),
        pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count, 
                  EXTRACT(HOUR FROM NOW() - MAX(created_at)) as last_hour
           FROM ledger_entries WHERE type = 'deposit' AND created_at > NOW() - INTERVAL '24 hours'`
        ),
        pool.query(
          `SELECT game_id, COUNT(*) as rounds, 
                  COALESCE(SUM(win_amount), 0) as total_wins,
                  COALESCE(SUM(bet_amount), 0) as total_bets
           FROM game_rounds 
           GROUP BY game_id ORDER BY rounds DESC LIMIT 10`
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM risk_scores WHERE blocked = true AND scored_at > NOW() - INTERVAL '24 hours'`
        ),
      ]);

      const row0 = totalUsers.rows[0];
      const row1 = totalRevenue.rows[0];
      const row2 = totalWagered.rows[0];
      const row3 = totalWins.rows[0];
      const row4 = activePlayers.rows[0];
      const row5 = recentDeposits.rows[0];
      const row8 = riskAlerts.rows[0];

      const revenue = parseInt(row1.revenue, 10);
      const ngr = revenue;
      const rtp = row2.total > 0 
        ? Math.round((parseInt(row3.total, 10) / parseInt(row2.total, 10)) * 10000) / 100 
        : 0;

      return {
        meta: {
          generatedAt: new Date().toISOString(),
          period: "24h",
        },
        players: {
          total: parseInt(row0.count, 10),
          active24h: parseInt(row4.count, 10),
        },
        revenue: {
          totalDeposits: parseInt(row5.total, 10),
          depositCount: parseInt(row5.count, 10),
          ngr: ngr,
          rtp: rtp,
        },
        gaming: {
          totalWagered: parseInt(row2.total, 10),
          totalWins: parseInt(row3.total, 10),
          topGames: gameStats.rows.map((r) => ({
            gameId: r.game_id,
            rounds: parseInt(r.rounds, 10),
            totalWins: parseInt(r.total_wins, 10),
            totalBets: parseInt(r.total_bets, 10),
          })),
        },
        risk: {
          blockedPlayers24h: parseInt(row8.count, 10),
        },
      };
    }
  );
}
