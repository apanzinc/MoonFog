import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('MV3 package loads under extension CSP with desktop and Edge Android UA', async ({}, testInfo) => {
  const profile = await mkdtemp(path.join(tmpdir(), 'moonfog-test-'));
  const use = testInfo.project.use;
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    viewport: use.viewport, userAgent: use.userAgent,
    isMobile: use.isMobile, hasTouch: use.hasTouch,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith('chrome-extension:') ? route.continue() : route.abort());
    const entry = new URL('../newtab.html', worker.url().replace('/js/', '/')).href;
    await page.goto(entry);
    await expect(page.locator('#oobe')).toBeVisible();
    expect(await page.evaluate(() => window.MoonFogEnv.isExtension)).toBe(true);
    expect(await page.evaluate(() => window.MoonFogEnv.host)).toBe(testInfo.project.name === 'edge-android' ? 'edge' : 'chrome');
    expect(await page.evaluate(() => window.MoonFogEnv.browserSearch)).toBe(true);
    await page.locator('#oobeSkipBtn').click();
    await expect(page.locator('#oobe')).toBeHidden();
    await page.locator('#settingsBtn').click();
    await expect(page.locator('body')).toHaveClass(/settings-open/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
