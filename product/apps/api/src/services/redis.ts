import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    redis.on("error", () => {});
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();
  try {
    await r.connect();
    console.log("Redis connected");
  } catch {
    console.warn("Redis unavailable — running without cache");
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
