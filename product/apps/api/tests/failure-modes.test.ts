import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, types } from "pg";
import {
  WalletService,
  WalletNotFoundError,
  InsufficientFundsError,
} from "../src/services/wallet.js";
import { GameService } from "../src/services/game.js";
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
let gameService: GameService;
let testUserId: string;

beforeAll(async () => {
  walletService = new WalletService(testPool);
  gameService = new GameService(testPool, walletService);
  testUserId = randomUUID();

  await testPool.query(
    "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'player') ON CONFLICT (id) DO NOTHING",
    [testUserId, `test-${testUserId}@example.com`, "$2b$12$dummyhash"]
  );

  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
});

beforeEach(async () => {
  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
});

afterAll(async () => {
  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  await testPool.end();
});

describe("Failure Modes", () => {
  describe("duplicate idempotency on withdrawal", () => {
    it("returns identical result and does not double-charge", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.deposit(testUserId, "USD", 5000, "deposit-for-wd-idem");

      const key = "wd-idem-001";
      const result1 = await walletService.withdrawal(
        testUserId,
        wallet.id,
        1000,
        key,
        "bank-account"
      );
      const result2 = await walletService.withdrawal(
        testUserId,
        wallet.id,
        1000,
        key,
        "bank-account"
      );

      expect(result1.entryId).toBe(result2.entryId);
      expect(result1.balance).toBe(result2.balance);

      const balance = await walletService.getBalance(testUserId, "USD");
      expect(balance).toBe(4000);
    });
  });

  describe("concurrent withdrawals", () => {
    it("properly handles balance with Promise.all", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.deposit(testUserId, "USD", 10000, "deposit-for-concurrent");

      const concurrency = 5;
      const amountEach = 2500;

      const promises = Array.from({ length: concurrency }, (_, i) =>
        walletService.withdrawal(
          testUserId,
          wallet.id,
          amountEach,
          `wd-concurrent-${i}`,
          `bank-${i}`
        )
      );

      const results = await Promise.allSettled(promises);

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(succeeded.length).toBe(4);
      expect(failed.length).toBe(1);
      expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        InsufficientFundsError
      );

      const balance = await walletService.getBalance(testUserId, "USD");
      expect(balance).toBe(0);
    });
  });

  describe("spin with non-existent game ID", () => {
    it("returns error for unknown game", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
      await walletService.deposit(testUserId, "USD", 10000, "deposit-for-bad-game");

      await expect(
        gameService.spin(testUserId, wallet.id, "non-existent-game", 100, "spin-bad-game")
      ).rejects.toThrow();
    });
  });

  describe("withdrawal from non-existent wallet", () => {
    it("returns error for unknown wallet", async () => {
      const fakeWalletId = randomUUID();

      await expect(
        walletService.withdrawal(testUserId, fakeWalletId, 100, "wd-no-wallet", "dest")
      ).rejects.toThrow(WalletNotFoundError);
    });
  });

  describe("deposit with extremely large amount", () => {
    it("works with boundary value", async () => {
      const wallet = await walletService.getOrCreateWallet(testUserId, "USD");

      const hugeAmount = 9999999999999;

      const result = await walletService.deposit(
        testUserId,
        "USD",
        hugeAmount,
        "deposit-huge"
      );

      expect(result.balance).toBe(hugeAmount);
      expect(result.entryId).toBeDefined();
      expect(result.walletId).toBeDefined();
      expect(result.balance).toBeGreaterThan(0);
    });
  });
});
