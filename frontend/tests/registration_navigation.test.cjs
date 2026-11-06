const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { chromium } = require('playwright-core');

const base = 'http://127.0.0.1:4179';

test('registration preserves company and invitation destinations', { timeout: 60000 }, async () => {
  const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => path && existsSync(path));
  assert.ok(executablePath, 'Set CHROME_PATH to a Chrome or Chromium executable');
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await fetch(base)).ok; if (ready) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Vite did not start');
    browser = await chromium.launch({ headless: true, executablePath });
    for (const invited of [false, true]) {
      const context = await browser.newContext();
      await context.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        if (path === '/api/register') return route.fulfill({ status: 201, json: {} });
        if (path === '/api/login') return route.fulfill({ status: 200, json: { access_token: 'test', user: { id: '1', full_name: 'Test User', email: 'test@example.com' } } });
        if (path === '/api/companies/review') return route.fulfill({ status: 403, json: {} });
        return route.fulfill({ status: 200, json: [] });
      });
      const page = await context.newPage();
      if (invited) {
        await page.goto(base + '/company-invitation/test-token');
        await page.waitForURL('**/login');
        await page.locator('a[href="/register"]').click();
      } else {
        await page.goto(base + '/register');
        await page.locator('input[value="company"]').check();
      }
      await page.locator('#fullName').fill('Test User');
      await page.locator('#email').fill('test@example.com');
      await page.locator('#password').fill('Password123!');
      await page.locator('#confirmPassword').fill('Password123!');
      await page.locator('input[type="checkbox"]').check();
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(invited ? '**/company-invitation/test-token' : '**/companies');
      await page.waitForTimeout(500);
      assert.equal(new URL(page.url()).pathname, invited ? '/company-invitation/test-token' : '/companies');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
});
