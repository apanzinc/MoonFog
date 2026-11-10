import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8132/') ? route.continue() : route.abort());
  await page.addInitScript(() => localStorage.setItem('moonfog_oobe_done', '1'));
  await page.goto('/?raw=1');
  await page.waitForFunction(() => window.MoonFogWp?.engine?.getCurrent());
});

test('pure color stays idle after startup instead of scheduling empty frames', async ({ page }) => {
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    window.idleFrames = 0;
    window.greetingWrites = 0;
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = callback => raf(time => { window.idleFrames++; callback(time); });
    new MutationObserver(records => window.greetingWrites += records.length)
      .observe(document.getElementById('greeting'), { childList: true, characterData: true, subtree: true });
  });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.idleFrames)).toBe(0);
  expect(await page.evaluate(() => window.greetingWrites)).toBe(0);
});

test('slow old video URL cannot remove a newer solid background', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const wp = window.MoonFogWp;
    wp.engine.cleanup();
    let next = { id: 'slow-video', kind: 'video' };
    wp.sources.resolveStrategy = async () => next;
    let resolve;
    wp.library.resolveItemUrl = () => new Promise(done => { resolve = done; });
    const oldRender = wp.engine.render();
    await Promise.resolve();
    await Promise.resolve();
    next = { id: 'new-solid', kind: 'solid', color: '#123456' };
    await wp.engine.render();
    resolve('data:video/mp4;base64,AAAA');
    await oldRender;
    return { id: wp.engine.getCurrent()?.id, solid: document.documentElement.classList.contains('wp-solid-bg') };
  });
  expect(result).toEqual({ id: 'new-solid', solid: true });
});

test('superseded detached video is released and never autoplays', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const wp = window.MoonFogWp;
    wp.engine.cleanup();
    const create = document.createElement.bind(document);
    let candidate;
    let releases = 0;
    let plays = 0;
    document.createElement = function (name, ...args) {
      const el = create(name, ...args);
      if (name === 'video') {
        candidate = el;
        Object.defineProperty(el, 'src', { set() {} });
        el.play = () => { plays++; return Promise.resolve(); };
        el.pause = () => {};
        el.load = () => { releases++; };
      }
      return el;
    };
    let next = { id: 'video', kind: 'video' };
    wp.sources.resolveStrategy = async () => next;
    wp.library.resolveItemUrl = async () => 'https://example.test/slow.mp4';
    const oldRender = wp.engine.render();
    while (!candidate) await Promise.resolve();
    const autoplay = candidate.autoplay;
    next = { id: 'solid', kind: 'solid' };
    await wp.engine.render();
    candidate.dispatchEvent(new Event('loadeddata'));
    await oldRender;
    document.createElement = create;
    return { autoplay, releases, plays, id: wp.engine.getCurrent()?.id };
  });
  expect(result).toEqual({ autoplay: false, releases: 1, plays: 0, id: 'solid' });
});

test('delegated grain animation has no duplicate engine frame loop', async ({ page }) => {
  expect(await page.evaluate(() => {
    const handle = window.MoonFogWp.effects.get('grain').mount(null, {});
    return typeof handle.render;
  })).toBe('undefined');
});

test('mobile startup leaves the keyboard closed and settings can be tapped', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'edge-android', 'touch-only behavior');
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('searchInput');
  await page.locator('#settingsBtn').tap();
  await expect(page.locator('body')).toHaveClass(/settings-open/);
});
