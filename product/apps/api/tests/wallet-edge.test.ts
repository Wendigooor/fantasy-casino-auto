import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, types } from "pg";
import { WalletService, InvalidAmountError } from "../src/services/wallet.js";
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

describe("WalletService — Edge Cases", () => {
  describe("deposit validation", () => {
    it("should reject zero deposit", async () => {
      await expect(
        walletService.deposit(testUserId, "USD", 0, "dep-zero")
      ).rejects.toThrow(InvalidAmountError);
    });

    it("should reject negative deposit", async () => {
      await expect(
        walletService.deposit(testUserId, "USD", -100, "dep-neg")
      ).rejects.toThrow(InvalidAmountError);
    });

    it("should accept minimum deposit of 1 cent", async () => {
      const result = await walletService.deposit(testUserId, "USD", 1, "dep-min");
      expect(result.balance).toBe(1);
    });
  });

  describe("withdrawal validation", () => {
    it("should reject zero withdrawal", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.deposit(testUserId, "USD", 1000, "wd-setup-zero");
      await expect(
        walletService.withdrawal(testUserId, wallet.id, 0, "wd-zero", "bank", "USD")
      ).rejects.toThrow(InvalidAmountError);
    });

    it("should reject negative withdrawal", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.deposit(testUserId, "USD", 1000, "wd-setup-neg");
      await expect(
        walletService.withdrawal(testUserId, wallet.id, -100, "wd-neg", "bank", "USD")
      ).rejects.toThrow(InvalidAmountError);
    });
  });

  describe("concurrent safety", () => {
    it("should handle multiple concurrent deposits", async () => {
      const results = await Promise.all([
        walletService.deposit(testUserId, "USD", 100, "con-001"),
        walletService.deposit(testUserId, "USD", 200, "con-002"),
        walletService.deposit(testUserId, "USD", 300, "con-003"),
      ]);
      expect(results).toHaveLength(3);
      const balance = await walletService.getBalance(testUserId, "USD");
      expect(balance).toBe(600);
    });

    it("should handle concurrent deposit and withdrawal", async () => {
      await walletService.deposit(testUserId, "USD", 10000, "con-setup");
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");

      await Promise.all([
        walletService.deposit(testUserId, "USD", 500, "con-mixed-001"),
        walletService.withdrawal(testUserId, wallet.id, 300, "con-mixed-002", "bank", "USD"),
      ]);

      const balance = await walletService.getBalance(testUserId, "USD");
      expect(balance).toBe(10200);
    });
  });

  describe("wallet state transitions", () => {
    it("should reject deposit to frozen wallet", async () => {
      await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.freezeWallet(testUserId);
      await expect(
        walletService.deposit(testUserId, "USD", 100, "dep-frozen")
      ).rejects.toThrow(/frozen/i);
    });
  });
});
