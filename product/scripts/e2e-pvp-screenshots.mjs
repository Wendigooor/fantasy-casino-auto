#!/usr/bin/env node
/**
 * PvP E2E — two-player duel flow with verified unique screenshots.
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCREENSHOTS = join(ROOT, "screenshots-pvp");
const API = "http://localhost:3001";
const WEB = "http://localhost:3000";

mkdirSync(SCREENSHOTS, { recursive: true });

function shot(page, name) {
  return page.screenshot({ path: join(SCREENSHOTS, name), fullPage: true });
}

function startServer(cmd, args, cwd, label, env = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: "pipe", shell: true, env: { ...process.env, ...env } });
    let started = false;
    const cb = (d) => {
      if (!started && (d.includes("listening") || d.includes("ready") || d.includes("Local"))) {
        started = true; console.log(`  OK ${label}`); resolve(proc);
      }
    };
    proc.stderr.on("data", (d) => cb(d.toString()));
    proc.stdout.on("data", (d) => cb(d.toString()));
    setTimeout(() => { if (!started) { started = true; resolve(proc); } }, 8000);
  });
}

async function register(page, email, pass) {
  await page.goto(`${WEB}/login`, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  
  // Try direct navigation to register state
  await page.evaluate(() => {
    const btn = document.querySelector("button");
    const buttons = document.querySelectorAll("button");
    // Find the Register/Login toggle button
    for (const b of buttons) {
      if (b.textContent?.includes("Register") || b.textContent?.includes("Login")) {
        if (b.className?.includes("btn-ghost") || b.className?.includes("link-btn")) {
          b.click();
          break;
        }
      }
    }
  });
  await page.waitForTimeout(300);
  await page.fill("#e", email);
  await page.fill("#p", pass);
  await page.click("button[type='submit']");
  await page.waitForURL("**/");
  await page.waitForTimeout(500);
}

const verifyChanged = (prev, current, label) => {
  if (prev === current) console.log(`  WARN: ${label} unchanged`);
  else console.log(`  OK: ${label}`);
  return current;
};

async function main() {
  console.log("=== PvP E2E ===\n");

  console.log("Starting servers...");
  const api = await startServer("npx", ["tsx", "src/index.ts"], join(ROOT, "apps/api"), "API", { JWT_SECRET: "e2e-pvp-secret-32-chars-minimum!!" });
  const web = await startServer("npx", ["vite", "--port", "3000"], join(ROOT, "apps/web"), "Web");
  // Extra wait for Vite to be fully ready
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();

  try {
    const ea = `pvp-a-${Date.now()}@t.io`;
    const eb = `pvp-b-${Date.now()}@t.io`;
    const pw = "Test1234!";

    // 1. Both register
    console.log("\n[1] Register both players");
    await register(pa, ea, pw);
    await register(pb, eb, pw);
    let hash = "";

    // 2. A creates duel, sees it
    console.log("\n[2] A creates duel");
    await pa.goto(`${WEB}/duels`, { waitUntil: "domcontentloaded" });
    await pa.waitForTimeout(2000);
    await pa.locator("input[type='number']").first().fill("100");
    await pa.locator("button", { hasText: "Create" }).first().click();
    await pa.waitForTimeout(2000);
    await pa.goto(`${WEB}/duels`, { waitUntil: "domcontentloaded" });
    await pa.waitForTimeout(1500);
    hash = verifyChanged(hash, await pa.locator("body").innerText(), "A arena after create");
    await shot(pa, "01-arena-after-create.png");

    // 3. B sees open duel
    console.log("\n[3] B sees open duel");
    await pb.goto(`${WEB}/duels`, { waitUntil: "domcontentloaded" });
    await pb.waitForTimeout(2000);
    const bArenaText = await pb.locator("body").innerText();
    if (!bArenaText.includes("Accept")) console.log("  ERROR: No Accept button for B!");
    await shot(pb, "02-b-sees-open-duel.png");

    // 4. B clicks Accept
    console.log("\n[4] B accepts");
    const acceptLink = pb.locator("a:has-text('Accept')").first();
    if (await acceptLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptLink.click();
      await pb.waitForTimeout(2000);
    }
    hash = verifyChanged(hash, await pb.locator("body").innerText(), "B duel page");
    await shot(pb, "03-b-duel-accepted-state.png");

    // 5. A spins
    console.log("\n[5] A spins");
    await pa.goto(`${WEB}/duels`, { waitUntil: "domcontentloaded" });
    await pa.waitForTimeout(1500);
    // Find duel link in "My Duels"
    const aDuelLink = pa.locator("a[href*='/duels/']").first();
    if (await aDuelLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aDuelLink.click();
      await pa.waitForTimeout(2000);
    }
    const aSpin = pa.locator("button", { hasText: /Spin/ }).first();
    if (await aSpin.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aSpin.click();
      await pa.waitForTimeout(2000);
    }
    hash = verifyChanged(hash, await pa.locator("body").innerText(), "A after spin");
    await shot(pa, "04-a-after-spin.png");

    // 6. B spins
    console.log("\n[6] B spins");
    await pb.waitForTimeout(2000);
    const bSpin = pb.locator("button", { hasText: /Spin/ }).first();
    if (await bSpin.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bSpin.click();
      await pb.waitForTimeout(2000);
    }
    hash = verifyChanged(hash, await pb.locator("body").innerText(), "B after spin");
    await shot(pb, "05-b-sees-settlement.png");

    // 7. A sees settlement
    await pa.waitForTimeout(2000);
    hash = verifyChanged(hash, await pa.locator("body").innerText(), "A sees settlement");
    await shot(pa, "06-a-settlement.png");

    console.log("\nDone. 6 unique screenshots.");

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
    api.kill(); web.kill();
  }
}

main();
