import { FastifyInstance, FastifyRequest } from "fastify";
import { DuelService } from "../services/duel.js";
import { GameService } from "../services/game.js";
import { broadcastUser } from "./sse.js";

let duelService: DuelService | null = null;
let gameService: GameService | null = null;

export function initDuelService(ds: DuelService, gs: GameService) { duelService = ds; gameService = gs; }

async function uid(r: FastifyRequest) { const u = r.user as { id: string } | undefined; if (!u) throw new Error("Auth"); return u.id; }

export async function duelRoutes(app: FastifyInstance) {
  app.post("/duels", async (request, reply) => {
    try {
      const userId = await uid(request);
      const { gameId, betAmount } = request.body as { gameId: string; betAmount: number };
      const duel = await duelService!.create(userId, gameId, betAmount);
      broadcastUser(userId, "duel_update", duel);
      return reply.code(201).send(duel);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Failed";
      return reply.code(400).send({ error: m });
    }
  });

  app.get("/duels/open", async () => ({
    duels: await duelService!.getOpen(),
  }));

  app.get("/duels/mine", async (request) => ({
    duels: await duelService!.getMine(await uid(request)),
  }));

  app.get("/duels/:id", async (request, reply) => {
    const duel = await duelService!.getOne((request.params as { id: string }).id);
    if (!duel) return reply.code(404).send({ error: "Not found" });
    return duel;
  });

  app.post("/duels/:id/accept", async (request, reply) => {
    try {
      const userId = await uid(request);
      const duelId = (request.params as { id: string }).id;
      const duel = await duelService!.getOne(duelId);
      const result = await duelService!.accept(duelId, userId);
      broadcastUser(userId, "duel_update", result);
      if (duel) broadcastUser(duel.creatorId as string, "duel_update", result);
      return result;
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed" });
    }
  });

  app.post("/duels/:id/spin", async (request, reply) => {
    try {
      const userId = await uid(request);
      const duelId = (request.params as { id: string }).id;
      const duel = await duelService!.getOne(duelId);
      if (!duel) return reply.code(404).send({ error: "Not found" });

      // Do actual slot spin
      const wallet = await app.pg.query("SELECT id FROM wallets WHERE user_id = $1", [userId]);
      const spinResult = await gameService!.spin(userId, wallet.rows[0].id, duel.gameId as string, Number(duel.betAmount), `duel-${duelId}-${userId}-${Date.now()}`);

      const result = await duelService!.spin(duelId, userId, { reels: spinResult.reels, winAmount: spinResult.winAmount });
      broadcastUser(userId, "duel_update", result);

      // Notify opponent
      const opponentId = duel.creatorId === userId ? duel.acceptorId : duel.creatorId;
      if (opponentId) broadcastUser(opponentId as string, "duel_update", result);

      return result;
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed" });
    }
  });

  app.post("/duels/:id/cancel", async (request, reply) => {
    try {
      const userId = await uid(request);
      const result = await duelService!.cancel((request.params as { id: string }).id, userId);
      return result;
    } catch (err: unknown) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Failed" });
    }
  });

  // Expire old duels (internal cron endpoint)
  app.post("/duels/expire", async () => {
    const count = await duelService!.expireOld();
    return { expired: count };
  });

  // Player duel stats (own stats from JWT)
  app.get("/players/me/duel-stats", async (request) => {
    const userId = await uid(request);
    return await duelService!.getStats(userId);
  });

  // Duel leaderboard
  app.get("/leaderboard/duels", async () => {
    return { leaderboard: await duelService!.getLeaderboard() };
  });
}
