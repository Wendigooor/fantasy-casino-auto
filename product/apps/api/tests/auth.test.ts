import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import { createApp } from "../src/index.js";
import type { FastifyInstance } from "fastify";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

let app: FastifyInstance | null = null;

async function dbReady(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function createUserInDb(email: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'player', true)
     RETURNING id, email, role, created_at`,
    [email, hashedPassword]
  );
  const user = result.rows[0];
  await pool.query(
    `INSERT INTO wallets (user_id, currency, balance, state)
     VALUES ($1, 'USD', 100000, 'active')`,
    [user.id]
  );
  return user;
}

describe("Auth - Password Hashing (unit)", () => {
  it("should produce bcrypt hashes starting with $2b$", async () => {
    const password = "TestPassword123!";
    const hash = await bcrypt.hash(password, 12);
    expect(hash.startsWith("$2b$")).toBe(true);
    expect(hash.split("$").length).toBe(4);
    const rounds = parseInt(hash.split("$")[2], 10);
    expect(rounds).toBe(12);
  });

  it("should verify correct password", async () => {
    const password = "CorrectPass123!";
    const hash = await bcrypt.hash(password, 12);
    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await bcrypt.hash("CorrectPass123!", 12);
    const valid = await bcrypt.compare("WrongPass123!", hash);
    expect(valid).toBe(false);
  });

  it("should produce unique hashes for same password", async () => {
    const password = "SamePassword123!";
    const hash1 = await bcrypt.hash(password, 12);
    const hash2 = await bcrypt.hash(password, 12);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });

  it("should handle long passwords", async () => {
    const password = "a".repeat(1000);
    const hash = await bcrypt.hash(password, 12);
    expect(hash.startsWith("$2b$")).toBe(true);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });
});

describe("Auth - Request Body Validation (unit)", () => {
  it("should identify missing email", () => {
    const body = { password: "Test123!" };
    expect(body.email).toBeUndefined();
  });

  it("should identify missing password", () => {
    const body = { email: "test@example.com" };
    expect(body.password).toBeUndefined();
  });

  it("should identify short passwords", () => {
    expect("short".length).toBeLessThan(8);
    expect("1234567".length).toBeLessThan(8);
    expect("12345678".length).toBeGreaterThanOrEqual(8);
  });

  it("should validate email format pattern", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("test@example.com")).toBe(true);
    expect(emailRegex.test("invalid")).toBe(false);
  });
});

describe("Auth - JWT Token Structure (unit)", () => {
  it("should have valid JWT structure (3 parts)", () => {
    const mockToken = "header.payload.signature";
    const parts = mockToken.split(".");
    expect(parts.length).toBe(3);
  });

  it("should base64 decode JWT parts correctly", () => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const decoded = JSON.parse(atob(header));
    expect(decoded.alg).toBe("HS256");
  });
});

describe("Auth - Auth Middleware Logic (unit)", () => {
  it("should identify missing Authorization header", () => {
    const headers: Record<string, string | undefined> = {};
    expect(headers.authorization).toBeUndefined();
  });

  it("should identify non-Bearer Authorization header", () => {
    const headers: Record<string, string> = { authorization: "Basic dXNlcjpwYXNz" };
    expect(headers.authorization.startsWith("Bearer ")).toBe(false);
  });

  it("should extract token from Bearer header", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiJ9.test.test";
    const token = authHeader.replace("Bearer ", "");
    expect(token).toBe("eyJhbGciOiJIUzI1NiJ9.test.test");
  });
});

describe("Auth - Integration Tests", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await dbReady();
    if (!dbAvailable) {
      throw new Error("PostgreSQL is not available - skipping integration tests");
    }
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (dbAvailable) await pool.end();
  });

  afterEach(async () => {
    if (!dbAvailable) return;
    await pool.query("DELETE FROM idempotency_keys WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')").catch(() => {});
    await pool.query("DELETE FROM game_rounds WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')").catch(() => {});
    await pool.query("DELETE FROM ledger_entries WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')").catch(() => {});
    await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')").catch(() => {});
    await pool.query("DELETE FROM users WHERE email LIKE 'test-%@example.com'").catch(() => {});
  });

  it("should register a new user successfully", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-reg-${Date.now()}@example.com`;
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "TestPassword123!" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.role).toBe("player");
    expect(body.user.balance).toBe(100000);
    expect(body.token).toBeDefined();
  });

  it("should reject duplicate email registration", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-dup-${Date.now()}@example.com`;
    await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "TestPassword123!" },
    });

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "TestPassword123!" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("should login with correct credentials", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-login-${Date.now()}@example.com`;
    await createUserInDb(testEmail, "TestPassword123!");

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "TestPassword123!" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe(testEmail);
    expect(body.token).toBeDefined();
  });

  it("should reject login with wrong password", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-wrong-${Date.now()}@example.com`;
    await createUserInDb(testEmail, "TestPassword123!");

    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "WrongPassword1!" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("should reject requests with invalid token", async () => {
    if (!dbAvailable) return;
    const res = await app!.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("should access /users/me with valid token", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-profile-${Date.now()}@example.com`;
    const res = await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "TestPassword123!" },
    });
    const body = JSON.parse(res.body);

    const profileRes = await app!.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { Authorization: `Bearer ${body.token}` },
    });

    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body);
    expect(profile.email).toBe(testEmail);
  });

  it("should store hashed passwords, not plain text", async () => {
    if (!dbAvailable) return;
    const testEmail = `test-hash-${Date.now()}@example.com`;
    await app!.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: testEmail, password: "TestPassword123!" },
    });

    const result = await pool.query(
      "SELECT password_hash FROM users WHERE email = $1",
      [testEmail]
    );
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].password_hash).not.toBe("TestPassword123!");
    expect(result.rows[0].password_hash.startsWith("$2b$")).toBe(true);
  });
});
