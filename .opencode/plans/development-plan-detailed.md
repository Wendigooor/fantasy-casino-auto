# Fantasy Casino — Detailed Implementation Plan

**Date:** 2026-04-30  
**Priority:** C1 — Blocking bugs → Phase 2 (Auth) → Phase 4 (Frontend Integration)

---

## Current State Summary

### What works
- ✅ Backend starts (Fastify 5, TypeScript)
- ✅ `GET /health` — health endpoint
- ✅ `GET /games` — game list (no auth required)
- ✅ WalletService: deposit with idempotency, ledger, FOR UPDATE locking
- ✅ GameService: spin with transactional flow, RNG interface
- ✅ PostgreSQL schema (7 tables, indexes, seed games)
- ✅ Frontend: Router, 5 pages, React Query, Layout, dark theme
- ✅ Docker Compose for PostgreSQL + Redis

### What does NOT work (blocking bugs)
- 🔴 JWT not registered — all authenticated endpoints return 401
- 🔴 No login/register endpoints — frontend calls non-existent `/api/v1/auth/*`
- 🔴 `initGameService()` not called — spin falls back to raw DB (no idempotency, no proper ledger)
- 🔴 `.env.example` in JSON format
- 🔴 Duplicate `request.user` declaration
- 🔴 Dead `setTimeout` in games.ts
- 🔴 No bcrypt for passwords

---

## Stage 0: Bug Fixes (B-001 → B-006)

### B-003: Fix `.env.example`

**File:** `product/apps/api/.env.example`

**Before (JSON):**
```json
{
  "POSTGRES_HOST": "localhost",
  "POSTGRES_PORT": 5432,
  ...
}
```

**After (key=value):**
```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=casino
POSTGRES_PASSWORD=casino_dev_password
POSTGRES_DB=fantasy_casino
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-me-in-production-at-least-32-chars
NODE_ENV=development
```

---

### B-006: Add bcrypt to package.json

**File:** `product/apps/api/package.json`

**Add to dependencies:**
```json
"bcrypt": "^5.1.1"
```

---

### B-002, B-004: Fix `index.ts` — remove duplicate user declaration, add JWT

**File:** `product/apps/api/src/index.ts`

**Full new file:**
```typescript
import Fastify, { FastifyInstance } from "fastify";
import { Pool } from "pg";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import pino from "pino";
import { healthHandler } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { walletRoutes, initWalletService } from "./routes/wallet.js";
import { gameRoutes, initGameService } from "./routes/games.js";
import { authRoutes, initAuth } from "./routes/auth.js";

const log = pino({
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty" }
      : undefined,
});

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

declare module "fastify" {
  interface FastifyInstance {
    pg: Pool;
  }
  interface FastifyRequest {
    user: { id: string; email: string; role: string };
  }
}

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: log,
    genReqId: () => crypto.randomUUID().replace(/-/g, "").slice(0, 16),
  });

  app.decorate("pg", pool);

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "fallback-secret-change-me",
    sign: { expiresIn: "15m" },
    cookie: false,
  });

  // Initialize services in dependency order
  initWalletService(pool);
  initAuth(pool);

  // Register routes
  app.get("/health", healthHandler);
  app.register(authRoutes, { prefix: "/api/v1" });
  app.register(userRoutes, { prefix: "/api/v1" });
  app.register(walletRoutes, { prefix: "/api/v1" });

  // Game routes registered separately after wallet service is ready
  setTimeout(() => {
    initGameService(pool, (app as any).__walletService);
    app.register(gameRoutes, { prefix: "/api/v1" });
  }, 100);

  app.get("/api/v1/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
  });

  return app;
}

async function start() {
  const app = await createApp();
  const port = parseInt(process.env.PORT || "3001", 10);
  try {
    await app.listen({ port, host: "0.0.0.0" });
    log.info(`API server listening on http://localhost:${port}`);
  } catch (err) {
    log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { createApp };
```

---

### B-004: Remove duplicate from `users.ts`

**File:** `product/apps/api/src/routes/users.ts`

**After:**
```typescript
import { FastifyInstance } from "fastify";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", async (request, reply) => {
    return { id: request.user.id, email: request.user.email, role: request.user.role };
  });
}
```

(Remove `declare module` — now only in `index.ts`)

---

### B-005: Remove dead setTimeout from `games.ts`

**File:** `product/apps/api/src/routes/games.ts`

**Remove lines 23-28:**
```typescript
// REMOVE THIS BLOCK:
  // Initialize game service (after wallet service is initialized)
  setTimeout(async () => {
    if (!gameService && pool) {
      // Game service needs wallet service - use placeholder
    }
  }, 100);
