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

for (const failure of ['video-timeout', 'video-error', 'image-error']) {
  test(`a ${failure} preserves the working image and releases the failed candidate`, async ({ page }) => {
    await page.clock.install();
    await page.evaluate(async () => {
      const wp = window.MoonFogWp;
      const url = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#224466"/></svg>');
      wp.sources.resolveStrategy = async () => ({ id: 'working', kind: 'image', url });
      await wp.engine.render();
      window.workingImage = document.querySelector('#wallpaperMediaInner img');
    });
    await page.evaluate(failure => {
      const wp = window.MoonFogWp;
      const create = document.createElement.bind(document);
      window.failedReleases = 0;
      window.failedPlays = 0;
      document.createElement = function (name, ...args) {
        const el = create(name, ...args);
        if (name === 'video') {
          window.failedCandidate = el;
          Object.defineProperty(el, 'src', { set() {} });
          el.pause = () => {};
          el.load = () => { window.failedReleases++; };
          el.play = () => { window.failedPlays++; return Promise.resolve(); };
        }
        return el;
      };
      wp.sources.resolveStrategy = async () => ({ id: 'broken', kind: failure.startsWith('image') ? 'image' : 'video', url: 'data:image/png;base64,AAAA' });
      window.failedRender = wp.engine.render();
    }, failure);
    if (failure.startsWith('video')) {
      await page.waitForFunction(() => window.failedCandidate);
      expect(await page.evaluate(() => window.workingImage.isConnected)).toBe(true);
      if (failure === 'video-timeout') await page.clock.runFor(9001);
      else await page.evaluate(() => window.failedCandidate.dispatchEvent(new Event('error')));
    }
    const result = await page.evaluate(async () => {
      await window.failedRender;
      return { id: window.MoonFogWp.engine.getCurrent()?.id, same: document.querySelector('#wallpaperMediaInner img') === window.workingImage,
        visible: document.documentElement.classList.contains('wp-media-live'), releases: window.failedReleases, plays: window.failedPlays };
    });
    expect(result).toEqual({ id: 'working', same: true, visible: true, releases: failure.startsWith('video') ? 1 : 0, plays: 0 });
  });
}

test('failed initial media still falls back to the theme solid background', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const wp = window.MoonFogWp;
    wp.engine.cleanup();
    wp.sources.resolveStrategy = async () => ({ id: 'broken', kind: 'image', url: 'data:image/png;base64,AAAA' });
    await wp.engine.render();
    return { kind: wp.engine.getCurrent()?.kind, color: wp.engine.getCurrent()?.color };
  });
  expect(result).toEqual({ kind: 'solid', color: 'var(--bg-warm)' });
});

test('normalized wallpaper URLs apply palettes and delayed sampling rejects switched backgrounds', async ({ page }) => {
  await page.route('http://localhost:8132/palette.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#244466"/></svg>' }));
  const url = 'http://LOCALHOST:8132/palette.svg';
  await page.evaluate(async url => {
    window.MoonFogWp.sources.resolveStrategy = async () => ({ id: 'normalized-image', kind: 'image', url });
    await window.MoonFogWp.engine.render();
  }, url);
  await expect(page.locator('body')).toHaveClass(/img-scene-(dark|light)/);
  expect(await page.evaluate(url => isDisplayedWallpaperUrl(url), url)).toBe(true);
  expect(await page.evaluate(() => isDisplayedWallpaperUrl('http://localhost:8132/other.svg'))).toBe(false);
  const sampled = await page.evaluate(url => {
    const applied = [];
    let displayed = getDisplayedWallpaperUrl();
    getDisplayedWallpaperUrl = () => displayed;
    whenBgEnterSettled = callback => callback();
    applyPaletteForUrl = value => applied.push(value);
    localStorage.setItem('moonfog_bg_palette', JSON.stringify({ text: '#fff', v: 4 }));
    for (const idle of [true, false]) {
      const callbacks = [];
      window.requestIdleCallback = idle ? callback => callbacks.push(callback) : undefined;
      const timeout = window.setTimeout;
      window.setTimeout = (callback, ms, ...args) => ms === 1200 ? callbacks.push(callback) : timeout(callback, ms, ...args);
      samplePaletteSoon(url);
      callbacks.shift()?.();
      samplePaletteSoon(url);
      displayed = 'http://localhost:8132/other.svg';
      callbacks.shift()?.();
      displayed = new URL(url).href;
      window.setTimeout = timeout;
    }
    return applied;
  }, url);
  expect(sampled).toEqual([url, url]);
});

test('closing suggestions aborts a controlled request and ignores its late browser result', async ({ page }) => {
  await page.evaluate(() => {
    window.suggestionRequests = [];
    currentSuggestProviders = () => ['bing'];
    isSearchSuggestEnabled = () => true;
    isShortcutSuggestEnabled = () => false;
    fetchSuggestFromEndpoint = (_provider, query, signal) => new Promise(resolve => {
      window.suggestionRequests.push({ query, signal, resolve });
    });
  });
  await page.locator('#searchInput').fill('old query');
  await page.waitForFunction(() => window.suggestionRequests.length === 1);
  await page.locator('#searchInput').press('Escape');
  expect(await page.evaluate(() => window.suggestionRequests[0].signal.aborted)).toBe(true);
  await page.evaluate(() => window.suggestionRequests[0].resolve(['late old result']));
  await expect(page.locator('#searchSuggest')).toBeHidden();
  await page.locator('#searchInput').fill('new query');
  await page.waitForFunction(() => window.suggestionRequests.length === 2);
  await page.evaluate(() => window.suggestionRequests[1].resolve(['new result']));
  await expect(page.locator('#searchSuggest')).toBeVisible();
  await expect(page.locator('#searchSuggest')).toContainText('new result');
  await expect(page.locator('#searchSuggest')).not.toContainText('late old result');
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

test('mobile search still follows keyboard resize and restores after dismissal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'edge-android', 'touch-only keyboard behavior');
  const size = page.viewportSize();
  await page.locator('#searchInput').tap();
  await page.setViewportSize({ width: size.width, height: 500 });
  await expect(page.locator('body')).toHaveClass(/kb-open/);
  await expect(page.locator('body')).not.toHaveClass(/kb-busy/);
  const top = await page.locator('.content > .search-section').evaluate(el => el.getBoundingClientRect().top);
  expect(Math.abs(top - 14)).toBeLessThan(2);
  await page.setViewportSize(size);
  await expect(page.locator('body')).not.toHaveClass(/kb-open/);
  await expect(page.locator('html')).not.toHaveClass(/kb-hpin/);
});
