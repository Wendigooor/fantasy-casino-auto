import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { RiskScorer } from "../services/risk.js";

let riskService: RiskScorer | null = null;

export function initRiskService(pool: Pool) {
  riskService = new RiskScorer(pool);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function riskRoutes(app: FastifyInstance) {
  app.post(
    "/risk/score",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            recentBets: { type: "number" },
            recentWins: { type: "number" },
            depositAmount: { type: "number" },
            sessionDuration: { type: "number" },
            deviceFingerprint: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        if (!riskService) throw new Error("Risk service not initialized");

        const context = request.body as {
          recentBets?: number;
          recentWins?: number;
          depositAmount?: number;
          sessionDuration?: number;
          deviceFingerprint?: string;
        };

        const score = await riskService.scorePlayer(userId, context);
        return score;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        app.log.error(err);
        return reply.internalServerError("Risk scoring failed");
      }
    }
  );

  app.get("/risk/status", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!riskService) throw new Error("Risk service not initialized");

      const blocked = await riskService.isBlocked(userId);
      const activity = await riskService.getRecentActivity(userId);
      return { blocked, activity };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch risk status");
    }
  });
}
