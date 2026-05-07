import { chromium } from 'playwright';
import fs, { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const shotsDir = '/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-mini-league/screenshots';
mkdirSync(shotsDir, { recursive: true });

const API = 'http://localhost:3001';
const APP = 'http://localhost:3000';

const report = {
  run: 'tournament-mini-league',
  status: 'passed',
  startedAt: new Date().toISOString(),
  assertions: {},
  screenshots: [],
  initialPoints: 0,
  finalPoints: 0,
  initialRank: null,
  finalRank: null,
  rankImproved: false,
  pageErrors: [],
  consoleErrors: [],
  notes: [],
};

function apiReq(method, urlPath, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${urlPath}`, opts).then(r => r.json());
}

async function gotoWithToken(page, url, token) {
  await page.goto(APP);
  await page.waitForTimeout(2000);
  await page.evaluate(t => { localStorage.setItem('token', t); }, token);
  await page.goto(url);
  await page.waitForTimeout(3000);
  // Wait for actual content to render
  try {
    await page.waitForFunction(() => document.body.innerText.includes('High Roller Sprint'), { timeout: 15000 });
    console.log('Content loaded');
  } catch {
    console.log('WARNING: Content not loaded within timeout');
  }
}

async function main() {
  const ts = Date.now();
  const r = await apiReq('POST', '/api/v1/auth/register', { email: `tn${ts}@test.com`, password: 'Tour1234' });
  const token = r.token;
  console.log('User:', token?.slice(0, 16));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { report.pageErrors.push(e.message); console.error('PAGE_ERR:', e.message); });
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });

  // 1. Tournament hub
  console.log('\n=== 01. HUB ===');
  await gotoWithToken(page, APP + '/tournaments', token);
  const dp = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  const dr = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-ready'));
  const ds = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  const hero = await page.evaluate(() => document.querySelector('h2')?.innerText);
  console.log('data-page:', dp, 'data-ready:', dr, 'data-state:', ds, 'hero:', hero);
  report.assertions['data-page=tournaments'] = dp === 'tournaments';
  report.assertions['data-ready=true'] = dr === 'true';
  report.assertions['data-state=not-joined'] = ds === 'not-joined';

  const joinBtn = await page.$('[data-testid="join-tournament"]');
  report.assertions['join-button-exists'] = !!joinBtn;
  console.log('Join button:', !!joinBtn);

  await page.screenshot({ path: path.join(shotsDir, '01-tournament-hub-start.png'), fullPage: true });
  report.screenshots.push('01-tournament-hub-start.png');

  // 2. Join
  console.log('\n=== 02. JOIN ===');
  if (joinBtn) {
    await joinBtn.click();
    console.log('Clicked join');
    report.assertions['join-via-ui'] = true;
  } else {
    report.assertions['join-via-ui'] = false;
  }
  await page.waitForTimeout(3000);
  // Wait for either data-state change or content update
  try {
    await page.waitForFunction(() => document.body.innerText.includes('✓ Joined') || document.body.innerText.includes('PLAY SLOTS'), { timeout: 10000 });
  } catch {}
  
  const ds2 = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  report.assertions['data-state=joined'] = ds2 === 'joined' || ds2 === 'scored';
  console.log('state after join:', ds2);

  await page.screenshot({ path: path.join(shotsDir, '02-joined-state.png'), fullPage: true });
  report.screenshots.push('02-joined-state.png');

  // Record initial
  const d1 = await apiReq('GET', '/api/v1/tournaments/active', null, token);
  report.initialRank = d1.me?.rank;
  report.initialPoints = d1.me?.points;
  console.log('Initial rank:', report.initialRank, 'points:', report.initialPoints);

  // 3. Spins
  console.log('\n=== 03. SPINS ===');
  const { randomUUID } = await import('crypto');
  for (let i = 0; i < 10; i++) {
    await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 100, idempotencyKey: randomUUID() }, token);
  }
  console.log('10 spins done');

  // Navigate fresh to tournaments
  await gotoWithToken(page, APP + '/tournaments', token);
  await page.waitForTimeout(2000);
  
  const d2 = await apiReq('GET', '/api/v1/tournaments/active', null, token);
  report.finalRank = d2.me?.rank;
  report.finalPoints = d2.me?.points;
  report.rankImproved = report.finalRank !== null && report.initialRank !== null && report.finalRank < report.initialRank;
  console.log('Final rank:', report.finalRank, 'points:', report.finalPoints, 'improved:', report.rankImproved);
  report.assertions['points-increased'] = report.finalPoints > report.initialPoints;
  report.assertions['current-user-row-exists'] = !!d2.leaderboard.find(e => e.isCurrentUser);
  report.assertions['leaderboard-count>=8'] = d2.leaderboard.length >= 8;

  await page.screenshot({ path: path.join(shotsDir, '03-after-spins-rank-climb.png'), fullPage: true });
  report.screenshots.push('03-after-spins-rank-climb.png');

  // 4. Podium + prizes
  const prizeLadder = await page.$('[data-testid="prize-ladder"]');
  report.assertions['prize-ladder-exists'] = !!prizeLadder;
  const podium3 = await page.evaluate(() => document.body.innerText.includes('🥇') && document.body.innerText.includes('🥈'));
  report.assertions['podium-exists'] = podium3;

  await page.screenshot({ path: path.join(shotsDir, '04-podium-and-prize-ladder.png'), fullPage: true });
  report.screenshots.push('04-podium-and-prize-ladder.png');

  // 5. Current user highlight
  await page.screenshot({ path: path.join(shotsDir, '05-current-user-highlight.png'), fullPage: true });
  report.screenshots.push('05-current-user-highlight.png');

  // 6. Mobile
  console.log('\n=== 06. MOBILE ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoWithToken(page, APP + '/tournaments', token);
  await page.screenshot({ path: path.join(shotsDir, '06-mobile-tournament-hub.png'), fullPage: true });
  report.screenshots.push('06-mobile-tournament-hub.png');

  // Check bad text
  const bodyText = await page.evaluate(() => document.body.innerText);
  report.assertions['no-invalid-date'] = !bodyText.includes('Invalid Date');
  report.assertions['no-undefined'] = !bodyText.includes('undefined');
  report.assertions['no-nan'] = !bodyText.includes('NaN');

  // Report
  report.finishedAt = new Date().toISOString();
  const failed = Object.entries(report.assertions).filter(([k, v]) => !v);
  if (failed.length > 0) report.status = 'failed';

  console.log('\n=== RESULTS ===');
  console.log('Status:', report.status);
  console.log('Rank:', report.initialRank, '->', report.finalRank, 'improved:', report.rankImproved);
  console.log('Points:', report.initialPoints, '->', report.finalPoints);
  console.log('Page errors:', report.pageErrors.length);
  console.log('Failed assertions:', failed.map(([k]) => k).join(', ') || 'none');

  for (const f of readdirSync(shotsDir).sort()) {
    const s = statSync(path.join(shotsDir, f));
    console.log(' ', f, (s.size / 1024).toFixed(0) + 'KB');
  }

  const rpath = '/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-mini-league/e2e-report.json';
  mkdirSync(path.dirname(rpath), { recursive: true });
  writeFileSync(rpath, JSON.stringify(report, null, 2));

  await browser.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
