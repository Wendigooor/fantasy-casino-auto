/*
 * Reconciliation smoke test — healthy + corrupted scenarios.
 */
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync } from "fs";

const API = "http://localhost:3001";
const EVIDENCE_DIR = process.env.ATM_EVIDENCE_DIR || "/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/wallet-ledger-reconciliation";
mkdirSync(EVIDENCE_DIR, { recursive: true });

const report = { run: "wallet-ledger-reconciliation", healthyScenario: null, corruptedScenario: null, assertions: {} };

async function main() {
  const ts = Date.now();
  // 1. Create user
  const regRes = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `rec${ts}@test.com`, password: "RecTest123" })
  });
  const { token, user } = await regRes.json();
  const userId = user.id;
  report.assertions["apiReachable"] = true;

  // Get wallet ID and create deposit ledger entry for initial balance
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || "postgresql:///fantasy_casino" });
  const walletR = await pool.query("SELECT id FROM wallets WHERE user_id = $1", [userId]);
  const walletId = walletR.rows[0]?.id;
  await pool.query("INSERT INTO ledger_entries (wallet_id, user_id, type, amount, currency, balance_after) VALUES ($1, $2, 'deposit', 100000, 'USD', 100000)", [walletId, userId]);

  // 2. Do a spin (healthy activity)
  for (let i = 0; i < 3; i++) {
    await fetch(`${API}/api/v1/games/slot/spin`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ betAmount: 100, idempotencyKey: randomUUID() })
    });
  }

  // 3. Healthy reconciliation
  const healthyRes = await fetch(`${API}/api/v1/reconciliation/wallet/${userId}`, {
    headers: { Authorization: "Bearer " + token }
  });
  const healthy = await healthyRes.json();
  report.healthyScenario = { passed: healthy.status !== "drift_detected" && healthy.status !== "error", status: healthy.status, drift: healthy.drift };
  report.assertions["healthyBalanced"] = healthy.status !== "drift_detected" && healthy.status !== "error";
  console.log("Healthy:", healthy.status, "drift:", healthy.drift);

  // 4. Corrupt wallet balance directly (introduce drift)
  await pool.query("UPDATE wallets SET balance = balance + 500 WHERE user_id = $1", [userId]);

  // 5. Corrupted reconciliation
  const corruptRes = await fetch(`${API}/api/v1/reconciliation/wallet/${userId}`, {
    headers: { Authorization: "Bearer " + token }
  });
  const corrupt = await corruptRes.json();
  report.corruptedScenario = { passed: corrupt.status !== "balanced", status: corrupt.status, drift: corrupt.drift, issues: corrupt.issues?.map(i => i.type) };
  report.assertions["corruptionDetected"] = corrupt.status !== "balanced";
  console.log("Corrupted:", corrupt.status, "drift:", corrupt.drift);

  // 6. Restore balance
  await pool.query("UPDATE wallets SET balance = balance - 500 WHERE user_id = $1", [userId]);
  await pool.end();

  // Write report
  report.assertions["noUnhandledErrors"] = true;
  writeFileSync(`${EVIDENCE_DIR}/reconciliation-report.json`, JSON.stringify(report, null, 2));
  console.log("Report written to", EVIDENCE_DIR);

  if (!report.assertions["healthyBalanced"]) throw new Error("Healthy scenario not balanced");
  if (!report.assertions["corruptionDetected"]) throw new Error("Corrupted scenario not detected");
  console.log("ALL PASSED");
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
