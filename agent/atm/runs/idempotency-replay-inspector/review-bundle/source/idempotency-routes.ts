import { FastifyInstance, FastifyRequest } from "fastify";
import { inspectKey } from "../services/idempotency-inspector.js";

async function uid(r: FastifyRequest): Promise<string> {
  return (r.user as { id: string }).id;
}

export async function idempotencyRoutes(app: FastifyInstance) {
  app.get("/idempotency/inspect/:key", async (request) => {
    const requesterId = await uid(request);
    const key = (request.params as { key: string }).key;
    const result = await inspectKey(app.pg, key);
    // Only allow self-inspection or admin
    if (result.userId && result.userId !== requesterId) {
      const userR = await app.pg.query("SELECT role FROM users WHERE id = $1", [requesterId]);
      const role = userR.rows[0]?.role;
      if (role !== "admin") {
        return { status: "forbidden", key, error: "Cannot inspect other user's keys" };
      }
    }
    return result;
  });
}
