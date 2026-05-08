import { FastifyInstance, FastifyRequest } from "fastify";
import { reconcileWallet } from "../services/reconciliation.js";

async function uid(r: FastifyRequest): Promise<string> {
  return (r.user as { id: string }).id;
}

export async function reconciliationRoutes(app: FastifyInstance) {
  app.get("/reconciliation/wallet/:userId", async (request, reply) => {
    const requesterId = await uid(request);
    const targetUserId = (request.params as { userId: string }).userId;

    // Only allow self-reconciliation or admin
    if (requesterId !== targetUserId) {
      const userR = await app.pg.query("SELECT role FROM users WHERE id = $1", [requesterId]);
      const role = userR.rows[0]?.role;
      if (role !== "admin") {
        return reply.code(403).send({ error: "Forbidden: can only reconcile own wallet" });
      }
    }

    const report = await reconcileWallet(app.pg, targetUserId);
    return report;
  });
}
