import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { ComboService, ComboState } from "../services/combo.js";

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function comboRoutes(app: FastifyInstance) {
  const pool = app.pg;
  const svc = new ComboService(pool);
  await svc.ensureTable();

  app.get("/combo/fever", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      const state = await svc.getState(userId);
      return state;
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.code(500).send({ error: "combo_failed" });
    }
  });
}

/** Call this after each spin to update streak */
export async function recordComboAfterSpin(
  pool: Pool,
  userId: string,
  winAmount: number
): Promise<ComboState> {
  const svc = new ComboService(pool);
  if (winAmount > 0) {
    return svc.recordWin(userId);
  } else {
    return svc.recordLoss(userId);
  }
}
