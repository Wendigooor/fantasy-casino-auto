import { FastifyInstance, FastifyRequest } from "fastify";

async function uid(r: FastifyRequest) {
  return (r.user as { id: string }).id;
}

export async function tournamentRoutes(app: FastifyInstance) {
  // GET /api/v1/tournaments/active — combined endpoint
  app.get("/tournaments/active", async (request, reply) => {
    const userId = await uid(request);

    const tR = await app.pg.query(
      "SELECT * FROM tournaments WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
    );
    if (tR.rows.length === 0) {
      return reply.code(404).send({ error: "No active tournament" });
    }
    const tourney = tR.rows[0];

    // Check if user joined
    const entryR = await app.pg.query(
      "SELECT * FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2",
      [tourney.id, userId]
    );
    const entry = entryR.rows[0] as any;

    // Calculate user's actual score from game_rounds
    let userScore = Number(entry?.seed_points || 0);
    let userSpins = 0;
    let userWagered = 0;
    let userWon = 0;

    if (entry) {
      const gr = await app.pg.query(
        `SELECT COALESCE(COUNT(*),0) as spins, COALESCE(SUM(bet_amount),0) as wagered, COALESCE(SUM(win_amount),0) as won 
         FROM game_rounds WHERE user_id = $1 AND created_at >= $2`,
        [userId, tourney.starts_at]
      );
      userSpins = parseInt(gr.rows[0].spins);
      userWagered = Number(gr.rows[0].wagered);
      userWon = Number(gr.rows[0].won);
      userScore += userWagered + userWon * 2 + userSpins * 10;
    }

    // Build leaderboard from entries
    const entriesR = await app.pg.query(
      "SELECT * FROM tournament_entries WHERE tournament_id = $1 ORDER BY seed_points DESC",
      [tourney.id]
    );

    const leaderboard = [];
    for (const e of entriesR.rows) {
      const isCurrentUser = e.user_id === userId;
      let pts = Number(e.seed_points || 0);
      let spins = 0;
      let wagered = 0;
      let won = 0;

      if (isCurrentUser) {
        // Use calculated score for current user
        pts = userScore;
        spins = userSpins;
        wagered = userWagered;
        won = userWon;
      } else {
        // Use seed_points for seeded competitors
        pts = Number(e.seed_points || 0);
      }

      leaderboard.push({
        userId: e.user_id,
        player: e.display_name,
        points: pts,
        spins,
        wagered,
        won,
        isCurrentUser,
      });
    }

    // Sort by points descending
    leaderboard.sort((a: any, b: any) => b.points - a.points);
    // Assign ranks
    const ranked = leaderboard.map((e: any, i: number) => ({ ...e, rank: i + 1 }));

    // Get current user info
    const me = ranked.find((e: any) => e.isCurrentUser) || null;
    const nextRankTarget = me && me.rank > 1
      ? { rank: me.rank - 1, points: ranked.find((e: any) => e.rank === me.rank - 1)?.points || 0 }
      : null;

    return {
      tournament: {
        id: tourney.id,
        slug: tourney.slug,
        title: tourney.title,
        status: tourney.status,
        startsAt: tourney.starts_at,
        endsAt: tourney.ends_at,
        prizePool: Number(tourney.prize_pool),
        rules: tourney.rules,
        scoring: tourney.scoring,
      },
      me: me ? {
        joined: true,
        rank: me.rank,
        points: me.points,
        spins: me.spins,
        wagered: me.wagered,
        won: me.won,
        nextRankPoints: nextRankTarget?.points || null,
        pointsToNextRank: nextRankTarget ? nextRankTarget.points - me.points : null,
        prizeEligible: me.rank <= 3,
      } : { joined: false, rank: null, points: 0 },
      leaderboard: ranked,
      prizes: tourney.prizes,
    };
  });

  // POST /api/v1/tournaments/:id/join
  app.post("/tournaments/:id/join", async (request, reply) => {
    const userId = await uid(request);
    const tournamentId = (request.params as { id: string }).id;

    // Check tournament exists
    const tR = await app.pg.query("SELECT * FROM tournaments WHERE id = $1 AND status = 'active'", [tournamentId]);
    if (tR.rows.length === 0) return reply.code(404).send({ error: "Tournament not found or not active" });

    // Idempotent insert
    await app.pg.query(
      `INSERT INTO tournament_entries (tournament_id, user_id, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (tournament_id, user_id) DO NOTHING`,
      [tournamentId, userId, `Player_${userId.slice(0, 6)}`]
    );

    return { joined: true, tournamentId };
  });

  // POST /api/v1/tournaments/seed — internal/demo helper
  app.post("/tournaments/seed", async (request) => {
    const userId = await uid(request);
    const tR = await app.pg.query("SELECT id FROM tournaments WHERE status = 'active' LIMIT 1");
    if (tR.rows.length === 0) return { seeded: false, reason: "No active tournament" };

    for (let i = 0; i < 10; i++) {
      await app.pg.query(
        `INSERT INTO game_rounds (user_id, game_id, bet_amount, win_amount, state)
         VALUES ($1, 'slot-basic', 100, $2, 'settled')`,
        [userId, Math.floor(Math.random() * 80)]
      );
    }
    return { seeded: true };
  });
}
