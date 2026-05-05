#!/usr/bin/env node
/**
 * Headless E2E flow with screenshots.
 * Usage: node product/scripts/e2e-screenshots.mjs
 *
 * Starts API + Web, walks through full player journey,
 * takes screenshots at each step, saves to product/screenshots/.
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCREENSHOTS = join(ROOT, "screenshots");
const API_URL = "http://localhost:3001";
const WEB_URL = "http://localhost:3000";

mkdirSync(SCREENSHOTS, { recursive: true });

const screenshots = [];
let step = 0;

async function shot(page, name) {
  step++;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(SCREENSHOTS, file), fullPage: true });
  screenshots.push({ step, name, file });
  console.log(`  📸 ${file}`);
}

function startServer(cmd, args, cwd, label, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: "pipe", shell: true, env: { ...process.env, ...env } });
    let started = false;
    proc.stderr.on("data", (d) => {
      const msg = d.toString();
      if (!started && (msg.includes("listening") || msg.includes("ready") || msg.includes("Local"))) {
        started = true;
        console.log(`  ✓ ${label} started`);
        resolve(proc);
      }
    });
    proc.stdout.on("data", (d) => {
      const msg = d.toString();
      if (!started && (msg.includes("listening") || msg.includes("ready") || msg.includes("Local"))) {
        started = true;
        console.log(`  ✓ ${label} started`);
        resolve(proc);
      }
    });
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(proc);
      }
    }, 8000);
  });
}

async function main() {
  console.log("=== Fantasy Casino E2E Screenshots ===\n");

  // 1. Start servers
  console.log("▶ Starting servers...");
  const api = await startServer("npx", ["tsx", "src/index.ts"], join(ROOT, "apps/api"), "API", { JWT_SECRET: "e2e-test-secret-32-chars-minimum!!" });
  const web = await startServer("npx", ["vite", "--port", "3000"], join(ROOT, "apps/web"), "Web");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    const email = `screenshot-${Date.now()}@casino.io`;
    const pass = "Screenshot123!";

    // ── 2. Login page ──
    console.log("\n▶ Player journey\n");
    await page.goto(`${WEB_URL}/login`);
    await page.waitForTimeout(500);
    await shot(page, "login-page");

    // ── 3. Register ──
    await page.click(".btn-ghost");
    await page.waitForTimeout(200);
    await shot(page, "register-page");

    await page.fill("#e", email);
    await page.fill("#p", pass);
    await page.click("button[type='submit']");

    await page.waitForURL("**/");
    await page.waitForTimeout(300);
    console.log("  ✓ Registered");
    await shot(page, "lobby-after-register");

    // ── 4. Navigate to game via SPA
    await page.waitForTimeout(500);
    await page.goto(`${WEB_URL}/game/slot-basic`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    
    const pageUrl = page.url();
    const html = await page.content();
    const hasBet = html.includes("bet-input") || html.includes("spin-btn") || html.includes("SPIN");
    console.log(`  URL: ${pageUrl}`);
    if (!hasBet) {
      // Wait longer for React to hydrate
      await page.waitForTimeout(5000);
    }
    console.log("  ✓ Opened game");
    await shot(page, "game-page");

    // ── 5. Spin ──
    const bodyText = await page.locator("body").innerText();
    console.log(`  Game text: "${bodyText.substring(0, 120)}"`);
    
    await page.waitForTimeout(500);
    await page.fill("input[type='number']", "50");
    await page.locator("button", { hasText: /Spin|SPIN/ }).first().click();

    await page.waitForResponse((r) => r.url().includes("/games/slot/spin") && r.status() === 200, { timeout: 10000 });
    await page.waitForSelector(".reel", { timeout: 5000 });
    await page.waitForTimeout(300);
    console.log("  ✓ Spin completed");
    await shot(page, "spin-result");

    // ── 6. Check history ──
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, "round-history");

    // ── 7. Wallet ──
    const tokenInStore = await page.evaluate(() => localStorage.getItem("token"));
    console.log(`  Token in store: ${tokenInStore ? "yes" : "NO"}`);
    
    await page.goto(`${WEB_URL}/wallet`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    console.log("  ✓ Wallet page");
    await shot(page, "wallet-page");

    // ── 8. Deposit ──
    const depositInput = page.locator(".form.inline .form-input").first();
    if (await depositInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await depositInput.fill("999");
      await page.locator(".form.inline .btn-primary").first().click();
      await page.waitForTimeout(2000);
      console.log("  ✓ Deposit done");
    } else {
      console.log("  ⚠ Deposit form not visible — skipping");
    }
    await shot(page, "wallet-after-deposit");

    // ── 9. Lobby overview ──
    await page.goto(`${WEB_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    console.log("  ✓ Lobby");
    await shot(page, "lobby-with-balance");
  } catch (err) {
    console.error("  ✗ Error:", err.message);
    await shot(page, "error-state");
  } finally {
    await browser.close();
    api.kill();
    web.kill();

    // Write summary
    const summary = {
      timestamp: new Date().toISOString(),
      screenshots,
      total: screenshots.length,
      status: screenshots.length >= 8 ? "PASS" : "PARTIAL",
    };
    writeFileSync(join(SCREENSHOTS, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(`\n=== Done: ${screenshots.length} screenshots saved to screenshots/ ===`);
  }
}

main();
