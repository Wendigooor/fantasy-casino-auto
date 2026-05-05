#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOTS = join(ROOT, "screenshots-pvp-new");
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

  // Register users via API
  const uid = Date.now();
  const ea = `pvp-a-${uid}@t.io`, eb = `pvp-b-${uid}@t.io`;

  async function register(email) {
    const r = await fetch(`${API}/api/v1/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Test1234!", name: email.split("@")[0] })
    }).then(r => r.json());
    return r.token;
  }
  async function req(tok, method, path, body) {
    return fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(r => r.json());
  }

  const tokA = await register(ea);
  const tokB = await register(eb);
  await req(tokA, "POST", "/api/v1/wallet/deposit", { amount: 100000, currency: "USD" });
  await req(tokB, "POST", "/api/v1/wallet/deposit", { amount: 100000, currency: "USD" });

  const duel = await req(tokA, "POST", "/api/v1/duels", { gameId: "slot-basic", betAmount: 500 });
  await req(tokB, "POST", `/api/v1/duels/${duel.id}/accept`);
  console.log(`Duel: ${duel.id}, registered: ${ea}, ${eb}`);

  async function screenshot(name, token) {
    const page = await ctx.newPage();
    // Set token BEFORE any navigation via addInitScript
    await page.addInitScript((t) => { localStorage.setItem("token", t); }, token);
    await page.goto(`${WEB}/login`, { waitUntil: "domcontentloaded" });
    await page.goto(`${WEB}/duels`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    return { page };
  }

  // Screenshot 1: A's lobby
  console.log("[1] Lobby");
  let { page } = await screenshot("login", tokA);
  await page.screenshot({ path: join(SHOTS, "01-lobby.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  // Screenshot 2: Duel page from A's perspective (waiting for A to spin)
  console.log("[2] Arena waiting for spin");
  ({ page } = await screenshot("login", tokA));
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "02-arena-waiting.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  // Screenshot 3: B's view — sees opponent's turn
  console.log("[3] B watching");
  ({ page } = await screenshot("login", tokB));
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "03-b-watches.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  // A spins
  await req(tokA, "POST", `/api/v1/duels/${duel.id}/spin`);

  // Screenshot 4: A after spin, waiting for B
  console.log("[4] A after spin");
  ({ page } = await screenshot("login", tokA));
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "04-a-after-spin.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  // B spins
  await req(tokB, "POST", `/api/v1/duels/${duel.id}/spin`);

  // Screenshot 5: Settlement from B
  console.log("[5] B settlement");
  ({ page } = await screenshot("login", tokB));
  await page.goto(`${WEB}/duels/${duel.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "05-settlement.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  // Screenshot 6: Player profile
  console.log("[6] Profile");
  ({ page } = await screenshot("login", tokA));
  await page.goto(`${WEB}/player`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SHOTS, "06-profile.png"), fullPage: true });
  console.log(`  ${(await page.locator("body").innerText()).slice(0,60)}`);
  await page.close();

  await browser.close();
  api.kill(); web.kill();
  console.log("\nDone.");
}

main().catch(e => { console.error(e); process.exit(1); });
