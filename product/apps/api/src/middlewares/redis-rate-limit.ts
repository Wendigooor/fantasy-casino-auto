import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getRedis } from "../services/redis.js";

const memStore = new Map<string, { count: number; resetAt: number }>();

function memRateLimit(key: string, maxRequests: number, windowSeconds: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export async function redisRateLimit(app: FastifyInstance) {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
  const windowSeconds = 60;

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    let key: string;
    if (request.url.startsWith("/api/v1/auth/")) {
      key = `ratelimit:auth:${request.ip}`;
    } else if ((request as any).user?.id) {
      key = `ratelimit:user:${(request as any).user.id}`;
    } else {
      key = `ratelimit:ip:${request.ip}`;
    }

    try {
      const redis = getRedis();
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, windowSeconds);
      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        reply.header("Retry-After", ttl);
        return reply.status(429).send({ error: "Too Many Requests", retryAfter: ttl });
      }
    } catch {
      // Redis unavailable — fall back to in-memory rate limiter
      const result = memRateLimit(key, maxRequests, windowSeconds);
      if (!result.allowed) {
        reply.header("Retry-After", result.retryAfter || 60);
        return reply.status(429).send({ error: "Too Many Requests", retryAfter: result.retryAfter });
      }
    }
  });
}
