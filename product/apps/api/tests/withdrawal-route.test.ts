import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, types } from "pg";
import { createApp } from "../src/index.js";
import type { FastifyInstance } from "fastify";

types.setTypeParser(20, (val: string) => Number(val));

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

let app: FastifyInstance | null = null;
let testEmail: string;
let testPassword = "WithdrawTest123!";

beforeAll(async () => {
  app = await createApp();
  await app.ready();
  testEmail = `wd-route-${Date.now()}@example.com`;
});

afterAll(async () => {
  if (app) {
    const registerRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: testPassword },
    });
    if (registerRes.statusCode === 201) {
      const token = JSON.parse(registerRes.body).token;
      // Clean up test data
      await pool.query("DELETE FROM ledger_entries WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [testEmail]);
      await pool.query("DELETE FROM idempotency_keys WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [testEmail]);
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email = $1)", [testEmail]);
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    }
    await app.close();
    await pool.end();
  }
});

describe("Withdrawal Route (integration)", () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const registerRes = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: testPassword },
    });
    expect(registerRes.statusCode).toBe(201);
    const body = JSON.parse(registerRes.body);
    token = body.token;
    userId = body.user.id;

    // Deposit initial balance
    await app!.inject({
      method: "POST",
      url: "/api/v1/wallet/deposit",
      headers: { Authorization: `Bearer ${token}` },
      payload: { amount: 5000, currency: "USD", idempotencyKey: `wd-route-dep-${Date.now()}` },
    });
  });

  it("should withdraw and decrease balance", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 1000,
        currency: "USD",
        idempotencyKey: `wd-route-${Date.now()}`,
        destination: "bank-456",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.balance).toBeGreaterThan(0);
    expect(body.balance).toBeLessThan(105000);
    expect(body.destination).toBe("bank-456");
  });

  it("should reject withdrawal with missing fields", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { Authorization: `Bearer ${token}` },
      payload: { amount: 100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("should reject withdrawal exceeding balance", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/wallet/withdraw",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        amount: 999999,
        currency: "USD",
        idempotencyKey: `wd-over-${Date.now()}`,
        destination: "bank-789",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("should have X-Request-ID header", async () => {
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
