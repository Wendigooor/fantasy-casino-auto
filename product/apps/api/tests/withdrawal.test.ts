import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool, types } from "pg";
import { WalletService, InsufficientFundsError, WalletFrozenError, WalletClosedError } from "../src/services/wallet.js";
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
let walletId: string;

beforeAll(async () => {
  walletService = new WalletService(testPool);
  testUserId = randomUUID();

  await testPool.query(
    "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'player') ON CONFLICT (id) DO NOTHING",
    [testUserId, `test-${testUserId}@example.com`, "$2b$12$dummyhash"]
  );
});

afterAll(async () => {
  await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  await testPool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  await testPool.end();
});

describe("Withdrawal flow", () => {
  beforeEach(async () => {
    await testPool.query("DELETE FROM ledger_entries WHERE user_id = $1", [testUserId]);
    await testPool.query("DELETE FROM idempotency_keys WHERE user_id = $1", [testUserId]);
    await testPool.query("DELETE FROM wallets WHERE user_id = $1", [testUserId]);
  });

  it("should create a ledger entry with type='withdrawal' and decrease balance", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "dep-withdraw-001");

    const result = await walletService.withdrawal(
      testUserId,
      walletId,
      3000,
      "wd-001",
      "bank-account-123",
      "USD"
    );

    expect(result).toBeDefined();
    expect(result.walletId).toBe(walletId);
    expect(result.entryId).toBeDefined();
    expect(result.balance).toBe(7000);

    const entries = await walletService.getLedger(testUserId);
    const withdrawalEntry = entries.find((e) => e.type === "withdrawal");
    expect(withdrawalEntry).toBeDefined();
    expect(withdrawalEntry!.amount).toBe(3000);
    expect(withdrawalEntry!.balance_after).toBe(7000);
    expect(withdrawalEntry!.currency).toBe("USD");
  });

  it("should decrease wallet balance correctly", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "dep-withdraw-002");

    const beforeBalance = await walletService.getBalance(testUserId, "USD");
    expect(beforeBalance).toBe(5000);

    await walletService.withdrawal(testUserId, walletId, 1500, "wd-002", "bank-account-456", "USD");

    const afterBalance = await walletService.getBalance(testUserId, "USD");
    expect(afterBalance).toBe(3500);
  });

  it("should be idempotent — repeated request with same key returns same result", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "dep-withdraw-003");

    const result1 = await walletService.withdrawal(
      testUserId,
      walletId,
      2000,
      "wd-idempotent-001",
      "bank-account-789",
      "USD"
    );

    const result2 = await walletService.withdrawal(
      testUserId,
      walletId,
      2000,
      "wd-idempotent-001",
      "bank-account-789",
      "USD"
    );

    expect(result1.balance).toBe(result2.balance);
    expect(result1.entryId).toBe(result2.entryId);

    const balance = await walletService.getBalance(testUserId, "USD");
    expect(balance).toBe(8000);

    const entries = await walletService.getLedger(testUserId);
    const withdrawals = entries.filter((e) => e.type === "withdrawal");
    expect(withdrawals.length).toBe(1);
  });

  it("should allow multiple withdrawals with different idempotency keys", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 10000, "dep-withdraw-004");

    await walletService.withdrawal(testUserId, walletId, 2000, "wd-multi-001", "bank-1", "USD");
    await walletService.withdrawal(testUserId, walletId, 3000, "wd-multi-002", "bank-2", "USD");

    const balance = await walletService.getBalance(testUserId, "USD");
    expect(balance).toBe(5000);

    const entries = await walletService.getLedger(testUserId);
    const withdrawals = entries.filter((e) => e.type === "withdrawal");
    expect(withdrawals.length).toBe(2);
  });

  it("should throw InsufficientFundsError when balance is insufficient", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 500, "dep-withdraw-005");

    await expect(
      walletService.withdrawal(testUserId, walletId, 1000, "wd-too-much", "bank-1", "USD")
    ).rejects.toThrow(InsufficientFundsError);
  });

  it("should allow withdrawal of exact balance (balance becomes 0)", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 500, "dep-withdraw-006");

    const result = await walletService.withdrawal(testUserId, walletId, 500, "wd-exact", "bank-1", "USD");
    expect(result.balance).toBe(0);

    const balance = await walletService.getBalance(testUserId, "USD");
    expect(balance).toBe(0);
  });

  it("should throw WalletFrozenError when wallet is frozen", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "dep-withdraw-007");
    await walletService.freezeWallet(testUserId);

    await expect(
      walletService.withdrawal(testUserId, walletId, 1000, "wd-frozen", "bank-1", "USD")
    ).rejects.toThrow(WalletFrozenError);
  });

  it("should throw WalletClosedError when wallet is closed", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "dep-withdraw-007a");
    await walletService.withdrawal(testUserId, walletId, 5000, "wd-clean-001", "bank-1", "USD");

    await testPool.query("UPDATE wallets SET state = 'closed' WHERE id = $1", [walletId]);

    await expect(
      walletService.withdrawal(testUserId, walletId, 100, "wd-closed", "bank-1", "USD")
    ).rejects.toThrow(WalletClosedError);
  });

  it("should store correct destination in ledger entry reference_id", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "dep-withdraw-008");

    await walletService.withdrawal(testUserId, walletId, 1000, "wd-dest-001", "crypto-wallet-0xabc", "USD");

    const entries = await walletService.getLedger(testUserId);
    const withdrawalEntry = entries.find((e) => e.type === "withdrawal");
    expect(withdrawalEntry!.reference_id).toBe("crypto-wallet-0xabc");
  });

  it("should handle withdrawal with different currency", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "EUR");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "EUR", 10000, "dep-withdraw-eur");

    const result = await walletService.withdrawal(testUserId, walletId, 2500, "wd-eur-001", "iban-123", "EUR");
    expect(result.balance).toBe(7500);
    expect(result.walletId).toBe(walletId);

    const balance = await walletService.getBalance(testUserId, "EUR");
    expect(balance).toBe(7500);
  });

  it("should record withdrawal with correct description", async () => {
    const wallet = await walletService.getOrCreateWallet(testUserId, "USD");
    walletId = wallet.id;
    await walletService.deposit(testUserId, "USD", 5000, "dep-withdraw-009");

    await walletService.withdrawal(testUserId, walletId, 1000, "wd-desc-001", "bank-account-xyz", "USD");

    const entries = await walletService.getLedger(testUserId);
    const withdrawalEntry = entries.find((e) => e.type === "withdrawal");
    expect(withdrawalEntry!.description).toBe("Withdrawal to bank-account-xyz");
  });
});
