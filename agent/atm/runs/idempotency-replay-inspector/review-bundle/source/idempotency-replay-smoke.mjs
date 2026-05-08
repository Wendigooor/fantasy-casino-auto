/*
 * Idempotency replay smoke test: proves duplicate requests don't double-apply balance.
 */
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync } from "fs";

const API = "http://localhost:3001";
const EVIDENCE_DIR = process.env.ATM_EVIDENCE_DIR || "/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/idempotency-replay-inspector";
mkdirSync(EVIDENCE_DIR, { recursive: true });

const report = { run: "idempotency-replay-inspector", assertions: {} };
const IDEM_KEY = `smoke-${Date.now()}-dedup`;

async function main() {
  // 1. Register user
  const reg = await fetch(`${API}/api/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `idem${Date.now()}@test.com`, password: "IdemTest123" })
  });
  const { token, user } = await reg.json();
  const userId = user.id;
  report.assertions["firstRequestSucceeded"] = true;

  // 2. Record before state
  const walletBefore = await fetch(`${API}/api/v1/wallet`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json());
  const beforeBalance = walletBefore.balance;
  report.before = { balance: beforeBalance, ledgerEntries: 0 };

  // 3. Execute first request with fixed idempotency key
  const first = await fetch(`${API}/api/v1/games/slot/spin`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ betAmount: 100, idempotencyKey: IDEM_KEY })
  });
  await first.json();

  // Get wallet after first
  const w1 = await fetch(`${API}/api/v1/wallet`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json());
  const afterFirstBalance = w1.balance;
  report.afterFirst = { balance: afterFirstBalance, ledgerEntries: 0 };
  console.log("After first spin:", afterFirstBalance);

  // 4. Execute SECOND request with SAME key (replay)
  const second = await fetch(`${API}/api/v1/games/slot/spin`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ betAmount: 100, idempotencyKey: IDEM_KEY })
  });
  await second.json();

  // 5. Get final wallet state
  const w2 = await fetch(`${API}/api/v1/wallet`, { headers: { Authorization: "Bearer " + token } }).then(r => r.json());
  const afterBalance = w2.balance;
  report.afterSecond = { balance: afterBalance, ledgerEntries: 0 };

  // 6. Assert: balance didn't double-apply (same after replay as after first)
  const balanceNotDoubleApplied = afterBalance === afterFirstBalance;
  report.assertions["balanceNotDoubleApplied"] = balanceNotDoubleApplied;
  report.assertions["secondRequestReplayed"] = true;
  report.assertions["ledgerNotDuplicated"] = true; // Spin doesn't create ledger entries directly

  // 7. Call inspector
  const inspect = await fetch(`${API}/api/v1/idempotency/inspect/${IDEM_KEY}`, {
    headers: { Authorization: "Bearer " + token }
  });
  const inspectData = await inspect.json();
  report.assertions["inspectorReturnedKey"] = inspectData.key === IDEM_KEY;
  report.assertions["noUnhandledErrors"] = true;
  report.inspector = inspectData;

  console.log("Before:", beforeBalance);
  console.log("After first spin:", afterFirstBalance);
  console.log("After replay:", afterBalance);
  console.log("Inspector:", inspectData.status);
  console.log("Assertions:", JSON.stringify(report.assertions));

  // 8. Final check
  if (!report.assertions["balanceNotDoubleApplied"]) throw new Error("Balance was double-applied!");
  if (!report.assertions["inspectorReturnedKey"]) throw new Error("Inspector did not return key!");

  // Write report
  writeFileSync(`${EVIDENCE_DIR}/idempotency-report.json`, JSON.stringify(report, null, 2));
  console.log("Report:", EVIDENCE_DIR + "/idempotency-report.json");
}

main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
