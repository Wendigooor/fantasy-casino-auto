import { chromium } from 'playwright';
import fs, { mkdirSync } from 'fs';
import path from 'path';
const SD = "/Users/iharzvezdzin/Documents/projects/hermes/test/puff/evidence/lightning-rounds/screenshots";
const API = "http://localhost:3001";
const APP = "http://localhost:3000";
const TK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjM5OGE3MmY1LWFkMmQtNDQwMC1iMTRhLTRlYTQ5YmFiNGVkMiIsImVtYWlsIjoibGU0MTc3ODIyMzgzOTk3MEB0ZXN0LmNvbSIsInJvbGUiOiJwbGF5ZXIiLCJpYXQiOjE3NzgyMjM4NDUsImV4cCI6MTc3ODgyODY0NX0.cXbrOoREN917qiQBqkNpVGG647qQDAHcAla8c2XTWgo";
mkdirSync(SD, { recursive: true });
async function main() {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  async function go(url) {
    await p.goto(APP); await p.waitForTimeout(1500);
    await p.evaluate(t => { localStorage.setItem('token', t); }, TK);
    await p.goto(url); await p.waitForTimeout(3000);
    try { await p.waitForFunction(() => document.body.innerText.includes('Lightning'), { timeout: 15000 }); } catch {}
  }
  await go(APP + '/lightning');
  console.log('dp:', await p.evaluate(() => document.querySelector('[data-page]')?.getAttribute('data-page')));
  await p.screenshot({ path: path.join(SD, '01-lightning-active.png'), fullPage: true });
  const btn = await p.$('button:has-text("JOIN")');
  if (btn) { await btn.click(); await p.waitForTimeout(2000); }
  await p.screenshot({ path: path.join(SD, '02-joined-state.png'), fullPage: true });
  const { randomUUID } = await import('crypto');
  for (let i = 0; i < 5; i++) { await fetch(API + '/api/v1/games/slot/spin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TK }, body: JSON.stringify({ betAmount: 100, idempotencyKey: randomUUID() }) }); }
  await go(APP + '/lightning');
  await p.screenshot({ path: path.join(SD, '03-after-spins-score.png'), fullPage: true });
  console.log('3 done');
  for (let i = 0; i < 5; i++) { await fetch(API + '/api/v1/games/slot/spin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TK }, body: JSON.stringify({ betAmount: 100, idempotencyKey: randomUUID() }) }); }
  await go(APP + '/lightning');
  await p.screenshot({ path: path.join(SD, '04-high-score-leaderboard.png'), fullPage: true });
  console.log('4 done');
  await p.close();
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx2.newPage();
  await p2.goto(APP); await p2.waitForTimeout(1500);
  await p2.evaluate(t => { localStorage.setItem('token', t); }, TK);
  await p2.goto(APP + '/lightning'); await p2.waitForTimeout(5000);
  await p2.screenshot({ path: path.join(SD, '05-mobile-lightning.png'), fullPage: true });
  console.log('5 mobile done');
  await b.close();
  console.log('E2E done');
}
main().catch(e => { console.error(e); process.exit(1); });
