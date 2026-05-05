import { FastifyInstance } from "fastify";
import { pool } from "../index.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get("/leaderboard/balance", async () => {
    const r = await pool.query(
      `SELECT u.email, w.balance, w.currency FROM wallets w JOIN users u ON u.id = w.user_id WHERE w.balance > 0 ORDER BY w.balance DESC LIMIT 20`
    );
    return { leaderboard: r.rows.map((r: Record<string,unknown>) => ({ player: (r.email as string).split("@")[0], balance: Number(r.balance), currency: r.currency })) };
  });

  app.get("/leaderboard/spins", async () => {
    const r = await pool.query(
      `SELECT u.email, COUNT(*) as spins, COALESCE(SUM(win_amount),0) as total_won FROM game_rounds gr JOIN users u ON u.id = gr.user_id WHERE gr.created_at > NOW() - INTERVAL '24 hours' GROUP BY u.email ORDER BY spins DESC LIMIT 20`
    );
    return { leaderboard: r.rows.map((r: Record<string,unknown>) => ({ player: (r.email as string).split("@")[0], spins: parseInt(r.spins as string), won: Number(r.total_won) })) };
  });

  app.get("/leaderboard/wins", async () => {
    const r = await pool.query(
      `SELECT u.email, gr.win_amount, gr.game_id, gr.created_at FROM game_rounds gr JOIN users u ON u.id = gr.user_id WHERE gr.win_amount > 0 ORDER BY gr.win_amount DESC LIMIT 20`
    );
    return { leaderboard: r.rows.map((r: Record<string,unknown>) => ({ player: (r.email as string).split("@")[0], win: Number(r.win_amount), game: r.game_id })) };
  });
}
