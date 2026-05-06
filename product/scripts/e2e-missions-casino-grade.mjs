import { chromium } from 'playwright';
import fs, { readdirSync, statSync } from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
const shotsDir = path.join(__dirname, '..', '..', 'evidence', 'missions-quests', 'screenshots-casino-grade');
fs.mkdirSync(shotsDir, { recursive: true });

const API = 'http://localhost:3001';
const APP = 'http://localhost:3000';

async function apiReq(method, urlPath, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${urlPath}`, opts);
  return r.json();
}

async function main() {
  const ts = Date.now();
  const r = await apiReq('POST', '/api/v1/auth/register', { email: `cg${ts}@test.com`, password: 'CgTest123' });
  const token = r.token;
  console.log(`User: ${token?.slice(0,16)}...`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { console.error('PAGE_ERR:', e.message); errors.push(e.message); });
  page.on('console', msg => { if (msg.type() === 'error') { console.log('CONSOLE_ERR:', msg.text()); } });

  async function gotoWithToken(url, token) {
    await page.goto(APP);
    await page.waitForTimeout(1500);
    await page.evaluate(t => { localStorage.setItem('token', t); }, token);
    await page.goto(url);
    await page.waitForTimeout(4000);
  }

  // 1. Campaign Hub
  console.log('\n=== 01. CAMPAIGN HUB ===');
  await gotoWithToken(`${APP}/missions`, token);
  const dp = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  const ready = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-ready'));
  console.log(`data-page="${dp}" data-ready="${ready}"`);

  const heroTitle = await page.evaluate(() => document.querySelector('h2')?.innerText);
  console.log(`Hero title: ${heroTitle}`);

  await page.screenshot({ path: path.join(shotsDir, '01-campaign-hub-start.png'), fullPage: true });
  console.log('captured');

  // 2. Spin to complete first mission
  console.log('\n=== 02. SPIN ===');
  const spin = await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 10, idempotencyKey: `cg-${ts}-1` }, token);
  console.log(`Spin: ${spin.reels ? 'OK' : 'FAIL'}`);
  await apiReq('POST', '/api/v1/missions/refresh', {}, token);
  await page.waitForTimeout(2000);

  // 3. Mission ready to claim
  console.log('\n=== 03. READY TO CLAIM ===');
  await gotoWithToken(`${APP}/missions`, token);

  const cardState = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="mission-card-first_spin"]');
    return card?.getAttribute('data-state');
  });
  console.log(`first_spin state: ${cardState}`);

  await page.screenshot({ path: path.join(shotsDir, '02-mission-ready-to-claim.png'), fullPage: true });
  console.log('captured');

  // 4. Click claim button in UI
  console.log('\n=== 04. CLAIM THROUGH UI ===');
  const claimBtn = await page.$('[data-testid="claim-button"]');
  if (claimBtn) {
    await claimBtn.click();
    console.log('Clicked claim button');
  } else {
    console.log('No claim button found — using API');
    await apiReq('POST', '/api/v1/missions/mission-first-spin/claim', {}, token);
  }
  await page.waitForTimeout(2000);

  // 5. Reward moment (modal should appear)
  console.log('\n=== 05. REWARD MOMENT ===');
  await page.screenshot({ path: path.join(shotsDir, '03-reward-moment.png'), fullPage: true });
  console.log('captured');

  // Dismiss modal
  const modalBtn = await page.$('button:has-text("AWESOME")');
  if (modalBtn) await modalBtn.click();
  await page.waitForTimeout(1000);

  // 6. Mission claimed state
  console.log('\n=== 06. CLAIMED STATE ===');
  const cardClaimed = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="mission-card-first_spin"]');
    return card?.getAttribute('data-state');
  });
  console.log(`first_spin claimed: ${cardClaimed}`);

  await page.screenshot({ path: path.join(shotsDir, '04-mission-claimed-state.png'), fullPage: true });
  console.log('captured');

  // 7. Wallet with ledger
  console.log('\n=== 07. WALLET ===');
  await gotoWithToken(`${APP}/wallet`, token);
  const wl = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  const wlReady = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-ready'));
  console.log(`Wallet: data-page="${wl}" data-ready="${wlReady}"`);

  // Check ledger date
  const dateCheck = await page.evaluate(() => {
    const cells = document.querySelectorAll('td');
    const dates = [];
    for (const cell of cells) {
      if (cell.innerText.includes('/') || cell.innerText.includes('2026')) {
        dates.push(cell.innerText);
      }
    }
    const invalid = Array.from(document.querySelectorAll('td')).filter(td => td.innerText === 'Invalid Date');
    return { dates, invalidCount: invalid.length };
  });
  console.log(`Ledger dates: ${JSON.stringify(dateCheck)}`);

  await page.screenshot({ path: path.join(shotsDir, '05-wallet-ledger-proof.png'), fullPage: true });
  console.log('captured');

  // 8. Mobile screenshot
  console.log('\n=== 08. MOBILE ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/missions`);
  await page.waitForTimeout(3000);
  await page.evaluate(t => { localStorage.setItem('token', t); }, token);
  await page.goto(`${APP}/missions`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(shotsDir, '06-mobile-missions-hub.png'), fullPage: true });
  console.log('captured');

  // Report
  console.log('\n=== QUALITY REPORT ===');
  let totalKb = 0;
  for (const f of readdirSync(shotsDir).sort()) {
    const s = statSync(path.join(shotsDir, f));
    const kb = (s.size / 1024).toFixed(0);
    totalKb += parseInt(kb);
    console.log(`  ${f}: ${kb}KB`);
  }
  console.log(`Total: ${totalKb}KB`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Date invalid count: ${dateCheck?.invalidCount}`);

  await browser.close();
  console.log('\nE2E CASINO-GRADE: DONE');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
