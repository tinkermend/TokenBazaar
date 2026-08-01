import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.TB_BASE || 'http://127.0.0.1:5173';
const OUT = process.env.UI_OUT || '/tmp/tokenbazaar-logs/ui-verify';
const CHROME =
  process.env.CHROME_PATH ||
  '/Users/tinker/Library/Caches/ms-playwright/chromium-1232/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const ADMIN = { email: 'admin@tokenbazaar.local', password: 'Admin123456!' };
const USER = { email: 'uiuser@example.com', password: 'UiTest1234!' };

fs.mkdirSync(OUT, { recursive: true });

const report = [];

function log(item) {
  report.push(item);
  console.log(JSON.stringify(item));
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function waitReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function login(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page);
  // fill email/password - common selectors
  const email = page.locator('input[type="email"], input[name="email"], input[autocomplete="username"]').first();
  const password = page.locator('input[type="password"]').first();
  await email.fill(creds.email);
  await password.fill(creds.password);
  await page.locator('button[type="submit"], .btn-primary').first().click();
  await page.waitForURL(/dashboard|admin/, { timeout: 20000 }).catch(async () => {
    // maybe 2fa or error
    await page.waitForTimeout(1500);
  });
  await waitReady(page);
}

async function visit(page, route, name) {
  const url = `${BASE}${route}`;
  let status = 'ok';
  let error = null;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    // detect obvious crash/empty
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 200);
    if (/Cannot GET|Internal Server Error|Something went wrong/i.test(bodyText)) {
      status = 'error';
      error = bodyText.slice(0, 120);
    }
    // style signals from PriceAI-aligned theme
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const primaryBtn = page.locator('.btn-primary').first();
    let btnBg = null;
    if (await primaryBtn.count()) {
      btnBg = await primaryBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
    }
    const file = await shot(page, name);
    log({
      name,
      route,
      status,
      error,
      http: resp?.status() ?? null,
      bodyBg: bg,
      primaryBtnBg: btnBg,
      screenshot: file,
      title: await page.title(),
    });
  } catch (e) {
    log({ name, route, status: 'fail', error: String(e).slice(0, 200) });
  }
}

const userRoutes = [
  ['/dashboard', 'user-dashboard'],
  ['/keys', 'user-keys'],
  ['/usage', 'user-usage'],
  ['/redeem', 'user-redeem'],
  ['/affiliate', 'user-affiliate'],
  ['/available-channels', 'user-available-channels'],
  ['/profile', 'user-profile'],
  ['/subscriptions', 'user-subscriptions'],
  ['/orders', 'user-orders'],
  ['/batch-image', 'user-batch-image'],
];

const adminRoutes = [
  ['/admin/dashboard', 'admin-dashboard'],
  ['/admin/ops', 'admin-ops'],
  ['/admin/users', 'admin-users'],
  ['/admin/groups', 'admin-groups'],
  ['/admin/channels/pricing', 'admin-channels-pricing'],
  ['/admin/channels/monitor', 'admin-channels-monitor'],
  ['/admin/subscriptions', 'admin-subscriptions'],
  ['/admin/accounts', 'admin-accounts'],
  ['/admin/announcements', 'admin-announcements'],
  ['/admin/proxies', 'admin-proxies'],
  ['/admin/redeem', 'admin-redeem'],
  ['/admin/promo-codes', 'admin-promo-codes'],
  ['/admin/settings', 'admin-settings'],
  ['/admin/risk-control', 'admin-risk-control'],
  ['/admin/prompt-audit', 'admin-prompt-audit'],
  ['/admin/usage', 'admin-usage'],
  ['/admin/affiliates/invites', 'admin-aff-invites'],
  ['/admin/affiliates/rebates', 'admin-aff-rebates'],
  ['/admin/affiliates/transfers', 'admin-aff-transfers'],
  ['/admin/orders/dashboard', 'admin-orders-dashboard'],
  ['/admin/orders', 'admin-orders'],
  ['/admin/audit-logs', 'admin-audit-logs'],
];

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Auth pages
await visit(page, '/login', 'auth-login');
await visit(page, '/register', 'auth-register');

// User flow
await context.clearCookies();
await page.evaluate(() => localStorage.clear()).catch(() => {});
await login(page, USER);
for (const [route, name] of userRoutes) {
  await visit(page, route, name);
}

// Admin flow
await context.clearCookies();
await page.evaluate(() => localStorage.clear()).catch(() => {});
await login(page, ADMIN);
for (const [route, name] of adminRoutes) {
  await visit(page, route, name);
}

// PriceAI reference shots for comparison
const p2 = await context.newPage();
await p2.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await waitReady(p2);
await shot(p2, 'priceai-home-ref');
await p2.goto('http://127.0.0.1:3000/api-transit', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await waitReady(p2);
await shot(p2, 'priceai-transit-ref');
log({ name: 'priceai-refs', status: 'ok', routes: ['/', '/api-transit'] });

await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const fails = report.filter((r) => r.status && r.status !== 'ok');
console.log('TOTAL', report.length, 'FAILS', fails.length);
if (fails.length) {
  console.log(fails.map((f) => `${f.name}: ${f.error || f.status}`).join('\n'));
  process.exitCode = 1;
}
