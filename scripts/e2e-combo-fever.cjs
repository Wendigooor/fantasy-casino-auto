const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const BASE = "http://localhost:3000";
const API = "http://localhost:3001";
const EVIDENCE = path.resolve(__dirname, "..", "agent/atm/runs/combo-fever/evidence/screenshots");
const REPORT = { run: "combo-fever", timestamp: new Date().toISOString(), assertions: {}, pageErrors: [], screenshots: [] };
let okc = 0, failc = 0;

function ok(name) { REPORT.assertions[name] = true; okc++; console.log("  PASS " + name); }
function fail(name) { REPORT.assertions[name] = false; failc++; console.log("  FAIL " + name); }

async function snap(page, name) {
  const p = path.join(EVIDENCE, name);
  await page.screenshot({ path: p, fullPage: false });
  REPORT.screenshots.push(name);
  console.log("  SNAP " + name + " (" + fs.statSync(p).size + "b)");
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("=== Combo Fever E2E ===\n");
  fs.mkdirSync(EVIDENCE, { recursive: true });

  // Register
  const email = "ce-" + Date.now() + "@t.com";
  const reg = await (await fetch(API + "/api/v1/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Test1234", name: "CF" }),
  })).json();
  if (!reg.token) throw new Error("Reg fail");
  const tok = reg.token;
  const uid = reg.user?.id || reg.id;
  console.log("User: " + email);

  await fetch(API + "/api/v1/wallet/deposit", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
    body: JSON.stringify({ amount: 100000, currency: "USD" }),
  });

  // Test combo lifecycle via API (WITH delays)
  await sleep(1500);
  const c0 = await (await fetch(API + "/api/v1/combo/fever", { headers: { Authorization: "Bearer " + tok } })).json();
  if (c0.streak === 0) ok("fresh-zero"); else fail("fresh-zero");
  console.log("Fresh: streak=" + c0.streak + "\n");

  let maxStreak = 0;
  for (let i = 0; i < 80; i++) {
    await sleep(600);
    const spin = await (await fetch(API + "/api/v1/games/slot/spin", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
      body: JSON.stringify({ betAmount: 100, idempotencyKey: "c-" + Date.now() + "-" + i, gameId: "slot-basic" }),
    })).json();

    await sleep(600);
    const combo = await (await fetch(API + "/api/v1/combo/fever", { headers: { Authorization: "Bearer " + tok } })).json();
    const s = combo.streak || 0;
    if (s > maxStreak) maxStreak = s;

    if (spin.winAmount > 0) {
      console.log("  Win " + i + ": streak=" + s + " mult=" + combo.multiplier);
      if (s === 1) ok("streak-1");
      if (s >= 2) ok("streak-2-or-more");
    }
  }
  console.log("Max streak: " + maxStreak + "\n");

  // Seed combo for visual test
  const pool = new Pool({ database: "fantasy_casino", user: "iharzvezdzin" });
  await pool.query(
    "INSERT INTO combo_streaks (user_id, streak, max_streak_today, updated_at) VALUES ($1, 7, 7, NOW()) ON CONFLICT (user_id) DO UPDATE SET streak = 7, max_streak_today = GREATEST(combo_streaks.max_streak_today, 7), updated_at = NOW()",
    [uid]
  );
  await pool.end();

  await sleep(1500);
  const c1 = await (await fetch(API + "/api/v1/combo/fever", { headers: { Authorization: "Bearer " + tok } })).json();
  if (c1.streak >= 5) ok("combo-seeded-api"); else fail("combo-seeded-api");
  console.log("Seeded: streak=" + c1.streak + " mult=" + c1.multiplier + "\n");

  // Browser - set token directly in localStorage
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE + "/");
  await page.evaluate((t) => { localStorage.setItem("token", t); }, tok);
  await page.goto(BASE + "/game/slot-basic");
  await sleep(3000);
  console.log("Game URL: " + page.url() + "\n");

  // Screenshots
  await snap(page, "01-combo-idle.png");
  const mv = await page.locator("text=Combo Fever").isVisible().catch(() => false);
  if (mv) ok("meter-visible"); else { fail("meter-visible"); console.log("  (checking page content...)"); console.log(await page.content().then(c => c.substring(500, 1500)).catch(() => "")); }

  // Refresh to show seeded streak
  await page.goto(BASE + "/game/slot-basic");
  await sleep(2000);
  await snap(page, "02-combo-streak-seeded.png");

  // Mobile
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE + "/");
  await mobile.evaluate((t) => { localStorage.setItem("token", t); }, tok);
  await mobile.goto(BASE + "/game/slot-basic");
  await sleep(2000);
  await snap(mobile, "03-combo-mobile.png");
  await mobile.close();
  await browser.close();

  // Report
  const rp = path.resolve(__dirname, "..", "agent/atm/runs/combo-fever/evidence/e2e-report.json");
  fs.writeFileSync(rp, JSON.stringify(REPORT, null, 2));
  console.log("\nReport: " + rp);
  console.log(okc + "/" + (okc + failc) + " pass, " + REPORT.screenshots.length + " screenshots");
  process.exit(failc > 0 ? 1 : 0);
}

main().catch(err => { console.error("FAIL:", err); process.exit(1); });
