import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, types } from "pg";
import { GameService } from "../src/services/game.js";
import { WalletService } from "../src/services/wallet.js";
import { DeterministicRNG } from "../src/services/rng.js";
import { ProviderRegistry, InternalSlotProvider } from "../src/services/provider.js";
import { randomUUID } from "crypto";

types.setTypeParser(20, (val: string) => Number(val));

const testPool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "casino",
  password: process.env.POSTGRES_PASSWORD || "casino_dev_password",
  database: process.env.POSTGRES_DB || "fantasy_casino",
});

let gameService: GameService;
let walletService: WalletService;
let registry: ProviderRegistry;
let testUserId: string;
let walletId: string;

beforeAll(async () => {
  registry = new ProviderRegistry();
  registry.register(new InternalSlotProvider());
  walletService = new WalletService(testPool);
  gameService = new GameService(testPool, walletService, registry);
  testUserId = randomUUID();

  // Create test user (required by FK constraints)
  await testPool.query(
    "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'player') ON CONFLICT (id) DO NOTHING",
    [testUserId, `test-${testUserId}@example.com`, "$2b$12$dummyhash"]
  );

  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
});

beforeEach(async () => {
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
});

afterAll(async () => {
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM game_rounds WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  await testPool.end();
});

describe("GameService — Spin Flow", () => {
  it("should successfully execute a spin", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "spin-deposit");

    const result = await gameService.spin(
      testUserId,
      walletId,
      "slot-basic",
      100,
      "spin-test-001"
    );

    expect(result).toBeDefined();
    expect(result.roundId).toBeDefined();
    expect(result.gameId).toBe("slot-basic");
    expect(result.betAmount).toBe(100);
    expect(result.state).toBe("settled");
    expect(result.reels).toHaveLength(5);
    expect(result.currency).toBe("USD");
  });

  it("should debit wallet balance on spin", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "spin-deposit-2");

    await gameService.spin(testUserId, walletId, "slot-basic", 300, "spin-test-002");

    const balance = await testPool.query(
      "SELECT balance FROM wallets WHERE id = $1",
      [walletId]
    );
    // After bet of 300, balance = 5000 - 300 (+ possible win)
    // Win multiplier max ~10x → max win = 3000 → max balance = 7700
    const finalBalance = Number(balance.rows[0]?.balance);
    expect(finalBalance).toBeLessThanOrEqual(8000);
    expect(finalBalance).toBeGreaterThanOrEqual(4700);
  });

  it("should be idempotent", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "spin-deposit-3");

    const result1 = await gameService.spin(testUserId, walletId, "slot-basic", 200, "spin-idem-001");
    const result2 = await gameService.spin(testUserId, walletId, "slot-basic", 200, "spin-idem-001");

    expect(result1.roundId).toBe(result2.roundId);
    expect(result1.betAmount).toBe(result2.betAmount);
    expect(result1.winAmount).toBe(result2.winAmount);
  });

  it("should record round in game_rounds table", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "spin-deposit-4");

    await gameService.spin(testUserId, walletId, "slot-basic", 500, "spin-test-004");

    const rounds = await testPool.query(
      "SELECT * FROM game_rounds WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [testUserId]
    );
    expect(rounds.rows.length).toBe(1);
    const round = rounds.rows[0];
    expect(round.game_id).toBe("slot-basic");
    expect(round.state).toBe("settled");
    expect(Number(round.bet_amount)).toBe(500);
  });

  it("should reject spin with insufficient balance", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;

    await expect(
      gameService.spin(testUserId, walletId, "slot-basic", 999999, "spin-insufficient")
    ).rejects.toThrow(/insufficient/i);
  });

  it("should produce deterministic results with seeded RNG", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "spin-rng");

    // Use deterministic RNG with fixed seed
    gameService.setRNG(new DeterministicRNG(12345));

    const result1 = await gameService.spin(testUserId, walletId, "slot-basic", 100, "spin-rng-001");
    // Reset RNG for reproducibility
    gameService.setRNG(new DeterministicRNG(12345));
    const result2 = await gameService.spin(testUserId, walletId, "slot-basic", 100, "spin-rng-002");

    // Same seed should produce same reels
    expect(result1.reels).toEqual(result2.reels);
    expect(result1.winAmount).toBe(result2.winAmount);
  });

  it("should support provider swap with mock provider", async () => {
    const originalProvider = registry.get("internal");

    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "spin-mock-swap");

    const mockProvider = {
      id: "internal",
      name: "Mock Provider",
      spin: async (_uid: string, _wid: string, _gid: string, _bet: number, _currency: string) => ({
        roundId: "",
        reels: [6, 6, 6, 6, 6],
        winAmount: 1000,
      }),
    };
    registry.register(mockProvider);

    const result = await gameService.spin(testUserId, walletId, "slot-basic", 100, "spin-mock-swap-001");
    expect(result.reels).toEqual([6, 6, 6, 6, 6]);
    expect(result.winAmount).toBe(1000);

    if (originalProvider) {
      registry.register(originalProvider);
    }
  });

  it("should return history", async () => {
    const entries = await testPool.query(
      "SELECT COUNT(*)::int as count FROM game_rounds WHERE user_id = $1",
      [testUserId]
    );
    expect(parseInt(entries.rows[0].count, 10)).toBeGreaterThanOrEqual(0);

    const history = await gameService.getRoundHistory(testUserId, 10, 0);
    expect(Array.isArray(history)).toBe(true);
  });
});
