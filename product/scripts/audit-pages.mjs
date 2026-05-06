import { chromium } from 'playwright';
import path from 'path';

const API = 'http://localhost:3001';
const APP = 'http://localhost:3000';

async function main() {
  const ts = Date.now();
  const r = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `vis${ts}@test.com`, password: 'Vis12345' })
  });
  const d = await r.json();
  const token = d.token;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const pages = [
    { url: '/duels', name: 'Lobby' },
    { url: '/duels/some-id', name: 'Duel' },
    { url: '/player', name: 'Player' },
    { url: '/leaderboard', name: 'Leaderboard' },
  ];

  const results = [];
  for (const p of pages) {
    await page.goto(APP);
    await page.waitForTimeout(1000);
    await page.evaluate(t => { localStorage.setItem('token', t); }, token);
    await page.goto(`${APP}${p.url}`);
    await page.waitForTimeout(3000);

    const info = await page.evaluate(() => {
      const dataPage = document.querySelector('[data-page]')?.getAttribute('data-page') || null;
      const dataState = document.querySelector('[data-state]')?.getAttribute('data-state') || null;
      const text = document.body.innerText || '';
      const elCount = document.querySelectorAll('button, a, input, select, [role="button"], img, table, tr').length;
      const totalEls = document.querySelectorAll('*').length;
      const primaryBtn = document.querySelector('[class*="btn-primary"], button:not([class*="ghost"])')?.innerText?.slice(0, 50) || null;
      // Check for common empty/loading signs
      const hasSkeleton = document.querySelector('.skeleton, [class*="skeleton"], [class*="loading"]') !== null;
      const hasLoginForm = document.querySelector('input[type="email"], input[type="password"]') !== null;
      const hasError = text.includes('error') || text.includes('Error') || text.includes('not found');
      return { textLength: text.length, interactiveEls: elCount, totalEls, dataPage, dataState, primaryBtn, hasSkeleton, hasLoginForm, hasError };
    });

    console.log(`\n=== ${p.name} (${p.url}) ===`);
    console.log(`  data-page: ${info.dataPage || 'MISSING'}`);
    console.log(`  data-state: ${info.dataState || '—'}`);
    console.log(`  Text: ${info.textLength} chars`);
    console.log(`  Interactive elements: ${info.interactiveEls}`);
    console.log(`  Total DOM nodes: ${info.totalEls}`);
    console.log(`  Skeleton/loading: ${info.hasSkeleton}`);
    console.log(`  Login form visible: ${info.hasLoginForm}`);
    console.log(`  Error visible: ${info.hasError}`);
    console.log(`  Primary CTA: ${info.primaryBtn || 'none'}`);
    console.log(`  Verdict: ${info.hasLoginForm ? 'LOGIN PAGE' : info.hasSkeleton ? 'LOADING' : info.hasError ? 'ERROR' : info.textLength < 50 ? 'EMPTY' : 'CONTENT PRESENT'}`);

    results.push({ name: p.name, ...info });
  }

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    const status = r.hasLoginForm ? '🔴 LOGIN' : r.hasSkeleton ? '🟡 LOADING' : r.hasError ? '🔴 ERROR' : r.textLength < 100 ? '🟡 SPARSE' : '✅ OK';
    console.log(`${status} ${r.name}: ${r.textLength}chars, ${r.interactiveEls} interactive, data-page=${r.dataPage}`);
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
