import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { GameService } from "../services/game.js";
import { WalletService } from "../services/wallet.js";
import { BonusRuleEngine } from "../services/bonus.js";
import { ProviderRegistry } from "../services/provider.js";
import { Analytics } from "../services/analytics.js";
import { broadcastUser } from "./sse.js";
import { incMetric } from "./metrics.js";
import { spinSchema, validate } from "../validation/schemas.js";
import { recordComboAfterSpin } from "./combo.js";

let gameService: GameService | null = null;

export function initGameService(pool: Pool, walletService: WalletService, registry: ProviderRegistry, bonusEngine?: BonusRuleEngine) {
  gameService = new GameService(pool, walletService, registry, bonusEngine);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

export async function gameRoutes(app: FastifyInstance) {
  const pool = app.pg;

  app.post(
    "/games/slot/spin",
    {
      schema: {
        body: {
          type: "object",
          required: ["betAmount", "idempotencyKey"],
          properties: {
            betAmount: { type: "number", minimum: 10 },
            currency: { type: "string", default: "USD" },
            idempotencyKey: { type: "string" },
            gameId: { type: "string", default: "slot-basic" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        const parsed = validate(spinSchema, request.body);
        if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
        const { betAmount, currency = "USD", idempotencyKey, gameId = "slot-basic" } = parsed.data;

        // Get or create wallet
        const walletResult = await pool.query(
          "SELECT id, balance, currency FROM wallets WHERE user_id = $1 AND currency = $2",
          [userId, currency]
        );
        let wallet = walletResult.rows[0];
        if (!wallet) {
          const insertResult = await pool.query(
            `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, $2, 0) RETURNING id, balance, currency`,
            [userId, currency]
          );
          wallet = insertResult.rows[0];
        }

        // Check balance
        if (wallet.balance < betAmount) {
          return reply.code(400).send({
            error: "insufficient_funds",
            message: `Insufficient funds: balance=${wallet.balance}, required=${betAmount}`,
          });
        }

        if (!gameService) throw new Error("Game service not initialized");

        const result = await gameService.spin(
          userId,
          wallet.id as string,
          gameId,
          betAmount,
          idempotencyKey
        );
        Analytics.get().trackSpin(userId, gameId, betAmount, result.winAmount);
        incMetric("spins_total");
        broadcastUser(userId, "spin_result", result);
        // Track combo streak after spin
        recordComboAfterSpin(pool, userId, result.winAmount).catch(() => {});
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        app.log.error({ message: (err as Error).message, type: (err as Error).constructor?.name });
        return reply.code(500).send({ error: "spin_failed", message: "Internal server error" });
      }
    }
  );

  app.get("/games/history", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      const query = request.query as { limit?: string; offset?: string };
      const result = await pool.query(
        `SELECT id, game_id, bet_amount, win_amount, state, currency, result, created_at 
         FROM game_rounds 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, parseInt(query.limit || "20", 10), parseInt(query.offset || "0", 10)]
      );
      return {
        rounds: result.rows.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          gameId: row.game_id as string,
          betAmount: row.bet_amount as number,
          winAmount: row.win_amount as number,
          state: row.state as string,
          currency: row.currency as string,
          result: row.result as Record<string, unknown> | null,
          createdAt: row.created_at as string,
        })),
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch history");
    }
  });
}
