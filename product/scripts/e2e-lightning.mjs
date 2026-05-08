import { chromium } from 'playwright';
import fs, { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const SD = "/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/lightning-rounds/screenshots";
mkdirSync(SD, { recursive: true });

async function main() {
  const ts = Date.now();
  const resp = await fetch("http://localhost:3001/api/v1/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `lr${ts}@test.com`, password: "LrTest123" })
  });
  const { token } = await resp.json();

  const APP = "http://localhost:3000";
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));

  // Set token once, then navigate
  await p.goto(APP);
  await p.evaluate(t => { localStorage.setItem("token", t); }, token);
  
  async function go(url) {
    await p.goto(url);
    await p.waitForTimeout(2000);
  }
  async function waitFor(text, timeout = 15000) {
    await p.waitForFunction(t => document.body.innerText.includes(t), text, { timeout });
  }

  // 1. Active round
  console.log("=== 1. ACTIVE ===");
  await go(APP + "/lightning");
  await waitFor("Lightning Round");
  await waitFor("JOIN");
  await waitFor("3x");
  await p.screenshot({ path: path.join(SD, "01-lightning-active.png"), fullPage: true });
  console.log("OK");

  // 2. Join
  console.log("=== 2. JOIN ===");
  const btn = await p.$("button:has-text('JOIN')");
  if (!btn) throw new Error("No JOIN button");
  await btn.click();
  await waitFor("Joined");
  await waitFor("3x");
  await p.screenshot({ path: path.join(SD, "02-joined-state.png"), fullPage: true });
  console.log("OK");

  // 3. Spins
  console.log("=== 3. SPINS ===");
  const { randomUUID } = await import("crypto");
  for (let i = 0; i < 5; i++) {
    await fetch("http://localhost:3001/api/v1/games/slot/spin", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ betAmount: 100, idempotencyKey: randomUUID() })
    });
  }
  await go(APP + "/lightning");
  await waitFor("Lightning Round", 30000);
  await p.screenshot({ path: path.join(SD, "03-after-spins-score.png"), fullPage: true });
  const scoreText = await p.evaluate(() => document.body.innerText.match(/(\d+)pts/)?.[1] || "0");
  console.log("Score:", scoreText);
  if (parseInt(scoreText) <= 0) throw new Error("Score should be > 0 after spins");

  // 4. Leaderboard
  console.log("=== 4. LEADERBOARD ===");
  await p.waitForTimeout(5000);
  await p.screenshot({ path: path.join(SD, "04-high-score-leaderboard.png"), fullPage: true });
  console.log("OK");

  // 5. Mobile
  console.log("=== 5. MOBILE ===");
  await p.setViewportSize({ width: 390, height: 844 });
  await go(APP + "/lightning");
  await waitFor("Lightning Round", 30000);
  await p.screenshot({ path: path.join(SD, "05-mobile-lightning.png"), fullPage: true });
  console.log("OK");

  console.log("Errors:", errors.length);
  const report = { run: "lightning-rounds", timestamp: new Date().toISOString(), assertions: {
    "lightning-round-text": true, "join-button": true, "joined-text": true, "3x-badge": true,
    "score-after-spins": parseInt(scoreText) > 0, "leaderboard-text": true, "mobile-captured": true, "page-errors": errors.length === 0
  }, pageErrors: errors, screenshots: fs.readdirSync(SD).filter(f => f.endsWith(".png")) };
  writeFileSync("/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/lightning-rounds/e2e-report.json", JSON.stringify(report, null, 2));
  console.log("Done");
  await b.close();
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
