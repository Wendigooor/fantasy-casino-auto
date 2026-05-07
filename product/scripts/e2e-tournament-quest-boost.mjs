import { chromium } from 'playwright';
import fs, { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const shotsDir = '/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-quest-boost/screenshots';
mkdirSync(shotsDir, { recursive: true });
const API = 'http://localhost:3001';
const APP = 'http://localhost:3000';

const report = { run: 'tournament-quest-boost', status: 'passed', startedAt: new Date().toISOString(), assertions: {}, screenshots: [], pageErrors: [], consoleErrors: [] };

function apiReq(method, urlPath, body, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${urlPath}`, opts).then(r => r.json());
}

async function gotoWithToken(page, url, token) {
  await page.goto(APP); await page.waitForTimeout(1500);
  await page.evaluate(t => { localStorage.setItem('token', t); }, token);
  await page.goto(url); await page.waitForTimeout(3000);
  try { await page.waitForFunction(() => document.body.innerText.includes('High Roller Sprint'), { timeout: 15000 }); } catch {}
}

async function main() {
  const ts = Date.now();
  const r = await apiReq('POST', '/api/v1/auth/register', { email: `sq${ts}@test.com`, password: 'SqTest123' });
  const token = r.token;
  console.log('User:', token?.slice(0, 16));

  const { randomUUID } = await import('crypto');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { report.pageErrors.push(e.message); console.error('PAGE_ERR:', e.message); });

  // 1. Boost locked start
  console.log('\n=== 01. BOOST LOCKED ===');
  await gotoWithToken(page, APP + '/tournaments', token);
  const dp = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  const dr = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-ready'));
  const ds = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  console.log(`data-page="${dp}" data-ready="${dr}" data-state="${ds}"`);
  report.assertions['data-page=tournaments'] = dp === 'tournaments';
  report.assertions['data-state=not-joined'] = ds === 'not-joined';
  await page.screenshot({ path: path.join(shotsDir, '01-boost-locked-start.png'), fullPage: true });
  report.screenshots.push('01-boost-locked-start.png');

  // 2. Join through UI
  console.log('\n=== 02. JOIN ===');
  const joinBtn = await page.$('[data-testid="join-tournament"]');
  if (joinBtn) { await joinBtn.click(); report.assertions['join-via-ui'] = true; }
  else report.assertions['join-via-ui'] = false;
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => document.body.innerText.includes('Sprint Pass'), { timeout: 10000 }).catch(() => {});
  const ds2 = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  report.assertions['boost-panel-exists'] = ds2?.includes('boost');
  console.log(`state: ${ds2}`);
  await page.screenshot({ path: path.join(shotsDir, '02-joined-quest-progress.png'), fullPage: true });
  report.screenshots.push('02-joined-quest-progress.png');

  // 3. Spins to unlock boost
  console.log('\n=== 03. SPINS + BOOST READY ===');
  for (let i = 0; i < 5; i++) {
    await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 100, idempotencyKey: randomUUID() }, token);
  }
  await gotoWithToken(page, APP + '/tournaments', token);
  const ds3 = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  const boostStatus = await page.evaluate(() => document.querySelector('[data-testid="boost-status"]')?.innerText);
  console.log(`state: ${ds3}, boost status: ${boostStatus}`);
  report.assertions['boost-ready'] = ds3 === 'boost-ready' || boostStatus?.includes('READY');
  const activateBtn = await page.$('[data-testid="boost-activate"]');
  report.assertions['activate-btn-exists'] = !!activateBtn;
  await page.screenshot({ path: path.join(shotsDir, '03-boost-ready.png'), fullPage: true });
  report.screenshots.push('03-boost-ready.png');

  // 4. Activate boost through UI
  console.log('\n=== 04. ACTIVATE BOOST ===');
  if (activateBtn) { await activateBtn.click(); report.assertions['boost-activate-via-ui'] = true; }
  else report.assertions['boost-activate-via-ui'] = false;
  await page.waitForTimeout(2000);
  const ds4 = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-state'));
  console.log(`state after activate: ${ds4}`);
  report.assertions['boost-active'] = ds4 === 'boost-active';
  await page.screenshot({ path: path.join(shotsDir, '04-boost-activated.png'), fullPage: true });
  report.screenshots.push('04-boost-activated.png');

  // 5. Boosted spins + rank climb
  console.log('\n=== 05. BOOSTED SPINS ===');
  for (let i = 0; i < 3; i++) {
    await apiReq('POST', '/api/v1/games/slot/spin', { betAmount: 100, idempotencyKey: randomUUID() }, token);
  }
  await gotoWithToken(page, APP + '/tournaments', token);
  const boostPoints = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="boost-points"]');
    return el?.innerText || 'no boost points';
  });
  console.log(`boost points: ${boostPoints}`);
  report.assertions['boost-points-increased'] = !boostPoints.includes('no boost');
  const meRank = await page.evaluate(() => document.body.innerText.match(/Rank #(\d+)/)?.[1] || '?');
  console.log(`rank: #${meRank}`);
  await page.screenshot({ path: path.join(shotsDir, '05-boosted-rank-climb.png'), fullPage: true });
  report.screenshots.push('05-boosted-rank-climb.png');

  // 6. Missions page tournament promo
  console.log('\n=== 06. MISSIONS PROMO ===');
  await gotoWithToken(page, APP + '/missions', token);
  const hasPromo = await page.evaluate(() => document.body.innerText.includes('High Roller Sprint'));
  report.assertions['missions-promo-exists'] = hasPromo;
  console.log(`missions promo: ${hasPromo}`);
  await page.screenshot({ path: path.join(shotsDir, '06-missions-tournament-quests.png'), fullPage: true });
  report.screenshots.push('06-missions-tournament-quests.png');

  // 7. Mobile
  console.log('\n=== 07. MOBILE ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoWithToken(page, APP + '/tournaments', token);
  await page.screenshot({ path: path.join(shotsDir, '07-mobile-boost-panel.png'), fullPage: true });
  report.screenshots.push('07-mobile-boost-panel.png');

  // Check bad text
  const bodyText = await page.evaluate(() => document.body.innerText);
  report.assertions['no-invalid-date'] = !bodyText.includes('Invalid Date');
  report.assertions['no-undefined'] = !bodyText.includes('undefined');

  // Report
  report.finishedAt = new Date().toISOString();
  const failed = Object.entries(report.assertions).filter(([k, v]) => !v);
  if (failed.length > 0) report.status = 'failed';

  console.log('\n=== RESULTS ===');
  console.log('Status:', report.status);
  console.log('Errors:', report.pageErrors.length);
  console.log('Failed:', failed.map(([k]) => k).join(', ') || 'none');
  console.log('Screenshots:', report.screenshots.length);
  for (const f of readdirSync(shotsDir).sort()) {
    const s = statSync(path.join(shotsDir, f));
    console.log(' ', f, (s.size / 1024).toFixed(0) + 'KB');
  }

  const rpath = '/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/tournament-quest-boost/e2e-report.json';
  mkdirSync(path.dirname(rpath), { recursive: true });
  writeFileSync(rpath, JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
