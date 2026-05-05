import { describe, it, expect, afterAll } from "vitest";
import { createTestPool, createTestUser, createTestWallet, cleanupTestData } from "../src/index.js";
import { randomUUID } from "crypto";

const pool = createTestPool();
const testUserId = randomUUID();

afterAll(async () => {
  await pool.end();
});

describe("Test Utilities — Factories", () => {
  it("should create a test user", async () => {
    const user = await createTestUser(pool, { id: testUserId });
    expect(user.id).toBe(testUserId);
    expect(user.email).toContain("@example.com");
    expect(user.role).toBe("player");
  });

  it("should create a test wallet", async () => {
    const wallet = await createTestWallet(pool, testUserId);
    expect(wallet.user_id).toBe(testUserId);
    expect(wallet.currency).toBe("USD");
    expect(wallet.state).toBe("active");
  });

  it("should create a wallet with custom overrides", async () => {
    const user2 = randomUUID();
    await createTestUser(pool, { id: user2 });

    const wallet = await createTestWallet(pool, user2, {
      currency: "EUR",
      balance: 50000,
      state: "frozen",
    });
    expect(wallet.currency).toBe("EUR");
    expect(wallet.state).toBe("frozen");

    await cleanupTestData(pool, user2);
  });

  it("should cleanup test data", async () => {
    await cleanupTestData(pool, testUserId);

    const result = await pool.query(
      "SELECT 1 FROM users WHERE id = $1",
      [testUserId]
    );
    expect(result.rows.length).toBe(0);
  });
});
