import { test, expect } from '@playwright/test';

const fixtureImage = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#244466"/></svg>');
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8132/') ? route.continue() : route.abort());
  await page.goto('/?raw=1');
  await expect(page.locator('#oobe')).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page)).toEqual([]); });

async function next(page) {
  await page.locator('#oobeNextBtn').click();
}
async function choose(page, name, value) {
  await page.locator(`input[name="${name}"][value="${value}"]`).check();
}

test('bundled development entry also boots and exits onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#oobe')).toBeVisible();
  await page.locator('#oobeSkipBtn').click();
  await expect(page.locator('#oobe')).toBeHidden();
  await expect(page.locator('#searchInput')).toBeVisible();
});

test('first run completes, persists preferences, and does not replay on reload', async ({ page }) => {
  await next(page);
  await choose(page, 'oobeTone', 'sky');
  await next(page);
  await choose(page, 'oobeMode', 'dark');
  await next(page);
  await choose(page, 'oobeGreeting', 'custom');
  await page.locator('#oobeCustomInput').fill('今天也要慢慢来');
  await page.locator('#oobeCustomInput').press('ArrowLeft');
  await expect(page.locator('#oobeTitle')).toContainText('开场白');
  await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  await expect(page.locator('#greeting')).toHaveText('今天也要慢慢来');
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'sky');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.reload();
  await expect(page.locator('#oobe')).toBeHidden();
  await expect(page.locator('#greeting')).toHaveText('今天也要慢慢来');
  await expect(page.locator('html')).not.toHaveClass(/boot-oobe-pending/);
});

test('draft edits are discarded by reload without an unload rollback', async ({ page }) => {
  const original = await page.evaluate(() => ({ tone: localStorage.getItem('moonfog_tone'), mode: localStorage.getItem('moonfog_mode_pref') }));
  await next(page); await choose(page, 'oobeTone', 'rose');
  await next(page); await choose(page, 'oobeMode', 'dark');
  expect(await page.evaluate(() => ({ tone: localStorage.getItem('moonfog_tone'), mode: localStorage.getItem('moonfog_mode_pref') }))).toEqual(original);
  await page.reload();
  await expect(page.locator('#oobeTitle')).toContainText('刚刚好');
  expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBeNull();
});

test('skip preserves current settings even after editing the draft', async ({ page }) => {
  await page.waitForFunction(() => window.MoonFogWp?.engine?.getCurrent());
  const before = await page.evaluate(() => ({ spec: localStorage.getItem('moonfog_wallpaper_spec'), bg: localStorage.getItem('moonfog_bg_mode') }));
  await next(page); await choose(page, 'oobeBackground', 'grain');
  await page.locator('#oobeSkipBtn').click();
  await expect(page.locator('#oobe')).toBeHidden();
  expect(await page.evaluate(() => ({ spec: localStorage.getItem('moonfog_wallpaper_spec'), bg: localStorage.getItem('moonfog_bg_mode') }))).toEqual(before);
});

test('local image is validated, saved to the wallpaper library and survives reload', async ({ page }) => {
  await next(page); await choose(page, 'oobeBackground', 'local');
  await expect(page.locator('#oobeNextBtn')).toBeDisabled();
  await page.locator('#oobeLocalInput').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('#oobeStatus')).toContainText('请选择图片');
  await expect(page.locator('#oobeNextBtn')).toBeDisabled();
  await page.locator('#oobeLocalInput').setInputFiles({ name: 'wallpaper.svg', mimeType: 'image/svg+xml', buffer: fixtureImage });
  await expect(page.locator('#oobeStatus')).toContainText('已选择');
  await expect(page.locator('#oobePreviewImage')).toBeVisible();
  await next(page); await next(page); await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  await page.waitForFunction(() => window.MoonFogWp.engine.getCurrent()?.kind === 'image');
  await expect(page.locator('body')).toHaveClass(/img-scene-(dark|light)/);
  const id = await page.evaluate(() => window.MoonFogWp.engine.getCurrent().id);
  await page.reload();
  await page.waitForFunction(id => window.MoonFogWp?.engine?.getCurrent()?.id === id, id);
  expect(await page.evaluate(() => window.MoonFogWp.library.listItems('image').length)).toBe(1);
});

test('grain background selection persists in the new strategy, not just the legacy key', async ({ page }) => {
  await next(page); await choose(page, 'oobeBackground', 'grain');
  await next(page); await next(page); await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  await page.waitForFunction(() => window.MoonFogWp.engine.getCurrent()?.effect === 'grain');
  await expect(page.locator('#pageBgGrain canvas')).toBeAttached();
  await expect(page.locator('#pageBgGrain')).toHaveClass(/grain-ready/);
  await page.reload();
  await page.waitForFunction(() => window.MoonFogWp?.engine?.getCurrent()?.effect === 'grain');
  await expect(page.locator('#pageBgGrain')).toHaveClass(/grain-ready/);
});

