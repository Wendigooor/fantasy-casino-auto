import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { KycService } from "../services/kyc.js";

let kycService: KycService | null = null;

export function initKycService(pool: Pool) {
  kycService = new KycService(pool);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function kycRoutes(app: FastifyInstance) {
  app.post(
    "/kyc/submit",
    {
      schema: {
        body: {
          type: "object",
          required: ["documentType"],
          properties: {
            documentType: { type: "string" },
            documentReference: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        if (!kycService) throw new Error("KYC service not initialized");
        const { documentType, documentReference } = request.body as {
          documentType: string;
          documentReference?: string;
        };

        const existing = await kycService.getStatus(userId);
        if (existing && existing.status !== "rejected") {
          return reply.code(409).send({
            error: "already_submitted",
            message: `KYC already ${existing.status}`,
          });
        }

        const verification = await kycService.submit(userId, documentType, documentReference);
        return reply.code(201).send(verification);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        app.log.error(err);
        return reply.internalServerError("Failed to submit KYC");
      }
    }
  );

  app.get("/kyc/status", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!kycService) throw new Error("KYC service not initialized");
      const status = await kycService.getStatus(userId);
      return { verified: !!status && status.status === "approved", status };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch KYC status");
    }
  });

  app.get("/admin/kyc/pending", async (request, reply) => {
    try {
      const user = request.user as { id: string; email: string; role: string } | undefined;
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
      }
      if (!kycService) throw new Error("KYC service not initialized");
      const pending = await kycService.listPending();
      return { verifications: pending };
    } catch (err: unknown) {
      app.log.error(err);
      return reply.internalServerError("Failed to fetch pending KYC");
    }
  });

  app.post(
    "/admin/kyc/:id/review",
    {
      schema: {
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["approved", "rejected"] },
            notes: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const reviewer = request.user as { id: string; email: string; role: string } | undefined;
        if (!reviewer || reviewer.role !== "admin") {
          return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
        }
        if (!kycService) throw new Error("KYC service not initialized");

        const { id } = request.params as { id: string };
        const { status, notes } = request.body as {
          status: "approved" | "rejected";
          notes?: string;
        };

        const result = await kycService.review(id, status, reviewer.id, notes);
        return result;
      } catch (err: unknown) {
        app.log.error(err);
        const message = err instanceof Error ? err.message : "Review failed";
        return reply.internalServerError(message);
      }
    }
  );
}
