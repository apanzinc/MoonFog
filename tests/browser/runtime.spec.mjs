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
  expect(await page.evaluate(async () => {
    window.greetingWrites = 0;
    updateGreetingDisplay(); updateGreetingDisplay();
    await Promise.resolve();
    return window.greetingWrites;
  })).toBe(0);
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

test('reusing the current video still applies a changed global mute setting', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const wp = window.MoonFogWp;
    wp.engine.cleanup();
    const create = document.createElement.bind(document);
    let video;
    let creates = 0;
    document.createElement = function (name, ...args) {
      const el = create(name, ...args);
      if (name === 'video') {
        video = el; creates++;
        Object.defineProperty(el, 'src', { set() {} });
        el.play = () => Promise.resolve(); el.pause = el.load = () => {};
      }
      return el;
    };
    let mute = 'follow';
    wp.spec.get = () => ({ strategy: { kind: 'fixed', itemId: 'video' }, globals: { mute } });
    wp.sources.resolveStrategy = async () => ({ id: 'video', kind: 'video' });
    wp.library.resolveItemUrl = async () => 'https://example.test/video.mp4';
    const pending = wp.engine.render();
    while (!video) await Promise.resolve();
    video.dispatchEvent(new Event('loadeddata'));
    await pending;
    const initial = video.muted;
    mute = 'allow';
    await wp.engine.render();
    document.createElement = create;
    return { initial, after: video.muted, creates };
  });
  expect(result).toEqual({ initial: true, after: false, creates: 1 });
});

test('delegated grain animation has no duplicate engine frame loop', async ({ page }) => {
  expect(await page.evaluate(() => {
    const handle = window.MoonFogWp.effects.get('grain').mount(null, {});
    return typeof handle.render;
  })).toBe('undefined');
});

test('late palette failure cannot recolor a solid background after switching away', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let displayed = 'https://example.test/old.jpg';
    getDisplayedWallpaperUrl = () => displayed;
    let reject;
    loadImageForPalette = () => new Promise((_resolve, fail) => { reject = fail; });
    const pending = applyPaletteForUrl(displayed);
    displayed = '';
    clearImagePalette();
    reject(new Error('late image failure'));
    await pending;
    return { url: lastPaletteUrl, hasPalette: !!lastPalette, scene: document.body.classList.contains('img-scene-dark') };
  });
  expect(result).toEqual({ url: '', hasPalette: false, scene: false });
});

test('mobile startup leaves the keyboard closed and settings can be tapped', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'edge-android', 'touch-only behavior');
  expect(await page.evaluate(() => document.activeElement.id)).not.toBe('searchInput');
  await page.locator('#settingsBtn').tap();
  await expect(page.locator('body')).toHaveClass(/settings-open/);
});
