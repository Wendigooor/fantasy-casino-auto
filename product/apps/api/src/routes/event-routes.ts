import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { EventEmitter } from "../services/events.js";

let eventService: EventEmitter | null = null;

export function initEventService(pool: Pool) {
  eventService = new EventEmitter(pool);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!eventService) throw new Error("Event service not initialized");

      const query = request.query as {
        limit?: string;
        after?: string;
        eventTypes?: string;
      };

      const events = await eventService.getEvents(userId, {
        limit: parseInt(query.limit || "50", 10),
        after: query.after ? new Date(query.after) : undefined,
        eventTypes: query.eventTypes
          ? query.eventTypes.split(",")
          : undefined,
      });

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