test('reopening with local background saves a newly selected image without toggling its mode', async ({ page }) => {
  await next(page); await choose(page, 'oobeBackground', 'local');
  await page.locator('#oobeLocalInput').setInputFiles({ name: 'first.svg', mimeType: 'image/svg+xml', buffer: fixtureImage });
  await expect(page.locator('#oobeStatus')).toContainText('已选择');
  await next(page); await next(page); await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  const first = await page.evaluate(() => window.MoonFogWp.spec.get().strategy.itemId);
  await page.evaluate(() => window.openOobe());
  await next(page);
  await expect(page.locator('input[name="oobeBackground"][value="local"]')).toBeChecked();
  await page.locator('#oobeLocalInput').setInputFiles({ name: 'replacement.svg', mimeType: 'image/svg+xml', buffer: fixtureImage });
  await expect(page.locator('#oobeStatus')).toContainText('已选择');
  await next(page); await next(page); await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  const second = await page.evaluate(() => window.MoonFogWp.spec.get().strategy.itemId);
  expect(second).not.toBe(first);
  await page.reload();
  await page.waitForFunction(id => window.MoonFogWp?.engine?.getCurrent()?.id === id, second);
  expect(await page.evaluate(id => window.MoonFogWp.library.getItem(id).name, second)).toBe('replacement.svg');
});

test('unexpected native dialog close releases the home page and discards the draft', async ({ page }) => {
  await next(page); await choose(page, 'oobeTone', 'rose');
  await page.evaluate(() => document.getElementById('oobe').close());
  await expect(page.locator('#oobe')).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/boot-oobe-pending/);
  await expect(page.locator('body')).not.toHaveClass(/oobe-active/);
  await expect(page.locator('#searchInput')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('moonfog_tone'))).not.toBe('rose');
  expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBe('1');
});

for (const failure of [false, true]) {
  test(`native close during pending save ${failure ? 'restores the draft for retry on failure' : 'waits for successful completion'}`, async ({ page }) => {
    await next(page); await choose(page, 'oobeTone', 'rose');
    await next(page); await next(page);
    await page.evaluate(failure => {
      const init = window.MoonFogWp.library.init;
      window.MoonFogWp.library.init = () => new Promise((resolve, reject) => {
        window.settleSave = () => {
          window.MoonFogWp.library.init = init;
          if (failure) reject(new Error('one-time failure'));
          else resolve();
        };
      });
    }, failure);
    await next(page);
    await page.waitForFunction(() => window.settleSave);
    await page.evaluate(() => document.getElementById('oobe').close());
    await expect(page.locator('html')).toHaveClass(/boot-oobe-pending/);
    expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBeNull();
    await page.evaluate(() => window.settleSave());
    if (failure) {
      await expect(page.locator('#oobe')).toBeVisible();
      await expect(page.locator('#oobeStatus')).toContainText('无法保存');
      await expect(page.locator('#oobeTitle')).toContainText('开场白');
      await expect(page.locator('#oobeNextBtn')).toBeFocused();
      await next(page);
    }
    await expect(page.locator('#oobe')).toBeHidden();
    await expect(page.locator('html')).not.toHaveClass(/boot-oobe-pending/);
    await expect(page.locator('html')).toHaveAttribute('data-tone', 'rose');
    expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBe('1');
  });
}

