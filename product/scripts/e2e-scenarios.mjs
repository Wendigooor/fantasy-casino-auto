import { chromium } from 'playwright';
import fs, { readdirSync, statSync, mkdirSync } from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
const shotsDir = '/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/missions-quests/screenshots-casino-grade';
mkdirSync(shotsDir, { recursive: true });

const API = 'http://localhost:3001';
const APP = 'http://localhost:3000';

async function apiReq(method, urlPath, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${urlPath}`, opts).then(r => r.json());
}

async function gotoWithToken(page, url, token) {
  await page.goto(APP);
  await page.waitForTimeout(1000);
  await page.evaluate(t => { localStorage.setItem('token', t); }, token);
  await page.goto(url);
  await page.waitForTimeout(4000);
}

async function main() {
  const ts = Date.now();
  const r = await apiReq('POST', '/api/v1/auth/register', { email: `d5${ts}@test.com`, password: 'Demo1234' });
  const token = r.token;
  console.log(`User: ${token?.slice(0,16)}...`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await gotoWithToken(page, `${APP}/missions`, token);

  // =====================================
  // SCENARIO A: Fresh Campaign Hub + Daily Rush
  // =====================================
  console.log('\n=== SCENARIO A: Fresh Campaign Hub ===');
  
  // A1: Full page campaign overview
  console.log('A1: Campaign hub hero + daily rush + weekly path');
  await page.screenshot({ path: path.join(shotsDir, 'a1-campaign-hub-full.png'), fullPage: true });
  
  // A2: Top portion - hero + summary
  console.log('A2: Hero closeup');
  const hero = await page.locator('[data-page="missions"]').first();
  await hero.screenshot({ path: path.join(shotsDir, 'a2-hero-quest-rush.png') });

  // A3: Daily Rush group
  console.log('A3: Daily Rush group');
  const daily = page.locator('text=Daily Rush').locator('..').first();
  // Just capture of daily rush area - scroll to it
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'a3-daily-rush-group.png') });

  // A4: Weekly Path
  console.log('A4: Weekly Path');
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'a4-weekly-path.png') });

  // =====================================
  // SCENARIO B: Complete First Mission
  // =====================================
  console.log('\n=== SCENARIO B: First Completion ===');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  
  // Spin via API
  await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 10, idempotencyKey: `d5-${ts}-1` }, token);
  await apiReq('POST', '/api/v1/missions/refresh', {}, token);
  await page.waitForTimeout(2000);
  await gotoWithToken(page, `${APP}/missions`, token);

  // B1: First Steps completed - CLAIM button visible
  // Scroll to see the claim button
  await page.evaluate(() => window.scrollTo(0, 250));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'b1-first-step-completed.png') });

  // B2: Closeup of the completed mission card
  const card = await page.locator('[data-testid="mission-card-first_spin"]').first();
  await card.screenshot({ path: path.join(shotsDir, 'b2-completed-card-closeup.png') });

  // B3: Click claim, capture modal
  const claimBtn = await page.locator('[data-testid="claim-button"]').first();
  if (claimBtn) await claimBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotsDir, 'b3-reward-modal.png') });

  // Dismiss modal
  const modalBtn = await page.locator('button:has-text("AWESOME")').first();
  if (modalBtn) await modalBtn.click();
  await page.waitForTimeout(1000);

  // B4: Claimed state
  await page.screenshot({ path: path.join(shotsDir, 'b4-mission-claimed.png') });

  // =====================================
  // SCENARIO C: Multiple Progress + Streak
  // =====================================
  console.log('\n=== SCENARIO C: Streak Progress ===');
  
  // Do 4 more spins to progress spin_starter + high_roller
  for (let i = 0; i < 4; i++) {
    await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 50, idempotencyKey: `d5-${ts}-s${i}` }, token);
  }
  await apiReq('POST', '/api/v1/missions/refresh', {}, token);
  await page.waitForTimeout(2000);
  await gotoWithToken(page, `${APP}/missions`, token);

  // C1: Multiple missions in progress
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'c1-multiple-progress.png') });

  // C2: Spin Starter at 5/5 claimable
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'c2-spin-starter-claimable.png') });

  // C3: Claim and show both claimed
  const claimBtn2 = await page.locator('[data-testid="claim-button"]').first();
  if (claimBtn2) await claimBtn2.click();
  await page.waitForTimeout(1000);
  const modalBtn2 = await page.locator('button:has-text("AWESOME")').first();
  if (modalBtn2) await modalBtn2.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(shotsDir, 'c3-multiple-claimed.png') });

  // C4: High wager progress
  await gotoWithToken(page, `${APP}/missions`, token);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'c4-high-wager-progress.png') });

  // =====================================
  // SCENARIO D: Wallet + Ledger Proof
  // =====================================
  console.log('\n=== SCENARIO D: Wallet Proof ===');
  await gotoWithToken(page, `${APP}/wallet`, token);
  
  // D1: Wallet overview
  await page.screenshot({ path: path.join(shotsDir, 'd1-wallet-overview.png') });
  
  // D2: Ledger entries closeup
  // Scroll to ledger table
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'd2-ledger-entries.png') });

  // D3: Wallet deposit
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'd3-wallet-deposit-form.png') });

  // D4: Balance detail
  const balCard = await page.locator('text=Balance').locator('..').first();
  if (balCard) await balCard.screenshot({ path: path.join(shotsDir, 'd4-balance-card.png') });

  // =====================================
  // SCENARIO E: Mobile Experience
  // =====================================
  console.log('\n=== SCENARIO E: Mobile ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoWithToken(page, `${APP}/missions`, token);
  
  // E1: Mobile hub
  await page.screenshot({ path: path.join(shotsDir, 'e1-mobile-hub.png') });
  
  // E2: Mobile mission card closeup
  const cardM = await page.locator('[data-testid="mission-card-first_spin"]').first();
  if (cardM) await cardM.screenshot({ path: path.join(shotsDir, 'e2-mobile-mission-card.png') });

  // E3: Mobile wallet
  await gotoWithToken(page, `${APP}/wallet`, token);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotsDir, 'e3-mobile-wallet.png') });

  // E4: Mobile navigation
  await gotoWithToken(page, `${APP}/missions`, token);
  await page.waitForTimeout(2000);
  // Click hamburger
  const hamburger = await page.locator('button:has-text("👤")').first();
  if (hamburger) await hamburger.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, 'e4-mobile-menu.png') });

  // =====================================
  // REPORT
  // =====================================
  console.log('\n=== SCREENSHOT REPORT ===');
  let totalKb = 0;
  for (const f of readdirSync(shotsDir).sort()) {
    const s = statSync(path.join(shotsDir, f));
    const kb = (s.size / 1024).toFixed(0);
    totalKb += parseInt(kb);
    console.log(`  ${f}: ${kb}KB`);
  }
  console.log(`\nTotal: ${totalKb}KB, ${readdirSync(shotsDir).length} screenshots`);
  console.log(`Errors: ${errors.length}`);

  await browser.close();
  console.log('\nSCENARIO E2E: DONE');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