```

**Import `initGameService` from index.ts and call it from there.**

---

## Stage 1: Phase 2 — Identity and Session Foundation

### 2-001, 2-002, 2-008: Create `auth.ts` — authentication controller

**File:** `product/apps/api/src/routes/auth.ts`

```typescript
import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";

let authPool: Pool | null = null;

export function initAuth(pool: Pool) {
  authPool = pool;
}

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authRoutes(app: FastifyInstance) {
  if (!authPool) throw new Error("Auth pool not initialized");

  app.post(
    "/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      try {
        // Check if user already exists
        const existing = await authPool!.query(
          "SELECT id FROM users WHERE email = $1",
          [email]
        );
        if (existing.rows.length > 0) {
          return reply.code(409).send({ error: "email_already_exists" });
        }

        const passwordHash = await hashPassword(password);

        const result = await authPool!.query(
          `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'player') RETURNING id, email, role`,
          [email, passwordHash]
        );
        const user = result.rows[0];

        // Create default wallet
        await authPool!.query(
          `INSERT INTO wallets (user_id, currency, balance) VALUES ($1, 'USD', 0)`,
          [user.id]
        );

        // Generate JWT
        const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });

        return reply.code(201).send({
          user: { id: user.id, email: user.email, role: user.role },
          token,
        });
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ error: "registration_failed" });
      }
    }
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      try {
        const result = await authPool!.query(
          "SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1",
          [email]
        );

        if (result.rows.length === 0) {
          return reply.code(401).send({ error: "invalid_credentials" });
        }

        const user = result.rows[0];

        if (!user.is_active) {
          return reply.code(403).send({ error: "account_disabled" });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return reply.code(401).send({ error: "invalid_credentials" });
        }

        const token = app.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
        });

        return {
          user: { id: user.id, email: user.email, role: user.role },
          token,
        };
      } catch (err) {
        app.log.error(err);
        return reply.code(500).send({ error: "login_failed" });
      }
    }
  );

  app.post("/auth/refresh", async (request: FastifyRequest, reply) => {
    try {
      const user = request.user;
      const newToken = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return { token: newToken };
    } catch {
      return reply.unauthorized("Not authenticated");
    }
  });

  app.post("/auth/logout", async (request: FastifyRequest, reply) => {
    // Stateless JWT — client just discards token
    return { success: true };
  });
}
```

---

### 2-003, 2-004: Create `auth-middleware.ts` — JWT verification middleware

**File:** `product/apps/api/src/middlewares/auth-middleware.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function verifyAuth(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized("Authentication required");
    }
  };
}

export function verifyAdmin(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAuth(app)(request, reply);
    if ((request as any).user.role !== "admin") {
      return reply.forbidden("Admin access required");
    }
  };
}
```

---

### 2-009: Update `index.ts` to use middleware

**File:** `product/apps/api/src/index.ts` — after route registration add:

```typescript
import { verifyAuth, verifyAdmin } from "./middlewares/auth-middleware.js";

// Protect authenticated routes
app.register(walletRoutes, {
  prefix: "/api/v1",
  preHandler: verifyAuth(app),
});

app.register(userRoutes, {
  prefix: "/api/v1",
  preHandler: verifyAuth(app),
});

