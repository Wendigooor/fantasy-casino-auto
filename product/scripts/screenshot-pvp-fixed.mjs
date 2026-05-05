#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOTS = join(ROOT, "screenshots-pvp");
const API = "http://localhost:3001";
const WEB = "http://localhost:3000";
const SECRET = "e2e-pvp-secret-32-chars-minimum!!";

mkdirSync(SHOTS, { recursive: true });

function start(cmd, args, cwd, label, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: "pipe", shell: true, env: { ...process.env, ...env } });
    let started = false;
    const cb = (d) => { if (!started && (d.includes("listening") || d.includes("ready") || d.includes("Local:"))) { started = true; resolve(p); }};
    p.stderr.on("data", cb); p.stdout.on("data", cb);
    setTimeout(() => { if (!started) { started = true; resolve(p); } }, 10000);
  });
}

async function main() {
  console.log("Starting servers...");
  const api = await start("npx", ["tsx", "src/index.ts"], join(ROOT, "apps/api"), "API", { JWT_SECRET: SECRET });
  const web = await start("npx", ["vite", "--port", "3000"], join(ROOT, "apps/web"), "Web");
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Register 2 users via API
  const uid = Date.now();
  const ea = `pvp-a-${uid}@t.io`;
  const eb = `pvp-b-${uid}@t.io`;

  async function register(email) {
    const r = await fetch(`${API}/api/v1/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Test1234!", name: email.split("@")[0] })
    });
    const data = await r.json();
    return data.token;
  }

  async function authReq(token, method, path, body) {
    return fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(r => r.json());
  }

  console.log("Registering users...");
  const tokenA = await register(ea);
  const tokenB = await register(eb);
  console.log("  Users registered");

  // Fund wallets
  await authReq(tokenA, "POST", "/api/v1/wallet/deposit", { amount: 100000, currency: "USD" });
  await authReq(tokenB, "POST", "/api/v1/wallet/deposit", { amount: 100000, currency: "USD" });

  // A creates a duel
  const duel = await authReq(tokenA, "POST", "/api/v1/duels", { gameId: "slot-basic", betAmount: 500 });
  console.log(`  Duel created: ${duel.id}`);

  // B accepts
  const accepted = await authReq(tokenB, "POST", `/api/v1/duels/${duel.id}/accept`);
  console.log(`  Duel accepted`);

  // Screenshot 1: A's lobby with active duel + create form
  console.log("\n[1] A's lobby with active duel + create form");
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await page.evaluate((t) => localStorage.setItem("token", t), tokenA);
  await page.goto(`${WEB}/duels`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "01-lobby-with-duel.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  // Screenshot 2: A's duel page — active, waiting for A to spin
  console.log("\n[2] A's duel page — waiting for spin");
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "02-arena-waiting-spin.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  // Screenshot 3: B's duel page — waiting for A to spin
  console.log("\n[3] B sees A's turn");
  await page.evaluate((t) => localStorage.setItem("token", t), tokenB);
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "03-b-watches-a-turn.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  // A spins
  const spinA = await authReq(tokenA, "POST", `/api/v1/duels/${duel.id}/spin`);
  console.log(`  A spun: mult=${spinA.creatorMultiplier || spinA.acceptorMultiplier}`);

  // Screenshot 4: A's duel — spinner done, waiting for B
  console.log("\n[4] A after spin, waiting for B");
  await page.evaluate((t) => localStorage.setItem("token", t), tokenA);
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "04-a-after-spin-waiting-b.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  // B spins
  const spinB = await authReq(tokenB, "POST", `/api/v1/duels/${duel.id}/spin`);
  console.log(`  B spun: mult=${spinB.creatorMultiplier || spinB.acceptorMultiplier}`);

  // Screenshot 5: Settlement from B's perspective
  console.log("\n[5] B sees settlement");
  await page.evaluate((t) => localStorage.setItem("token", t), tokenB);
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "05-b-sees-settlement.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  // Screenshot 6: Player profile with stats
  console.log("\n[6] A's player profile");
  await page.evaluate((t) => localStorage.setItem("token", t), tokenA);
  await page.goto(`${WEB}/player`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "06-player-profile.png"), fullPage: true });
  console.log(`  OK: ${(await page.locator("body").innerText()).slice(0, 80)}`);

  await browser.close();
  api.kill(); web.kill();
  console.log("\nDone. 6 screenshots.");
}

main().catch(e => { console.error(e); process.exit(1); });
