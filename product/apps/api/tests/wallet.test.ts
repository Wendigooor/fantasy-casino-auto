import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, types } from "pg";
import { WalletService } from "../src/services/wallet.js";
import { randomUUID } from "crypto";

types.setTypeParser(20, (val: string) => Number(val));

const testPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

let walletService: WalletService;
let testUserId: string;

beforeAll(async () => {
  walletService = new WalletService(testPool);
  testUserId = randomUUID();

  // Create test user for FK constraints
  await testPool.query(
    "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'player') ON CONFLICT (id) DO NOTHING",
    [testUserId, `test-${testUserId}@example.com`, "$2b$12$dummyhash"]
  );

  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
});

beforeEach(async () => {
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
});

afterAll(async () => {
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  await testPool.end();
});

describe("WalletService", () => {
  describe("getOrCreateWallet", () => {
    it("should create a new wallet for a user", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      expect(wallet).toBeDefined();
      expect(wallet.user_id).toBe(testUserId);
      expect(wallet.currency).toBe("USD");
      expect(wallet.balance).toBe(0);
    });

    it("should return existing wallet", async () => {
      const wallet1 = await walletService.getOrCreateWallet(testUserId, "USD");
      const wallet2 = await walletService.getOrCreateWallet(testUserId, "USD");
      expect(wallet1.id).toBe(wallet2.id);
    });
  });

  describe("deposit", () => {
    it("should create a ledger entry and update balance", async () => {
      const result = await walletService.deposit(testUserId, "USD", 1000, "dep-001");
      expect(result).toBeDefined();
      expect(result.balance).toBe(1000);
      expect(result.entryId).toBeDefined();
      expect(result.entryId.length).toBeGreaterThan(0);
    });

    it("should return same result for repeated idempotency key", async () => {
      const result1 = await walletService.deposit(testUserId, "USD", 500, "dep-002");
      const result2 = await walletService.deposit(testUserId, "USD", 500, "dep-002");
      expect(result1.balance).toBe(result2.balance);
      expect(result1.entryId).toBe(result2.entryId);
    });

    it("should allow different idempotency keys", async () => {
      const r1 = await walletService.deposit(testUserId, "USD", 200, "dep-003a");
      const r2 = await walletService.deposit(testUserId, "USD", 300, "dep-003b");
      expect(r1.entryId).toBeDefined();
      expect(r2.entryId).toBeDefined();
      expect(r1.entryId).not.toBe(r2.entryId);
      expect(r2.balance).toBeGreaterThan(r1.balance);
    });

    it("should accumulate deposits correctly", async () => {
      await walletService.deposit(testUserId, "USD", 100, "dep-acc-001");
      await walletService.deposit(testUserId, "USD", 200, "dep-acc-002");
      await walletService.deposit(testUserId, "USD", 300, "dep-acc-003");
      const balance = await walletService.getBalance(testUserId, "USD");
      expect(balance).toBe(600);
    });
  });

  describe("getLedger", () => {
    it("should return ledger entries", async () => {
      await walletService.deposit(testUserId, "USD", 100, "dep-ledger-001");
      const entries = await walletService.getLedger(testUserId);
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it("should return entries in descending order", async () => {
      await walletService.deposit(testUserId, "USD", 100, "dep-order-001");
      await walletService.deposit(testUserId, "USD", 200, "dep-order-002");
      await walletService.deposit(testUserId, "USD", 300, "dep-order-003");
      const entries = await walletService.getLedger(testUserId);
      if (entries.length >= 2) {
        expect(new Date(entries[0].created_at).getTime()).toBeGreaterThanOrEqual(
          new Date(entries[1].created_at).getTime()
        );
      }
    });
  });
});