// Admin routes would use verifyAdmin(app)
```

---

### 2-005: Update `users.ts` — add admin endpoint

**File:** `product/apps/api/src/routes/users.ts`

```typescript
import { FastifyInstance } from "fastify";
import { verifyAdmin } from "../middlewares/auth-middleware.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/users/me", async (request, reply) => {
    return {
      id: request.user.id,
      email: request.user.email,
      role: request.user.role,
    };
  });

  app.get(
    "/users",
    { preHandler: verifyAdmin(app) },
    async (request, reply) => {
      const result = await app.pg.query(
        "SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
      );
      return result.rows;
    }
  );
}
```

---

## Stage 2: Phase 4 — Game + Frontend Integration

### 4-001, 4-002: Fix `games.ts`

**File:** `product/apps/api/src/routes/games.ts` — replace entire file:

```typescript
import { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { GameService } from "../services/game.js";

let gameService: GameService | null = null;

export function initGameService(pool: Pool, walletService: any) {
  gameService = new GameService(pool, walletService);
}

export async function gameRoutes(app: FastifyInstance) {
  app.get("/games", async () => {
    if (!gameService) throw new Error("Game service not initialized");
    return gameService.listGames();
  });

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
          },
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      try {
        if (!gameService) {
          return reply.code(503).send({ error: "game_service_unavailable" });
        }
        const user = request.user;
        const { betAmount, currency = "USD", idempotencyKey } = request.body as {
          betAmount: number;
          currency: string;
          idempotencyKey: string;
        };

        // Get wallet
        const walletResult = await app.pg.query(
          "SELECT id, balance, currency FROM wallets WHERE user_id = $1 AND currency = $2",
          [user.id, currency]
        );
        const wallet = walletResult.rows[0];
        if (!wallet) {
          return reply.code(404).send({ error: "wallet_not_found" });
        }

        const result = await gameService.spin(
          user.id,
          wallet.id as string,
          "slot-basic",
          betAmount,
          idempotencyKey
        );
        return result;
      } catch (err) {
        app.log.error(err);
        if ((err as Error).message?.includes("Insufficient")) {
          return reply.code(400).send({
            error: "insufficient_funds",
            message: (err as Error).message,
          });
        }
        return reply.code(500).send({ error: "spin_failed" });
      }
    }
  );

  app.get("/games/history", async (request: FastifyRequest, reply) => {
    try {
      if (!gameService) {
        return reply.code(503).send({ error: "game_service_unavailable" });
      }
      const user = request.user;
      const query = request.query as { limit?: string; offset?: string };
      const rounds = await gameService.getRoundHistory(
        user.id,
        parseInt(query.limit || "20", 10),
        parseInt(query.offset || "0", 10)
      );
      return { rounds };
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: "history_failed" });
    }
  });
}
```

---

### 4-004, 4-005, 4-007, 4-008: Update frontend

**File:** `product/apps/web/src/pages/LoginPage.tsx` — add axios interceptor:

```typescript
// In LoginPage.tsx — update handleSubmit:
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setMessage(null);
  try {
    const endpoint = isRegistering ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Request failed");
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    setMessage(isRegistering ? "Registered successfully!" : "Logged in!");
    // Redirect after success
    setTimeout(() => window.location.href = "/", 1000);
  } catch (err: unknown) {
    setMessage(err instanceof Error ? err.message : "An error occurred");
  }
}
```

**File:** `product/apps/web/src/components/Layout.tsx` — add logout:

```typescript
export function Layout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Fantasy Casino</h1>
        <nav className="app-nav">
          <a href="/" className="nav-link">Lobby</a>
          {token && <a href="/wallet" className="nav-link">Wallet</a>}
          {token && <a href="/health" className="nav-link">Health</a>}
          {token && (
            <button onClick={handleLogout} className="nav-link btn-logout">
              Logout
            </button>
          )}
          {!token && <a href="/login" className="nav-link">Login</a>}
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <span>Fantasy Casino v0.1.0</span>
      </footer>
    </div>
  );
}
```

**File:** `product/apps/web/src/App.tsx` — add redirect to /login:

```typescript
import { Routes, Route, Navigate } from "react-router-dom";

function requireAuth() {
  return localStorage.getItem("token") !== null;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/wallet"
          element={requireAuth() ? <WalletPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/game/:gameId"
          element={requireAuth() ? <GamePage /> : <Navigate to="/login" />}
        />
        <Route path="/health" element={<HealthPage />} />
      </Routes>
    </Layout>
  );
}
```

---

## Stage 3: Phase 5 — Realtime and High-Load

### 5-001: Rate limiting middleware

**File:** `product/apps/api/src/middlewares/rate-limit.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// In-memory rate limiter (replace with Redis for production)
const requestCounts = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30; // per minute

