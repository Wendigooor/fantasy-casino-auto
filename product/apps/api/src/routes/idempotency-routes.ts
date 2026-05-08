import { FastifyInstance, FastifyRequest } from "fastify";
import { inspectKey } from "../services/idempotency-inspector.js";

async function uid(r: FastifyRequest): Promise<string> {
  return (r.user as { id: string }).id;
}

export async function idempotencyRoutes(app: FastifyInstance) {
  app.get("/idempotency/inspect/:key", async (request, reply) => {
    const key = (request.params as { key: string }).key;
    const result = await inspectKey(app.pg, key);
    return result;
  });
}
