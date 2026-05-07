import { FastifyInstance, FastifyRequest } from "fastify";

async function uid(r: FastifyRequest) { return (r.user as { id: string }).id; }

async function calcScore(pg: any, userId: string, since: string) {
  const gr = await pg.query(
    `SELECT COALESCE(COUNT(*),0) as spins, COALESCE(SUM(bet_amount),0) as wagered, COALESCE(SUM(win_amount),0) as won
     FROM game_rounds WHERE user_id = $1 AND created_at >= $2`,
    [userId, since]
  );
  return {
    spins: parseInt(gr.rows[0].spins),
    wagered: Number(gr.rows[0].wagered),
    won: Number(gr.rows[0].won),
    base: Number(gr.rows[0].wagered) + Number(gr.rows[0].won) * 2 + parseInt(gr.rows[0].spins) * 10,
  };
}

export async function tournamentRoutes(app: FastifyInstance) {
  app.get("/tournaments/active", async (request) => {
    const userId = await uid(request);
    const tR = await app.pg.query("SELECT * FROM tournaments WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (tR.rows.length === 0) return { tournament: null, me: { joined: false }, leaderboard: [], prizes: [] };
    const tourney = tR.rows[0];

    const entryR = await app.pg.query("SELECT * FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2", [tourney.id, userId]);
    const entry = entryR.rows[0] as any;

    // Boost state
    let boost = {
      status: "locked", bonusPoints: 0, spinsRemaining: 0,
      questsCompleted: 0, questsTotal: 4,
      quests: [
        { code: "join_sprint", title: "Join The Sprint", progress: 0, target: 1, status: "active", reward: "+50 boost charge" },
        { code: "spin_to_charge", title: "Spin To Charge", progress: 0, target: 3, status: "locked", reward: "+50 boost charge" },
        { code: "point_surge", title: "Point Surge", progress: 0, target: 500, status: "locked", reward: "Unlock boost chest" },
        { code: "open_chest", title: "Open Boost Chest", progress: 0, target: 1, status: "locked", reward: "Score boost activated" },
      ],
    };

    let userScore = Number(entry?.seed_points || 0);
    let baseScore = 0;
    let boostScore = 0;

    if (entry) {
      const score = await calcScore(app.pg, userId, tourney.starts_at);
      baseScore = score.base;
      userScore += baseScore;

      // Load or create boost
      let bR = await app.pg.query("SELECT * FROM tournament_boosts WHERE tournament_id = $1 AND user_id = $2", [tourney.id, userId]);
      let boostRow = bR.rows[0] as any;

      if (!boostRow) {
        await app.pg.query(
          `INSERT INTO tournament_boosts (tournament_id, user_id, status, quest_progress)
           VALUES ($1, $2, 'locked', $3) ON CONFLICT DO NOTHING`,
          [tourney.id, userId, JSON.stringify(boost.quests)]
        );
        bR = await app.pg.query("SELECT * FROM tournament_boosts WHERE tournament_id = $1 AND user_id = $2", [tourney.id, userId]);
        boostRow = bR.rows[0];
      }

      boost.status = boostRow.status;
      boost.bonusPoints = Number(boostRow.bonus_points);
      boost.spinsRemaining = Number(boostRow.spins_remaining);

      // Calculate quest progress from actual state
      const quests = (boostRow.quest_progress || []) as any[];
      const isJoined = true;
      const spins = score.spins;
      const points = baseScore;

      const qs = [
        { code: "join_sprint", title: "Join The Sprint", progress: isJoined ? 1 : 0, target: 1, status: isJoined ? "completed" : "active", reward: "+50 boost charge" },
        { code: "spin_to_charge", title: "Spin To Charge", progress: Math.min(spins, 3), target: 3, status: spins >= 3 ? (boost.status === "locked" ? "completed" : "completed") : "active", reward: "+50 boost charge" },
        { code: "point_surge", title: "Point Surge", progress: Math.min(points, 500), target: 500, status: points >= 500 ? "completed" : "active", reward: "Unlock boost chest" },
        { code: "open_chest", title: "Open Boost Chest", progress: boost.status !== "locked" ? 1 : 0, target: 1, status: boost.status !== "locked" ? "completed" : "locked", reward: "Score boost activated" },
      ];

      boost.quests = qs;
      boost.questsCompleted = qs.filter((q: any) => q.status === "completed").length;
      boost.questsTotal = 4;

      // Auto-set ready when join+spin+point quests complete
      const allPrereqsDone = qs.filter((q: any) => q.code !== "open_chest").every((q: any) => q.status === "completed");
      if (allPrereqsDone && boost.status === "locked") {
        await app.pg.query("UPDATE tournament_boosts SET status = 'ready', updated_at = NOW() WHERE id = $1", [boostRow.id]);
        boost.status = "ready";
      }

      // If boost is active, calculate bonus points from spins since activation
      if (boost.status === "active") {
        const sinceAct = boostRow.activated_at || tourney.starts_at;
        const spinsSinceAct = await app.pg.query(
          `SELECT COUNT(*) as c FROM game_rounds WHERE user_id = $1 AND created_at >= $2`,
          [userId, sinceAct]
        );
        const count = parseInt(spinsSinceAct.rows[0].c);
        const bonus = Math.min(count * 50, Number(boostRow.spins_remaining) * 50);
        boost.bonusPoints = bonus;
        boost.spinsRemaining = Math.max(0, Number(boostRow.spins_remaining) - count);

        // Update DB
        await app.pg.query(
          `UPDATE tournament_boosts SET bonus_points = $1, spins_remaining = $2, updated_at = NOW() WHERE id = $3`,
          [bonus, boost.spinsRemaining, boostRow.id]
        );
      }

      userScore += boost.bonusPoints;
    }

    // Build leaderboard
    const entriesR = await app.pg.query("SELECT * FROM tournament_entries WHERE tournament_id = $1 ORDER BY seed_points DESC", [tourney.id]);
    const leaderboard: any[] = [];
    for (const e of entriesR.rows) {
      const isCurrentUser = e.user_id === userId;
      let pts = Number(e.seed_points || 0);
      if (isCurrentUser) {
        pts = userScore;
      }
      const bPts = isCurrentUser ? boost.bonusPoints : 0;
      leaderboard.push({
        userId: e.user_id, player: e.display_name, points: pts,
        basePoints: isCurrentUser ? baseScore : pts,
        boostPoints: bPts,
        totalPoints: pts,
        isCurrentUser, spins: 0, wagered: 0, won: 0,
      });
    }
    leaderboard.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    const ranked = leaderboard.map((e: any, i: number) => ({ ...e, rank: i + 1 }));
    const me = ranked.find((e: any) => e.isCurrentUser) || null;
    const nextRankTarget = me && me.rank > 1 ? { rank: me.rank - 1, points: ranked.find((e: any) => e.rank === me.rank - 1)?.totalPoints || 0 } : null;

    return {
      tournament: { id: tourney.id, slug: tourney.slug, title: tourney.title, status: tourney.status, startsAt: tourney.starts_at, endsAt: tourney.ends_at, prizePool: Number(tourney.prize_pool), rules: tourney.rules, scoring: tourney.scoring },
      boost,
      me: me ? { joined: true, rank: me.rank, points: me.totalPoints, basePoints: me.basePoints, boostPoints: me.boostPoints, spins: me.spins, wagered: me.wagered, won: me.won, nextRankPoints: nextRankTarget?.points || null, pointsToNextRank: nextRankTarget ? nextRankTarget.points - me.totalPoints : null, prizeEligible: me.rank <= 3 } : { joined: false, rank: null, points: 0 },
      leaderboard: ranked,
      prizes: tourney.prizes,
    };
  });

  app.post("/tournaments/:id/join", async (request, reply) => {
    const userId = await uid(request);
    const tournamentId = (request.params as { id: string }).id;
    const tR = await app.pg.query("SELECT * FROM tournaments WHERE id = $1 AND status = 'active'", [tournamentId]);
    if (tR.rows.length === 0) return reply.code(404).send({ error: "Tournament not found or not active" });
    await app.pg.query(
      `INSERT INTO tournament_entries (tournament_id, user_id, display_name) VALUES ($1, $2, $3) ON CONFLICT (tournament_id, user_id) DO NOTHING`,
      [tournamentId, userId, `Player_${userId.slice(0, 6)}`]
    );
    return { joined: true, tournamentId };
  });

  app.post("/tournaments/:id/boost/activate", async (request, reply) => {
    const userId = await uid(request);
    const tournamentId = (request.params as { id: string }).id;

    const bR = await app.pg.query(
      "SELECT * FROM tournament_boosts WHERE tournament_id = $1 AND user_id = $2",
      [tournamentId, userId]
    );
    if (bR.rows.length === 0) return reply.code(400).send({ error: "No boost record found. Join tournament first." });
    const boost = bR.rows[0] as any;
    if (boost.status !== "ready") return reply.code(400).send({ error: `Boost cannot be activated. Current status: ${boost.status}` });

    await app.pg.query(
      `UPDATE tournament_boosts SET status = 'active', spins_remaining = 5, bonus_points = 0, activated_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [boost.id]
    );
    return { activated: true, status: "active", spinsRemaining: 5 };
  });

  app.post("/tournaments/seed", async (request) => {
    const userId = await uid(request);
    const tR = await app.pg.query("SELECT id FROM tournaments WHERE status = 'active' LIMIT 1");
    if (tR.rows.length === 0) return { seeded: false };
    for (let i = 0; i < 10; i++) {
      await app.pg.query(
        `INSERT INTO game_rounds (user_id, game_id, bet_amount, win_amount, state) VALUES ($1, 'slot-basic', 100, $2, 'settled')`,
        [userId, Math.floor(Math.random() * 80)]
      );
    }
    return { seeded: true };
  });
}
