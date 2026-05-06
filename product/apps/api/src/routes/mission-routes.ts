import { FastifyInstance, FastifyRequest } from "fastify";
import { broadcastUser } from "./sse.js";

async function uid(r: FastifyRequest) {
  return (r.user as { id: string }).id;
}

// Progress calculation: derive from existing tables
async function calcProgress(pg: any, userId: string, objectiveType: string, target: number): Promise<number> {
  switch (objectiveType) {
    case "spin_count": {
      const r = await pg.query("SELECT COUNT(*) as c FROM game_rounds WHERE user_id = $1", [userId]);
      return Math.min(parseInt(r.rows[0].c), target);
    }
    case "total_wagered": {
      const r = await pg.query("SELECT COALESCE(SUM(bet_amount),0) as t FROM game_rounds WHERE user_id = $1", [userId]);
      return Math.min(Number(r.rows[0].t), target);
    }
    case "duel_completed": {
      const r = await pg.query("SELECT COUNT(*) as c FROM duels WHERE (creator_id = $1 OR acceptor_id = $1) AND status = 'settled'", [userId]);
      return Math.min(parseInt(r.rows[0].c), target);
    }
    case "duel_won": {
      const r = await pg.query("SELECT COUNT(*) as c FROM duels WHERE winner_id = $1", [userId]);
      return Math.min(parseInt(r.rows[0].c), target);
    }
    case "bonus_claimed": {
      const r = await pg.query("SELECT COUNT(*) as c FROM ledger_entries WHERE user_id = $1 AND type = 'bonus_credit'", [userId]);
      return Math.min(parseInt(r.rows[0].c), target);
    }
    case "reward_claimed": {
      const r = await pg.query("SELECT COUNT(*) as c FROM player_missions WHERE user_id = $1 AND status = 'claimed'", [userId]);
      return Math.min(parseInt(r.rows[0].c), target);
    }
    default:
      return 0;
  }
}

