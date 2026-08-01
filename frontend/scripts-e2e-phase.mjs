import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const phase = process.argv[2] || 'auth';
const BASE = 'http://127.0.0.1:5173';
const OUT = '/tmp/tokenbazaar-logs/ui-verify';
const CHROME = '/Users/tinker/Library/Caches/ms-playwright/chromium-1232/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
fs.mkdirSync(OUT, { recursive: true });

const ADMIN = { email: 'admin@tokenbazaar.local', password: 'Admin123456!' };
const USER = { email: 'uiuser@example.com', password: 'UiTest1234!' };

async function ready(page) {
  await page.waitForTimeout(600);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const htmlBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  let primaryBtnBg = null;
  const btn = page.locator('.btn-primary').first();
  if (await btn.count()) primaryBtnBg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
  const item = { name, url: page.url(), bodyBg, htmlBg, primaryBtnBg, screenshot: file, title: await page.title() };
  fs.appendFileSync(path.join(OUT, 'report.ndjson'), JSON.stringify(item) + '\n');
  console.log(JSON.stringify(item));
  return item;
}

async function login(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await ready(page);
  await page.locator('input[type="email"], input[name="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await Promise.all([
    page.waitForURL(/dashboard|admin|keys/, { timeout: 25000 }).catch(() => null),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await ready(page);
  // ensure token in localStorage
  const token = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
  if (!token) {
    // try waiting more
    await page.waitForTimeout(2000);
  }
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  if (phase === 'auth') {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await ready(page);
    await shot(page, 'auth-login');
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await ready(page);
    await shot(page, 'auth-register');
  } else if (phase === 'user') {
    await login(page, USER);
    await shot(page, 'user-after-login');
    const routes = [
      ['/dashboard','user-dashboard'],
      ['/keys','user-keys'],
      ['/usage','user-usage'],
      ['/redeem','user-redeem'],
      ['/affiliate','user-affiliate'],
      ['/available-channels','user-available-channels'],
      ['/profile','user-profile'],
      ['/subscriptions','user-subscriptions'],
      ['/orders','user-orders'],
      ['/batch-image','user-batch-image'],
    ];
    for (const [r,n] of routes) {
      await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle', timeout: 30000 });
      await ready(page);
      await shot(page, n);
    }
  } else if (phase === 'admin') {
    await login(page, ADMIN);
    await shot(page, 'admin-after-login');
    const routes = [
      ['/admin/dashboard','admin-dashboard'],
      ['/admin/ops','admin-ops'],
      ['/admin/users','admin-users'],
      ['/admin/groups','admin-groups'],
      ['/admin/channels/pricing','admin-channels-pricing'],
      ['/admin/channels/monitor','admin-channels-monitor'],
      ['/admin/subscriptions','admin-subscriptions'],
      ['/admin/accounts','admin-accounts'],
      ['/admin/announcements','admin-announcements'],
      ['/admin/proxies','admin-proxies'],
      ['/admin/redeem','admin-redeem'],
      ['/admin/promo-codes','admin-promo-codes'],
      ['/admin/settings','admin-settings'],
      ['/admin/risk-control','admin-risk-control'],
      ['/admin/prompt-audit','admin-prompt-audit'],
      ['/admin/usage','admin-usage'],
      ['/admin/affiliates/invites','admin-aff-invites'],
      ['/admin/affiliates/rebates','admin-aff-rebates'],
      ['/admin/affiliates/transfers','admin-aff-transfers'],
      ['/admin/orders/dashboard','admin-orders-dashboard'],
      ['/admin/orders','admin-orders'],
      ['/admin/audit-logs','admin-audit-logs'],
    ];
    for (const [r,n] of routes) {
      await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle', timeout: 30000 });
      await ready(page);
      await shot(page, n);
    }
  } else if (phase === 'priceai') {
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await ready(page);
    await shot(page, 'priceai-home-ref');
    await page.goto('http://127.0.0.1:3000/api-transit', { waitUntil: 'networkidle' });
    await ready(page);
    await shot(page, 'priceai-transit-ref');
  }
} catch (e) {
  console.error('PHASE_ERROR', phase, e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
console.log('PHASE_DONE', phase);
