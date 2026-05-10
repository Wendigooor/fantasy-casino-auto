import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { BonusDiceService } from "../services/bonus-dice.js";

let diceService: BonusDiceService | null = null;

export function initDiceService(pool: Pool) {
  diceService = new BonusDiceService(pool);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function diceBonusRoutes(app: FastifyInstance) {
  // GET /bonus/dice/status — check if player can roll
  app.get("/bonus/dice/status", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!diceService) throw new Error("Dice service not initialized");
      const status = await diceService.getStatus(userId);
      return status;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to get dice status");
    }
  });

  // POST /bonus/dice/roll — roll the dice
  app.post("/bonus/dice/roll", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!diceService) throw new Error("Dice service not initialized");

      const result = await diceService.roll(userId);
      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      if (err instanceof Error && err.message.startsWith("Cooldown")) {
        return reply.status(429).send({ error: err.message });
      }
      app.log.error(err);
      return reply.internalServerError("Dice roll failed");
    }
  });
}
