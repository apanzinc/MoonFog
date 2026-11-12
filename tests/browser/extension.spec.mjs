import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('MV3 package loads under extension CSP with desktop and Edge Android UA', async ({}, testInfo) => {
  const profile = await mkdtemp(path.join(tmpdir(), 'moonfog-test-'));
  const use = testInfo.project.use;
  let extensionRoot = root;
  if (testInfo.project.name === 'edge-android') {
    const out = path.join(profile, 'pack');
    await promisify(execFile)(process.execPath, ['scripts/pack-extension.mjs', '--target', 'edge-mobile', '--out', out], { cwd: root });
    const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    extensionRoot = path.join(profile, 'extension');
    await promisify(execFile)('unzip', ['-q', path.join(out, `MoonFog-${manifest.version}-edge-mobile.zip`), '-d', extensionRoot]);
  }
  const context = await chromium.launchPersistentContext(path.join(profile, 'browser'), {
    channel: 'chromium', headless: true,
    viewport: use.viewport, userAgent: use.userAgent,
    isMobile: use.isMobile, hasTouch: use.hasTouch,
    args: [`--disable-extensions-except=${extensionRoot}`, `--load-extension=${extensionRoot}`]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith('chrome-extension:') ? route.continue() : route.abort());
    const entry = new URL('../newtab.html', worker.url()).href;
    await page.goto(entry);
    await expect(page.locator('#oobe')).toBeVisible();
    expect(await page.evaluate(() => window.MoonFogEnv.isExtension)).toBe(true);
    expect(await page.evaluate(() => window.MoonFogEnv.host)).toBe(testInfo.project.name === 'edge-android' ? 'edge' : 'chrome');
    expect(await page.evaluate(() => window.MoonFogEnv.browserSearch)).toBe(true);
    if (testInfo.project.name === 'edge-android') {
      expect(await page.evaluate(() => chrome.runtime.getManifest().permissions.includes('fontSettings'))).toBe(false);
      expect((await page.evaluate(() => listSystemFonts())).length).toBeGreaterThan(0);
    }
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