test('failure after image insertion preserves another tab settings, library entries and sources', async ({ page, context }) => {
  await next(page); await choose(page, 'oobeBackground', 'local');
  await page.locator('#oobeLocalInput').setInputFiles({ name: 'draft.svg', mimeType: 'image/svg+xml', buffer: fixtureImage });
  await expect(page.locator('#oobeStatus')).toContainText('已选择');
  await next(page); await next(page);
  await page.evaluate(() => {
    const library = window.MoonFogWp.library;
    const add = library.addPreparedImage;
    library.addPreparedImage = async (...args) => {
      const item = await add(...args);
      window.pendingAddedId = item.id;
      await new Promise(resolve => { window.releaseImageSave = resolve; });
      library.addPreparedImage = add;
      return item;
    };
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'moonfog_oobe_done') {
        Storage.prototype.setItem = set;
        throw new DOMException('one-time failure after image insertion', 'QuotaExceededError');
      }
      return set.call(this, key, value);
    };
  });
  await next(page);
  await page.waitForFunction(() => window.pendingAddedId);
  const pendingId = await page.evaluate(() => window.pendingAddedId);
  const other = await context.newPage();
  await other.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8132/') ? route.continue() : route.abort());
  await other.goto('/?raw=1');
  await other.waitForFunction(() => window.MoonFogWp?.engine?.getCurrent());
  const saved = await other.evaluate(async url => {
    const wp = window.MoonFogWp;
    const item = await wp.library.addPreparedImage(url, 'other-tab');
    const source = wp.library.addSource('api', 'other-tab source', { url: 'https://example.test/api' });
    wp.spec.setStrategy({ kind: 'fixed', itemId: item.id });
    wp.spec.setGlobals({ mute: 'allow', performance: 'low' });
    localStorage.setItem('moonfog_tone', 'sky');
    localStorage.setItem('moonfog_mode_pref', 'dark');
    localStorage.setItem('moonfog_username', '另一个标签页');
    localStorage.setItem('moonfog_bg_mode', 'local');
    return { itemId: item.id, sourceId: source.id, spec: localStorage.getItem('moonfog_wallpaper_spec') };
  }, 'data:image/svg+xml;base64,' + fixtureImage.toString('base64'));
  await page.evaluate(() => window.releaseImageSave());
  await expect(page.locator('#oobeStatus')).toContainText('无法保存');
  const state = await other.evaluate(async ({ saved, pendingId }) => {
    // 直接查 IndexedDB；其他标签页可能仍缓存着已删除条目的 blob URL。
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('moonfog-wallpaper', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const hasBlob = id => new Promise((resolve, reject) => {
      const req = db.transaction('blobs', 'readonly').objectStore('blobs').get(id);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => reject(req.error);
    });
    const blob = await hasBlob(saved.itemId), draftBlob = await hasBlob(pendingId);
    db.close();
    return {
      spec: localStorage.getItem('moonfog_wallpaper_spec'),
      tone: localStorage.getItem('moonfog_tone'), mode: localStorage.getItem('moonfog_mode_pref'),
      name: localStorage.getItem('moonfog_username'), bg: localStorage.getItem('moonfog_bg_mode'),
      ids: window.MoonFogWp.library.listItems('image').map(item => item.id),
      source: !!window.MoonFogWp.library.getSource(saved.sourceId),
      blob, draftBlob
    };
  }, { saved, pendingId });
  expect(state).toEqual({ spec: saved.spec, tone: 'sky', mode: 'dark', name: '另一个标签页', bg: 'local', ids: [saved.itemId], source: true, blob: true, draftBlob: false });
  expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBeNull();
  await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  expect(await page.evaluate(() => window.MoonFogWp.library.listItems('image').length)).toBe(2);
  await other.close();
});

test('offline daily wallpaper does not trap the user in onboarding', async ({ page }) => {
  await next(page); await choose(page, 'oobeBackground', 'bing');
  await expect(page.locator('#oobeStatus')).toContainText('暂时无法加载');
  await expect(page.locator('#oobeNextBtn')).toBeEnabled();
  await next(page); await next(page); await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  expect(await page.evaluate(() => window.MoonFogWp.spec.get().strategy.kind)).toBe('source');
});

test('storage failure keeps the draft, rolls back partial preferences and permits retry', async ({ page }) => {
  await next(page); await choose(page, 'oobeTone', 'rose');
  await next(page); await next(page);
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = set; };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'moonfog_custom_text') throw new DOMException('full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  });
  await next(page);
  await expect(page.locator('#oobeStatus')).toContainText('无法保存');
  expect(await page.evaluate(() => localStorage.getItem('moonfog_oobe_done'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('moonfog_tone'))).not.toBe('rose');
  await page.evaluate(() => window.restoreStorage());
  await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-tone', 'rose');
});

test('reduced motion, rapid navigation and keyboard focus stay consistent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await next(page); await next(page);
  await page.locator('#oobeBackBtn').click();
  await next(page); await next(page);
  await expect(page.locator('#oobeTitle')).toContainText('开场白');
  expect(await page.evaluate(() => document.querySelector('#oobe').getAnimations({ subtree: true }).length)).toBe(0);
  await page.locator('#oobeNextBtn').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.querySelector('#oobe').contains(document.activeElement))).toBe(true);
});

test('small and landscape viewports keep footer controls inside the visible area', async ({ page }) => {
  const titles = ['从喜欢的背景开始', '找到舒服的光线', '给新的一页，一句开场白'];
  let index = 0;
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 360, height: 360 }]) {
    await page.setViewportSize(size);
    await next(page);
    await expect(page.locator('#oobeTitle')).toHaveText(titles[index++]);
    await expect(page.locator('body')).not.toHaveClass(/kb-busy|kb-open/);
    const bounds = await page.locator('.oobe-footer').boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height + 1);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  }
  await choose(page, 'oobeGreeting', 'custom');
  await page.locator('#oobeCustomInput').fill('小屏幕也可以操作');
  await page.setViewportSize({ width: 360, height: 300 });
  await next(page);
  await expect(page.locator('#oobe')).toBeHidden();
});
