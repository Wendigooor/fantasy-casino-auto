import Fastify, { FastifyInstance } from "fastify";
import { Pool, types } from "pg";
import cors from "@fastify/cors";

// Parse BIGINT as number globally
types.setTypeParser(20, (val: string) => Number(val));
import sensible from "@fastify/sensible";
import fastifyJwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { healthHandler } from "./routes/health.js";

import { walletRoutes, initWalletService } from "./routes/wallet.js";
import { gameRoutes, initGameService } from "./routes/games.js";
import { userRoutes } from "./routes/users.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { authRoutes } from "./routes/auth.js";
import { bonusRoutes, initBonusService } from "./routes/bonus.js";
import { riskRoutes, initRiskService } from "./routes/risk-routes.js";
import { eventRoutes, initEventService } from "./routes/event-routes.js";
import { kycRoutes, initKycService } from "./routes/kyc.js";
import { analyticsRoutes } from "./routes/analytics-routes.js";
import { sseRoutes } from "./routes/sse.js";
import { metricsRoutes, incMetric, recordLatency } from "./routes/metrics.js";
import { authMiddleware } from "./middlewares/auth-middleware.js";
import { redisRateLimit } from "./middlewares/redis-rate-limit.js";
import { connectRedis, closeRedis } from "./services/redis.js";
import { WalletService } from "./services/wallet.js";
import { BonusRuleEngine } from "./services/bonus.js";
import { ProviderRegistry, InternalSlotProvider } from "./services/provider.js";
import { Analytics } from "./services/analytics.js";
import { DuelService } from "./services/duel.js";
import { duelRoutes, initDuelService } from "./routes/duel-routes.js";
import { leaderboardRoutes } from "./routes/leaderboard-routes.js";
import { achievementRoutes } from "./routes/achievement-routes.js";
import { lightningRoutes } from "./routes/lightning-routes.js";
import { missionRoutes } from "./routes/mission-routes.js";
import { tournamentRoutes } from "./routes/tournament-routes.js";
import { reconciliationRoutes } from "./routes/reconciliation-routes.js";
import { idempotencyRoutes } from "./routes/idempotency-routes.js";
import { comboRoutes } from "./routes/combo.js";
import { GameService } from "./services/game.js";

const isTest = process.env.NODE_ENV === "test";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && !isTest) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string };
    user: { id: string; email: string; role: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    pg: Pool;
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

async function protectedRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate as any);

  await userRoutes(app);
  await walletRoutes(app);
  await gameRoutes(app);
  await bonusRoutes(app);
  await riskRoutes(app);
  await eventRoutes(app);
  await kycRoutes(app);
  await analyticsRoutes(app);
  await sseRoutes(app);
  await duelRoutes(app);
  await leaderboardRoutes(app);
  await achievementRoutes(app);
  await lightningRoutes(app);
  await missionRoutes(app);
  await tournamentRoutes(app);
  await reconciliationRoutes(app);
  await idempotencyRoutes(app);
  await comboRoutes(app);
}

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isTest
      ? { level: "silent" }
      : {
          level: "info",
          serializers: {
            req: (req) => {
              const headers = { ...req.headers };
              delete headers.authorization;
              delete headers.cookie;
              return { method: req.method, url: req.url, headers };
            },
          },
        },
    genReqId: () => crypto.randomUUID().replace(/-/g, "").slice(0, 16),
  });

  app.decorate("pg", pool);

  // Security headers
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'");
  });
  app.addHook("onResponse", async (_request, reply) => {
    recordLatency(reply.elapsedTime);
    if (reply.statusCode >= 500) incMetric("errors_total");
  });

  await app.register(cors, {
    origin: isTest ? true : process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Fantasy Casino API",
        description: "Production-grade fantasy casino platform API",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3001" }],
    },
  });
  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });
  await app.register(fastifyJwt, {
    secret: JWT_SECRET || "test-secret-do-not-use-in-production",
    sign: { expiresIn: "1h", algorithm: "HS256" },
    verify: { algorithms: ["HS256"] },
  });

  await authMiddleware(app);

  // Redis-backed rate limiting (skip in test mode — no Redis available)
  if (!isTest) {
    await redisRateLimit(app);
  }

  app.get("/health", healthHandler);

  // Metrics endpoint
  await metricsRoutes(app);

  // Initialize services
  const walletService = new WalletService(pool);
  const bonusService = new BonusRuleEngine(pool);
  const registry = new ProviderRegistry();
  registry.register(new InternalSlotProvider());

  initWalletService(pool);
  initGameService(pool, walletService, registry, bonusService);
  initDuelService(new DuelService(pool), new GameService(pool, walletService, registry));
  initBonusService(pool, walletService);
  initKycService(pool);
  initRiskService(pool);
  initEventService(pool);
  new Analytics(pool);

  // Public: game catalog (no auth)
  app.get("/api/v1/games", async (request) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    const result = await pool.query(
      `SELECT id, name, type, min_bet, max_bet, provider
       FROM games WHERE is_active = true AND type != 'bonus'
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      games: result.rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        minBet: Number(row.min_bet),
        maxBet: Number(row.max_bet),
        provider: row.provider,
      })),
    };
  });

  app.register(authRoutes, { prefix: "/api/v1" });
  app.register(dashboardRoutes, { prefix: "/api/v1" });
  app.register(protectedRoutes, { prefix: "/api/v1" });

  app.get("/api/v1/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  process.on("SIGINT", async () => {
    await closeRedis();
    await pool.end();
    process.exit(0);
  });

  return app;
}

async function start() {
  await connectRedis();
  const app = await createApp();
  const port = parseInt(process.env.PORT || "3001", 10);
  try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`API server listening on http://localhost:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
