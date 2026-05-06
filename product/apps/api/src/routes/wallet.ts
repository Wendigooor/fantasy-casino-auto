import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { WalletService, WalletNotFoundError, InsufficientFundsError, WalletFrozenError, WalletClosedError, InvalidAmountError } from "../services/wallet.js";
import { Analytics } from "../services/analytics.js";
import { broadcastUser } from "./sse.js";
import { incMetric } from "./metrics.js";
import { depositSchema, withdrawalSchema, validate } from "../validation/schemas.js";

let walletService: WalletService | null = null;

export function initWalletService(pool: Pool) {
  walletService = new WalletService(pool);
}

async function getUserId(request: FastifyRequest): Promise<string> {
  const user = request.user as { id: string; email: string; role: string } | undefined;
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

export async function walletRoutes(app: FastifyInstance) {
  app.get("/wallet", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!walletService) throw new Error("Wallet service not initialized");
      const wallet = await walletService.getOrCreateWallet(userId);
      return {
        walletId: wallet.id,
        userId: wallet.user_id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        state: wallet.state,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch wallet");
    }
  });

  app.post(
    "/wallet/deposit",
    {
      schema: {
        body: {
          type: "object",
          required: ["amount", "idempotencyKey"],
          properties: {
            amount: { type: "number", minimum: 100 },
            currency: { type: "string", default: "USD" },
            idempotencyKey: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        if (!walletService) throw new Error("Wallet service not initialized");
        const parsed = validate(depositSchema, request.body);
        if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
        const { amount, currency = "USD", idempotencyKey } = parsed.data;
        const result = await walletService.deposit(userId, currency, amount, idempotencyKey);
        Analytics.get().trackDeposit(userId, amount, currency);
        incMetric("deposits_total");
        broadcastUser(userId, "wallet_update", { balance: result.balance, currency });
        return reply.send({
          success: true,
          walletId: result.walletId,
          balance: result.balance,
          entryId: result.entryId,
          idempotencyKey,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        if (err instanceof InvalidAmountError) {
          return reply.code(400).send({ error: "invalid_amount", message: err.message });
        }
        if (err instanceof WalletClosedError) {
          return reply.code(400).send({ error: "wallet_closed", message: err.message });
        }
        if (err instanceof WalletFrozenError) {
          return reply.code(400).send({ error: "wallet_frozen", message: err.message });
        }
        app.log.error(err);
        return reply.internalServerError("Deposit failed");
      }
    }
  );

  app.get("/wallet/ledger", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      const query = request.query as { limit?: string; offset?: string };
      if (!walletService) throw new Error("Wallet service not initialized");
      const entries = await walletService.getLedger(
        userId,
        parseInt(query.limit || "50", 10),
        parseInt(query.offset || "0", 10)
      );
      return {
      entries: entries.map((r: any) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balance_after,
        currency: r.currency,
        description: r.description,
        referenceId: r.reference_id,
        createdAt: r.created_at,
      })),
    };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      return reply.internalServerError("Failed to fetch ledger");
    }
  });

  app.post(
    "/wallet/withdraw",
    {
      schema: {
        body: {
          type: "object",
          required: ["amount", "idempotencyKey", "destination"],
          properties: {
            amount: { type: "number", minimum: 100 },
            currency: { type: "string", default: "USD" },
            idempotencyKey: { type: "string" },
            destination: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await getUserId(request);
        if (!walletService) throw new Error("Wallet service not initialized");
        const parsed = validate(withdrawalSchema, request.body);
        if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
        const { amount, currency = "USD", idempotencyKey, destination } = parsed.data;

        const walletResult = await app.pg.query(
          "SELECT id, balance, state, currency FROM wallets WHERE user_id = $1 AND currency = $2",
          [userId, currency]
        );
        const wallet = walletResult.rows[0];
        if (!wallet) {
          return reply.code(404).send({ error: "wallet_not_found", message: "Wallet not found" });
        }

        const result = await walletService.withdrawal(
          userId,
          wallet.id as string,
          amount,
          idempotencyKey,
          destination,
          currency
        );

        Analytics.get().trackWithdrawal(userId, amount, currency, destination);
        incMetric("withdrawals_total");
        broadcastUser(userId, "wallet_update", { balance: result.balance, currency });

        return reply.send({
          success: true,
          walletId: result.walletId,
          balance: result.balance,
          entryId: result.entryId,
          idempotencyKey,
          destination,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "Not authenticated") {
          return reply.unauthorized("Not authenticated");
        }
        if (err instanceof WalletClosedError) {
          return reply.code(400).send({ error: "wallet_closed", message: err.message });
        }
        if (err instanceof WalletFrozenError) {
          return reply.code(400).send({ error: "wallet_frozen", message: err.message });
        }
        if (err instanceof InsufficientFundsError) {
          return reply.code(400).send({ error: "insufficient_funds", message: err.message });
        }
        if (err instanceof WalletNotFoundError) {
          return reply.code(404).send({ error: "wallet_not_found", message: err.message });
        }
        app.log.error(err);
        return reply.internalServerError("Withdrawal failed");
      }
    }
  );

  app.post("/wallet/freeze", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!walletService) throw new Error("Wallet service not initialized");
      const result = await walletService.freezeWallet(userId);
      return { walletId: result.walletId, state: result.state };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      if (err instanceof WalletClosedError) {
        return reply.code(400).send({ error: "wallet_closed", message: err.message });
      }
      return reply.internalServerError("Failed to freeze wallet");
    }
  });

  app.post("/wallet/unfreeze", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!walletService) throw new Error("Wallet service not initialized");
      const result = await walletService.unfreezeWallet(userId);
      return { walletId: result.walletId, state: result.state };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      if (err instanceof WalletClosedError) {
        return reply.code(400).send({ error: "wallet_closed", message: err.message });
      }
      return reply.internalServerError("Failed to unfreeze wallet");
    }
  });

  app.post("/wallet/close", async (request, reply) => {
    try {
      const userId = await getUserId(request);
      if (!walletService) throw new Error("Wallet service not initialized");
      const result = await walletService.closeWallet(userId);
      return { walletId: result.walletId, state: result.state };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Not authenticated") {
        return reply.unauthorized("Not authenticated");
      }
      app.log.error(err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.code(400).send({ error: "cannot_close", message });
    }
  });

  app.get("/admin/wallets/:id", async (request, reply) => {
    try {
      const user = request.user as { id: string; email: string; role: string } | undefined;
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
      }
      if (!walletService) throw new Error("Wallet service not initialized");
      const walletId = (request.params as { id: string }).id;
      const result = await app.pg.query(
        `SELECT w.*, u.email as user_email 
         FROM wallets w 
         JOIN users u ON u.id = w.user_id 
         WHERE w.id = $1`,
        [walletId]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "not_found", message: "Wallet not found" });
      }
      return result.rows[0];
    } catch (err: unknown) {
      app.log.error(err);
      return reply.internalServerError("Failed to fetch wallet");
    }
  });

  app.get("/admin/wallets", async (request, reply) => {
    try {
      const user = request.user as { id: string; email: string; role: string } | undefined;
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
      }
      const query = request.query as { limit?: string; offset?: string; state?: string };
      const limit = Math.min(parseInt(query.limit || "50", 10), 100);
      const offset = parseInt(query.offset || "0", 10);

      let sql = `SELECT w.*, u.email as user_email FROM wallets w JOIN users u ON u.id = w.user_id`;
      const params: unknown[] = [];
      if (query.state) {
        sql += ` WHERE w.state = $1`;
        params.push(query.state);
      }
      sql += ` ORDER BY w.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await app.pg.query(sql, params);
      return { wallets: result.rows, total: result.rows.length };
    } catch (err: unknown) {
      app.log.error(err);
      return reply.internalServerError("Failed to fetch wallets");
    }
  });

  app.post("/admin/wallets/:id/freeze", async (request, reply) => {
    try {
      const user = request.user as { id: string; email: string; role: string } | undefined;
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
      }
      const walletId = (request.params as { id: string }).id;
      const result = await app.pg.query(
        `UPDATE wallets SET state = 'frozen', updated_at = NOW() WHERE id = $1 RETURNING id, user_id, state, balance`,
        [walletId]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "not_found", message: "Wallet not found" });
      }
      return result.rows[0];
    } catch (err: unknown) {
      app.log.error(err);
      return reply.internalServerError("Failed to freeze wallet");
    }
  });

  app.post("/admin/wallets/:id/unfreeze", async (request, reply) => {
    try {
      const user = request.user as { id: string; email: string; role: string } | undefined;
      if (!user || user.role !== "admin") {
        return reply.code(403).send({ error: "forbidden", message: "Admin access required" });
      }
      const walletId = (request.params as { id: string }).id;
      const result = await app.pg.query(
        `UPDATE wallets SET state = 'active', updated_at = NOW() WHERE id = $1 AND state = 'frozen' RETURNING id, user_id, state, balance`,
        [walletId]
      );
      if (result.rows.length === 0) {
        return reply.code(404).send({ error: "not_found", message: "Wallet not found or not frozen" });
      }
      return result.rows[0];
    } catch (err: unknown) {
      app.log.error(err);
      return reply.internalServerError("Failed to unfreeze wallet");
    }
  });
}