export async function missionRoutes(app: FastifyInstance) {
  // GET /api/v1/missions — list all missions with progress
  app.get("/missions", async (request) => {
    const userId = await uid(request);

    const missionsR = await app.pg.query(
      "SELECT * FROM missions WHERE active = true ORDER BY category, objective_target ASC"
    );
    const missions = missionsR.rows;

    // Get player's claim state
    const playerR = await app.pg.query(
      "SELECT mission_id, status, completed_at, claimed_at FROM player_missions WHERE user_id = $1",
      [userId]
    );
    const playerMap = new Map<string, any>();
    for (const row of playerR.rows) {
      playerMap.set(row.mission_id, row);
    }

    const result = [];
    let activeCount = 0;
    let completedCount = 0;
    let claimedCount = 0;

    for (const m of missions) {
      const pm = playerMap.get(m.id);
      let status = "active";
      let progress = 0;

      if (pm?.status === "claimed") {
        status = "claimed";
        progress = Number(m.objective_target);
        claimedCount++;
      } else {
        progress = await calcProgress(app.pg, userId, m.objective_type, Number(m.objective_target));
        if (progress >= Number(m.objective_target)) {
          status = "completed";
          if (pm?.status === "completed") {
            status = "completed";
          }
          completedCount++;
        } else {
          activeCount++;
        }
      }

      result.push({
        id: m.id,
        code: m.code,
        title: m.title,
        description: m.description,
        category: m.category,
        objectiveType: m.objective_type,
        progress,
        target: Number(m.objective_target),
        progressPercent: Math.round((progress / Number(m.objective_target)) * 100),
        status,
        reward: { type: m.reward_type, amount: Number(m.reward_amount) },
        cta: { label: m.cta_label || "Go", href: m.cta_href || "/" },
      });
    }

    // Build groups
    const groups = [
      {
        id: "daily-rush",
        title: "Daily Rush",
        progress: result.filter(m => m.status === "completed" || m.status === "claimed").length,
        target: 3,
        completionReward: { type: "coins", amount: 500 },
        missions: result.filter(m => m.category === "onboarding" || m.category === "daily"),
      },
      {
        id: "pvp-challenge",
        title: "PvP Challenge",
        progress: result.filter(m => m.code === "duel_challenger").some(m => m.status !== "active") ? 1 : 0,
        target: 1,
        completionReward: { type: "coins", amount: 250 },
        missions: result.filter(m => m.category === "pvp"),
      },
    ];

    // Find next best action
    const nextActive = result.find(m => m.status === "active");
    const nextBestAction = nextActive ? { label: nextActive.cta.label, href: nextActive.cta.href } : { label: "Play Now", href: "/" };

    // Total reward pool
    const rewardPool = result.reduce((s, m) => s + m.reward.amount, 0);
    const totalEarned = result.filter(m => m.status === "claimed").reduce((s, m) => s + m.reward.amount, 0);

    return {
      campaign: {
        id: "quest-rush",
        title: "Quest Rush",
        subtitle: "Complete missions before the timer ends.",
        endsAt: new Date(Date.now() + 86400000).toISOString(), // 24h from now
        rewardPool,
      },
      groups,
      missions: result,
      summary: {
        active: activeCount,
        completed: completedCount,
        claimed: claimedCount,
        totalClaimable: result.filter((m) => m.status === "completed").reduce((s, m) => s + m.reward.amount, 0),
        totalEarned,
        nextBestAction,
      },
    };
  });

  // POST /api/v1/missions/:id/claim — claim a completed mission reward
  app.post("/missions/:id/claim", async (request, reply) => {
    const userId = await uid(request);
    const missionId = (request.params as { id: string }).id;

    const client = await app.pg.connect();
    try {
      await client.query("BEGIN");

      // Lock player_missions row
      const pmR = await client.query(
        "SELECT * FROM player_missions WHERE user_id = $1 AND mission_id = $2 FOR UPDATE",
        [userId, missionId]
      );

      let pm = pmR.rows[0] as any;

      if (pm && pm.status === "claimed") {
        await client.query("COMMIT");
        return reply.code(400).send({ error: "Already claimed" });
      }

      // Get mission definition
      const mR = await client.query("SELECT * FROM missions WHERE id = $1", [missionId]);
      if (mR.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Mission not found" });
      }
      const mission = mR.rows[0];

      // Calculate current progress
      const progress = await calcProgress(client, userId, mission.objective_type, Number(mission.objective_target));
      if (progress < Number(mission.objective_target)) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ error: "Mission not completed yet" });
      }

      // Upsert player_mission
      if (!pm) {
        const ins = await client.query(
          `INSERT INTO player_missions (user_id, mission_id, status, completed_at)
           VALUES ($1, $2, 'completed', NOW())
           ON CONFLICT (user_id, mission_id) DO NOTHING
           RETURNING *`,
          [userId, missionId]
        );
        pm = ins.rows[0];
      }

      // Update to claimed
      await client.query(
        `UPDATE player_missions SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND mission_id = $2`,
        [userId, missionId]
      );

      // Credit reward if coins
      let wallet = null;
      if (mission.reward_type === "coins" && Number(mission.reward_amount) > 0) {
        const wR = await client.query(
          "UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING *",
          [Number(mission.reward_amount), userId]
        );
        wallet = wR.rows[0];

        await client.query(
          `INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after, description)
           VALUES ($1, $2, 'mission_reward', $3, $4, $5, $6)`,
          [wallet.id, userId, Number(mission.reward_amount), wallet.currency, wallet.balance, `Mission reward: ${mission.title}`]
        );
      }

      await client.query("COMMIT");

      // Broadcast wallet update via SSE
      if (wallet) {
        broadcastUser(userId, "wallet_update", { balance: Number(wallet.balance), currency: wallet.currency });
      }

      return {
        missionId,
        status: "claimed",
        reward: { type: mission.reward_type, amount: Number(mission.reward_amount) },
        wallet: wallet ? { balance: Number(wallet.balance), currency: wallet.currency } : null,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });

  // POST /api/v1/missions/refresh — force progress recalculation for all missions
  app.post("/missions/refresh", async (request) => {
    const userId = await uid(request);

    const missionsR = await app.pg.query(
      "SELECT * FROM missions WHERE active = true"
    );

    for (const m of missionsR.rows) {
      const progress = await calcProgress(app.pg, userId, m.objective_type, Number(m.objective_target));
      if (progress >= Number(m.objective_target)) {
        // Auto-complete
        await app.pg.query(
          `INSERT INTO player_missions (user_id, mission_id, status, completed_at)
           VALUES ($1, $2, 'completed', NOW())
           ON CONFLICT (user_id, mission_id) DO UPDATE SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE player_missions.status = 'active'`,
          [userId, m.id]
        );
      }
    }

    return { refreshed: true };
  });
}
