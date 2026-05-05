export function getEnv(key: string, fallback: string = ""): string {
  return process.env[key] || fallback;
}

export function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const num = parseInt(val, 10);
  return isNaN(num) ? fallback : num;
}

export function getEnvBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

export const config = {
  db: {
    host: getEnv("POSTGRES_HOST", "localhost"),
    port: getEnvInt("POSTGRES_PORT", 5432),
    user: getEnv("POSTGRES_USER", "casino"),
    password: getEnv("POSTGRES_PASSWORD", "casino_dev_password"),
    database: getEnv("POSTGRES_DB", "fantasy_casino"),
  },
  redis: {
    host: getEnv("REDIS_HOST", "localhost"),
    port: getEnvInt("REDIS_PORT", 6379),
  },
  api: {
    port: getEnvInt("PORT", 3001),
    jwtSecret: getEnv("JWT_SECRET", "fallback-secret-change-in-production"),
    corsOrigin: getEnv("CORS_ORIGIN", "http://localhost:3000"),
    rateLimitMax: getEnvInt("RATE_LIMIT_MAX", 60),
  },
  isTest: process.env.NODE_ENV === "test",
  isProduction: process.env.NODE_ENV === "production",
} as const;
