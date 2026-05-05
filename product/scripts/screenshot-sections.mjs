import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dirname, "..", "screenshots-pvp-new");
mkdirSync(SHOTS, { recursive: true });

const URL = "http://localhost:8999/screenshot-pages.html";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const titles = page.locator(".section-title");

  // Screenshot each section by scrolling it into view and taking full viewport
  const sections = [
    { name: "01-lobby", idx: 0 },
    { name: "02-arena-waiting", idx: 1 },
    { name: "03-arena-after-spin", idx: 2 },
    { name: "04-victory", idx: 3 },
    { name: "05-profile", idx: 4 },
  ];

  for (const s of sections) {
    console.log(`[${s.name}]`);
    await titles.nth(s.idx).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOTS, `${s.name}.png`), fullPage: false });
    console.log("  OK");
  }

  await browser.close();
  console.log("Done.");
}

main().catch(e => { console.error(e.message); process.exit(1); });
