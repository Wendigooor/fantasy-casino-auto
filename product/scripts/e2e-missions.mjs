import { chromium } from 'playwright';
import fs, { readdirSync, statSync } from 'fs';
import path from 'path';

const __dirname = import.meta.dirname;
const shotsDir = path.join(__dirname, '..', 'screenshots-pvp-new');
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
  const r = await apiReq('POST', '/api/v1/auth/register', { email: `mq${ts}@test.com`, password: 'MqTest123' });
  const token = r.token;
  console.log(`User registered: ${token?.slice(0, 16)}...`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE_ERR:', e.message));

  async function gotoWithToken(url, token) {
    await page.goto(APP);
    await page.waitForTimeout(1500);
    await page.evaluate(t => { localStorage.setItem('token', t); }, token);
    await page.goto(url);
    await page.waitForTimeout(4000);
  }

  // 1. Missions page — initial state
  console.log('\n=== 01. MISSIONS START ===');
  await gotoWithToken(`${APP}/missions`, token);
  const dp = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  console.log(`data-page: ${dp || 'MISSING'}`);

  const firstCard = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="mission-card-first_spin"]');
    if (!card) return null;
    return { state: card.getAttribute('data-state'), testid: card.getAttribute('data-testid') };
  });
  console.log(`First Steps card: ${JSON.stringify(firstCard)}`);

  await page.screenshot({ path: path.join(shotsDir, '01-missions-start.png'), fullPage: true });
  console.log('captured');

  // 2. Spin to complete mission
  console.log('\n=== 02. SPIN ===');
  const spin = await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 10, idempotencyKey: `mq-${ts}-1` }, token);
  console.log(`Spin: ${spin.reels ? 'OK' : 'FAIL'}`);
  
  // Refresh missions
  await apiReq('POST', '/api/v1/missions/refresh', {}, token);
  await page.waitForTimeout(1000);

  // 3. Missions page — after spin (First Steps completed)
  console.log('\n=== 03. MISSIONS COMPLETE ===');
  await gotoWithToken(`${APP}/missions`, token);

  const cardAfter = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="mission-card-first_spin"]');
    if (!card) return null;
    return { state: card.getAttribute('data-state'), text: card.innerText?.slice(0, 80) };
  });
  console.log(`First Steps after spin: ${JSON.stringify(cardAfter)}`);

  await page.screenshot({ path: path.join(shotsDir, '02-mission-complete.png'), fullPage: true });
  console.log('captured');

  // 4. Claim reward
  console.log('\n=== 04. CLAIM ===');
  const claim = await apiReq('POST', '/api/v1/missions/mission-first-spin/claim', {}, token);
  console.log(`Claim: ${claim.status} +${claim.reward?.amount}`);

  await page.waitForTimeout(1500);

  // 5. Missions page — claimed state
  console.log('\n=== 05. MISSIONS CLAIMED ===');
  await gotoWithToken(`${APP}/missions`, token);

  const cardClaimed = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="mission-card-first_spin"]');
    if (!card) return null;
    return { state: card.getAttribute('data-state'), text: card.innerText?.slice(0, 80) };
  });
  console.log(`First Steps claimed: ${JSON.stringify(cardClaimed)}`);

  await page.screenshot({ path: path.join(shotsDir, '03-mission-claimed.png'), fullPage: true });
  console.log('captured');

  // 6. Wallet
  console.log('\n=== 06. WALLET ===');
  await gotoWithToken(`${APP}/wallet`, token);

  const wl = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  console.log(`Wallet data-page: ${wl || 'MISSING'}`);

  await page.screenshot({ path: path.join(shotsDir, '04-wallet-reward.png'), fullPage: true });
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

  console.log('\n=== MISSION DATA ATTRIBUTES ===');
  console.log(`Page: data-page="${dp}"`);
  console.log(`First Steps (before): ${JSON.stringify(firstCard)}`);
  console.log(`First Steps (after spin): ${JSON.stringify(cardAfter)}`);
  console.log(`First Steps (claimed): ${JSON.stringify(cardClaimed)}`);

  await browser.close();
  console.log('\nE2E MISSIONS: DONE');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