export function rateLimit(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.ip;
    const now = Date.now();
    const timestamps = requestCounts.get(key) || [];

    // Remove old timestamps
    const recent = timestamps.filter((t) => now - t < WINDOW_MS);

    if (recent.length >= MAX_REQUESTS) {
      return reply.status(429).send({
        error: "too_many_requests",
        message: "Rate limit exceeded. Try again later.",
        retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000),
      });
    }

    recent.push(now);
    requestCounts.set(key, recent);
  };
}
```

---

## Stage 4: Tests

### 2-008: API tests for auth

**File:** `product/apps/api/tests/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Pool } from "pg";
import { createApp } from "../src/index";

const testPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

let app: any;
const testEmail = "test-" + Date.now() + "@casino.local";

beforeAll(async () => {
  app = await createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/v1/auth/register", () => {
  it("should register a new user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        password: "SecurePass123!",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.role).toBe("player");
  });

  it("should reject duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "SecurePass123!" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("should reject weak password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: "weak@casino.local", password: "123" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("should login with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "SecurePass123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
  });

  it("should reject invalid password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "WrongPassword!" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should reject unknown email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nonexistent@casino.local", password: "password" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Protected routes", () => {
  it("should return 401 for /wallet without token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/wallet",
    });
    expect(res.statusCode).toBe(401);
  });

  it("should return wallet data with valid token", async () => {
    // Login first
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "SecurePass123!" },
    });
    const { token } = JSON.parse(loginRes.body);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/wallet",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBeDefined();
    expect(body.balance).toBe(0);
    expect(body.currency).toBe("USD");
  });
});
```

---

## File Summary — Create/Modify Files

| File | Action | Task |
|------|--------|------|
| `product/apps/api/.env.example` | Replace content | B-003 |
| `product/apps/api/package.json` | Add bcrypt | B-006 |
| `product/apps/api/src/index.ts` | Overwrite completely | B-002, B-004 |
| `product/apps/api/src/routes/users.ts` | Simplify, remove duplicate | B-004, 2-005 |
| `product/apps/api/src/routes/games.ts` | Overwrite completely | B-005, 4-001, 4-002 |
| `product/apps/api/src/routes/auth.ts` | **CREATE NEW** | 2-001, 2-002, 2-008 |
| `product/apps/api/src/middlewares/auth-middleware.ts` | **CREATE NEW** | 2-003, 2-004 |
| `product/apps/api/src/middlewares/rate-limit.ts` | **CREATE NEW** | 5-001 |
| `product/apps/api/tests/auth.test.ts` | **CREATE NEW** | 2-008 |
| `product/apps/web/src/pages/LoginPage.tsx` | Update handleSubmit | 4-005 |
| `product/apps/web/src/components/Layout.tsx` | Add logout | 4-008 |
| `product/apps/web/src/App.tsx` | Add requireAuth | 4-007 |

---

## Execution Order (step by step)

1. **Step 1:** Update `.env.example` (B-003)
2. **Step 2:** Add bcrypt to package.json (B-006)
3. **Step 3:** Create `auth.ts` (2-001, 2-002)
4. **Step 4:** Create `auth-middleware.ts` (2-003, 2-004)
5. **Step 5:** Update `index.ts` — connect JWT, auth routes, middleware (B-002)
6. **Step 6:** Update `users.ts` — remove duplicate, add admin endpoint (B-004, 2-005, 2-009)
7. **Step 7:** Update `games.ts` — remove dead code, use service (B-005, 4-001, 4-002)
8. **Step 8:** Update frontend — LoginPage, Layout, App (4-004, 4-005, 4-007, 4-008)
9. **Step 9:** Write auth tests (2-008)
10. **Step 10:** Run `npm install`, `npm run db:migrate`, `npm run test`

---

## What Will Work After Completion

- [x] User registration with automatic wallet creation
- [x] Login with password validation (bcrypt, salt round 12)
- [x] JWT token (15 min, access token)
- [x] Refresh token endpoint
- [x] Logout (stateless — client discards token)
- [x] All endpoints require auth (except health, register, login)
- [x] Admin-only endpoint `/users`
- [x] Spin through GameService (not fallback)
- [x] Idempotent deposit and spin
- [x] Append-only ledger entries
- [x] Frontend: login → redirect → lobby → wallet → game
- [x] Frontend: logout → redirect to /login
- [x] Frontend: redirect to /login if no token
