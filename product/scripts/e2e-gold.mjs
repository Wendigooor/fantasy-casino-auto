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
  // Register two users
  const r1 = await apiReq('POST', '/api/v1/auth/register', { email: `gold${ts}@test.com`, password: 'PvpTest123' });
  const r2 = await apiReq('POST', '/api/v1/auth/register', { email: `silver${ts}@test.com`, password: 'PvpTest123' });
  const t1 = r1.token;
  const t2 = r2.token;
  const u1 = r1.user?.id;
  const u2 = r2.user?.id;
  console.log(`User A: ${u1?.slice(0,8)} token: ${t1?.slice(0,16)}...`);
  console.log(`User B: ${u2?.slice(0,8)} token: ${t2?.slice(0,16)}...`);

  // Create duel from A (API expects gameId + betAmount)
  const duel = await apiReq('POST', '/api/v1/duels', { gameId: 'slot-basic', betAmount: 100 }, t1);
  const duelId = duel.id;
  console.log(`Duel created: ${duelId} (status: ${duel.status})`);

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

  // 1. LOBBY — list of duels
  console.log('\n=== 01. LOBBY ===');
  await gotoWithToken(`${APP}/duels`, t1);
  const dp = await page.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page'));
  console.log(`data-page: ${dp || 'MISSING'}`);
  if (!dp) {
    // Debug: what does the body look like?
    const debug = await page.evaluate(() => document.body.innerHTML?.slice(0, 300));
    console.log('Body:', debug);
  }
  await page.screenshot({ path: path.join(shotsDir, '01-lobby.png'), fullPage: true });
  console.log('captured');

  // 2. DUEL — waiting for opponent
  console.log('\n=== 02. DUEL (waiting) ===');
  await gotoWithToken(`${APP}/duels/${duelId}`, t1);
  const ds = await page.evaluate(() => {
    const el = document.querySelector('[data-page="duel"]');
    return el ? { page: el.getAttribute('data-page'), state: el.getAttribute('data-state') } : null;
  });
  console.log(`data: ${JSON.stringify(ds)}`);
  await page.screenshot({ path: path.join(shotsDir, '02-waiting.png'), fullPage: true });
  console.log('captured');

  // 3. PROFILE
  console.log('\n=== 03. PROFILE ===');
  await gotoWithToken(`${APP}/player`, t1);
  const pp = await page.evaluate(() => document.querySelector('[data-page="player"]')?.getAttribute('data-page'));
  console.log(`data-page: ${pp || 'MISSING'}`);
  await page.screenshot({ path: path.join(shotsDir, '03-player.png'), fullPage: true });
  console.log('captured');

  // 4. LEADERBOARD (empty)
  console.log('\n=== 04. LEADERBOARD ===');
  await gotoWithToken(`${APP}/leaderboard`, t1);
  const lb = await page.evaluate(() => document.querySelector('[data-page="leaderboard"]')?.getAttribute('data-page'));
  console.log(`data-page: ${lb || 'MISSING'}`);
  await page.screenshot({ path: path.join(shotsDir, '04-leaderboard.png'), fullPage: true });
  console.log('captured');

  // 5. SETTLEMENT — B accepts, both spin
  console.log('\n=== 05. SETTLEMENT ===');
  // Accept as B
  const acceptResult = await apiReq('POST', `/api/v1/duels/${duelId}/accept`, {}, t2);
  console.log(`Accept: ${acceptResult.status || acceptResult.error || JSON.stringify(acceptResult).slice(0, 80)}`);

  // Both spin with retry
  const spinB = await apiReq('POST', `/api/v1/duels/${duelId}/spin`, {}, t2);
  console.log(`Spin B: ${spinB.status || Object.keys(spinB).slice(0,5).join(',')}`);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // Retry A's spin up to 3 times with backoff
  let spinA;
  for (let attempt = 0; attempt < 3; attempt++) {
    spinA = await apiReq('POST', `/api/v1/duels/${duelId}/spin`, {}, t1);
    if (!spinA.error) break;
    console.log(`  Spin A attempt ${attempt + 1}: ${spinA.error}`);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`Spin A: ${spinA?.status || (spinA?.error ? `FAIL: ${spinA.error}` : Object.keys(spinA || {}).slice(0,5).join(','))}`);
  
  await new Promise(r => setTimeout(r, 3000));

  // View settled duel
  await gotoWithToken(`${APP}/duels/${duelId}`, t1);
  await page.waitForTimeout(3000);
  const dsFinal = await page.evaluate(() => {
    const el = document.querySelector('[data-page="duel"]');
    return el ? { state: el.getAttribute('data-state') } : null;
  });
  console.log(`Settled state: ${JSON.stringify(dsFinal)}`);
  await page.screenshot({ path: path.join(shotsDir, '05-settled.png'), fullPage: true });
  console.log('captured');

  // 6. LEADERBOARD with data
  console.log('\n=== 06. LEADERBOARD (with data) ===');
  await gotoWithToken(`${APP}/leaderboard`, t1);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotsDir, '06-leaderboard-data.png'), fullPage: true });
  console.log('captured');

  // Report
  console.log('\n=== QUALITY REPORT ===');
  const sizes = [];
  let totalKb = 0;
  for (const f of readdirSync(shotsDir).sort()) {
    const s = statSync(path.join(shotsDir, f));
    const kb = (s.size / 1024).toFixed(0);
    sizes.push({ name: f, kb });
    totalKb += parseInt(kb);
  }
  for (const s of sizes) console.log(`  ${s.name}: ${s.kb}KB`);
  console.log(`Total: ${totalKb}KB across ${sizes.length} screenshots`);
  
  const weak = sizes.filter(s => parseInt(s.kb) < 100);
  if (weak.length > 0) {
    console.log(`WEAK: ${weak.map(s => s.name).join(', ')} (< 100KB — likely login/empty page)`);
  } else {
    console.log('All screenshots >100KB — PASS');
  }

  console.log('\n=== DATA ATTRIBUTES ===');
  console.log(`LOBBY: data-page="${dp}"`);
  console.log(`DUEL: ${JSON.stringify(ds)}`);
  if (dsFinal) console.log(`DUEL (settled): ${JSON.stringify(dsFinal)}`);
  console.log(`PLAYER: data-page="${pp}"`);
  console.log(`LEADERBOARD: data-page="${lb}"`);

  await browser.close();
  console.log('\nE2E GOLD: DONE');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
