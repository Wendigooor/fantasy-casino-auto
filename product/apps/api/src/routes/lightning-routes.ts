
import { FastifyInstance, FastifyRequest } from "fastify";

async function uid(r: FastifyRequest) { return (r.user as { id: string }).id; }

export async function lightningRoutes(app: FastifyInstance) {
  app.get("/lightning/active", async (request) => {
    const userId = await uid(request);
    const lr = await app.pg.query("SELECT * FROM lightning_rounds WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (lr.rows.length === 0) return { round: null, me: null };

    const round = lr.rows[0];
    const now = new Date();
    const ends = new Date(round.ends_at);
    if (now > ends) {
      await app.pg.query("UPDATE lightning_rounds SET status = 'ended' WHERE id = $1", [round.id]);
      round.status = 'ended';
    }

    const entryR = await app.pg.query("SELECT * FROM lightning_round_entries WHERE round_id = $1 AND user_id = $2", [round.id, userId]);
    const entry = entryR.rows[0];

    // Calculate score from game_rounds since round started
    let score = 0;
    let spins = 0;
    if (entry) {
      const gr = await app.pg.query(
        "SELECT COALESCE(COUNT(*),0) as spins, COALESCE(SUM(bet_amount),0) as wagered, COALESCE(SUM(win_amount),0) as won FROM game_rounds WHERE user_id = $1 AND created_at >= $2",
        [userId, round.starts_at]
      );
      spins = parseInt(gr.rows[0].spins);
      const wagered = Number(gr.rows[0].wagered);
      const won = Number(gr.rows[0].won);
      const base = wagered + won * 2 + spins * 10;
      score = base * Number(round.multiplier);
      await app.pg.query("UPDATE lightning_round_entries SET score = $1 WHERE id = $2", [score, entry.id]);
    }

    // Leaderboard
    const lb = await app.pg.query("SELECT * FROM lightning_round_entries WHERE round_id = $1 ORDER BY score DESC LIMIT 20", [round.id]);
    const leaderboard = lb.rows.map((e: any, i: number) => ({
      rank: i + 1, player: e.user_id.slice(0, 8), score: Number(e.score), isCurrentUser: e.user_id === userId
    }));

    return {
      round: { id: round.id, status: round.status, multiplier: Number(round.multiplier), startsAt: round.starts_at, endsAt: round.ends_at, remaining: Math.max(0, Math.floor((new Date(round.ends_at).getTime() - Date.now()) / 1000)) },
      me: entry ? { joined: true, score, spins, multiplier: Number(round.multiplier), baseScore: Math.round(score / Number(round.multiplier)) } : { joined: false, score: 0 },
      leaderboard,
    };
  });

  app.post("/lightning/:id/join", async (request, reply) => {
    const userId = await uid(request);
    const roundId = (request.params as { id: string }).id;
    await app.pg.query("INSERT INTO lightning_round_entries (round_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roundId, userId]);
    return { joined: true, roundId };
  });

  // POST /api/v1/lightning/seed — create active round for demo
  app.post("/lightning/seed", async () => {
    await app.pg.query("UPDATE lightning_rounds SET status = 'ended' WHERE status = 'active'");
    const r = await app.pg.query("INSERT INTO lightning_rounds (status, ends_at) VALUES ('active', NOW() + INTERVAL '15 minutes') RETURNING id");
    return { seeded: true, roundId: r.rows[0].id };
  });
}
