import { FastifyInstance, FastifyRequest } from "fastify";
import { Analytics } from "../services/analytics.js";

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/analytics/events", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      const query = request.query as { limit?: string };
      const events = await Analytics.get().getEvents(userId, parseInt(query.limit || "20", 10));
      return { events };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch events");
    }
  });
}
