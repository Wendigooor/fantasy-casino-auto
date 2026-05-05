import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { BonusRuleEngine } from "../services/bonus.js";
import { WalletService } from "../services/wallet.js";

let bonusService: BonusRuleEngine | null = null;
let walletService: WalletService | null = null;

export function initBonusService(pool: Pool, wallet?: WalletService) {
  bonusService = new BonusRuleEngine(pool);
  walletService = wallet || null;
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function bonusRoutes(app: FastifyInstance) {
  app.get("/bonus/rules", async () => {
    if (!bonusService) return { rules: [] };
    const rules = await bonusService.loadRules();
    return { rules };
  });

  app.post(
    "/bonus/claim",
    {
      schema: {
        body: {
          type: "object",
          required: ["ruleId", "depositAmount", "idempotencyKey"],
          properties: {
            ruleId: { type: "string" },
            depositAmount: { type: "number", minimum: 1 },
            idempotencyKey: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        if (!bonusService) throw new Error("Bonus service not initialized");
        if (!walletService) throw new Error("Wallet service not initialized");
        const { ruleId, depositAmount, idempotencyKey } = request.body as {
          ruleId: string;
          depositAmount: number;
          idempotencyKey: string;
        };

        const rules = await bonusService.loadRules();
        const rule = rules.find((r) => r.id === ruleId);
        if (!rule) {
          return reply.notFound(`Bonus rule ${ruleId} not found`);
        }

        const result = bonusService.applyBonus(rule, depositAmount);

        if (result.bonusAmount > 0) {
          // Credit bonus to wallet via ledger
          await walletService.deposit(
            userId,
            result.currency,
            result.bonusAmount,
            `${idempotencyKey}-bonus`,
            `Bonus: ${rule.name}`
          );
          // Create wagering requirement
          await bonusService.createWageringRequirement(
            ruleId,
            userId,
            result.wageringRequired
          );
        }

        const balance = await walletService.getBalance(userId, result.currency);
        return { ...result, balance };
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        app.log.error(err);
        const message = err instanceof Error ? err.message : "Bonus claim failed";
        return reply.internalServerError(message);
      }
    }
  );

  app.get("/bonus/wagering", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!bonusService) throw new Error("Bonus service not initialized");
      const progress = await bonusService.getWageringProgress(userId);
      return { progress };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch wagering progress");
    }
  });
}
