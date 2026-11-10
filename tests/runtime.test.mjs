import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

function load(file, context = {}) {
  const sandbox = vm.createContext({ console, URL, AbortController, ...context });
  vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), sandbox);
  return sandbox;
}

function env(protocol, userAgent = '') {
  return load('js/env.js', {
    location: { protocol, origin: 'https://moonfog.example' }, navigator: { userAgent }, window: {}
  }).window.MoonFogEnv;
}

test('CORS proxy uses exact origins, including ports and credentials', () => {
  const runtime = env('https:');
  assert.equal(runtime.applyCorsProxy('https://moonfog.example/image.jpg'), 'https://moonfog.example/image.jpg');
  for (const url of ['https://moonfog.example.evil.test/a', 'https://moonfog.example:444/a', 'https://moonfog.example@evil.test/a']) {
    assert.equal(runtime.applyCorsProxy(url), '');
  }
  assert.equal(runtime.applyCorsProxy('data:image/png;base64,abc'), 'data:image/png;base64,abc');
});

test('Edge Android and iOS are recognized independently of extension API support', () => {
  for (const brand of ['Edg/142.0', 'EdgA/142.0', 'EdgiOS/142.0']) {
    assert.equal(env('chrome-extension:', 'Mozilla/5.0 ' + brand).host, 'edge');
  }
  assert.equal(env('chrome-extension:', 'Chrome/142.0').host, 'chrome');
  assert.equal(env('https:', 'EdgA/142.0').isWeb, true);
});

function searchContext() {
  const classes = new Set();
  const frames = [];
  const timers = new Map();
  const panel = {
    hidden: false,
    classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    querySelectorAll: () => [], addEventListener() {}
  };
  const input = { value: 'moon', setAttribute() {}, removeAttribute() {} };
  let timerId = 0;
  const context = load('js/search.js', {
    window: {
      setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); }, matchMedia: () => ({ matches: false })
    },
    document: { getElementById: id => id === 'searchSuggest' ? panel : input },
    requestAnimationFrame: fn => frames.push(fn)
  });
  context.currentSuggestProviders = () => ['bing'];
  context.isSearchSuggestEnabled = () => true;
  context.isShortcutSuggestEnabled = () => false;
  context.placeSearchSuggest = () => {};
  return { context, panel, input, frames, timers, classes };
}

test('closing suggestions invalidates an in-flight result and cancels the debounce', async () => {
  const { context, timers } = searchContext();
  let resolve;
  let signal;
  let renders = 0;
  context.fetchSuggestFromEndpoint = (_provider, _query, abortSignal) => {
    signal = abortSignal;
    return new Promise(done => { resolve = done; });
  };
  context.renderSearchSuggest = () => { renders++; };
  context.fetchSearchSuggest();
  context.scheduleSearchSuggest();
  context.closeSearchSuggest();
  assert.equal(signal.aborted, true);
  resolve(['moonfog']);
  await new Promise(setImmediate);
  assert.equal(renders, 0);
  // Only the visual close fallback may remain, never the pending network debounce.
  assert.equal([...timers.values()].some(fn => fn === context.fetchSearchSuggest), false);
});

test('a queued open animation cannot reopen a closed suggestions panel', () => {
  const { context, panel, input, frames, classes } = searchContext();
  context.openSearchSuggest(panel, input);
  context.closeSearchSuggest();
  frames.forEach(fn => fn());
  assert.equal(classes.has('is-open'), false);
});

test('callback-only browser search failure falls back exactly once', async () => {
  const { context } = searchContext();
  const searches = [];
  context.chrome = { runtime: {}, search: { query(_info, callback) {
    queueMicrotask(() => {
      context.chrome.runtime.lastError = { message: 'unsupported' };
      callback?.();
      delete context.chrome.runtime.lastError;
    });
  } } };
  context.openEngineSearch = query => searches.push(query);
  context.submitBrowserSearch('moonfog');
  await new Promise(setImmediate);
  assert.deepEqual(searches, ['moonfog']);
});

test('callback-only permissions are supported and runtime errors are consumed', async () => {
  const { context } = searchContext();
  context.window.MoonFogEnv = { isExtension: true };
  context.document.getElementById = () => null;
  context.chrome = { runtime: {}, permissions: {
    contains(_query, callback) { callback(true); },
    request(_query, callback) { callback(false); }
  } };
  assert.equal(await context.refreshSuggestPermission(), true);
  assert.equal(await context.requestSuggestPermission(), false);
});

test('toolbar action opens the packaged home page without needing a tabs permission', () => {
  let onClick;
  const urls = [];
  load('js/extension-background.js', { chrome: {
    action: { onClicked: { addListener: listener => { onClick = listener; } } },
    runtime: { getURL: file => 'chrome-extension://test/' + file },
    tabs: { create: ({ url }) => urls.push(url) }
  } });
  onClick();
  assert.deepEqual(urls, ['chrome-extension://test/newtab.html']);
});

test('address input handles query strings, fragments, long TLDs and local development URLs', () => {
  const { context } = searchContext();
  for (const input of ['https://example.com/path?a=1#part', 'example.technology', 'localhost:8132/a', '127.0.0.1:8132/a', '[::1]:8132/a']) {
    assert.equal(context.resolveSearchAddress(input), new URL(input.startsWith('http') ? input : 'https://' + input).href);
  }
  for (const input of ['hello world', 'javascript:alert(1)', 'user@example.com', 'a'.repeat(10000) + '!']) {
    assert.equal(context.resolveSearchAddress(input), '');
  }
});

test('missing fontSettings on mobile falls back without breaking the font picker', async () => {
  const context = load('js/settings.js', { window: {}, document: { readyState: 'loading', addEventListener() {} } });
  const fonts = await context.listSystemFonts();
  assert.ok(fonts.includes('Noto Sans SC'));
  assert.ok(fonts.length > 0);
});

test('font list callback failures are consumed and use the built-in fallback', async () => {
  let errorRead = false;
  const context = load('js/settings.js', {
    window: {}, document: { readyState: 'loading', addEventListener() {} },
    chrome: {
      fontSettings: { getFontList(callback) { callback(undefined); } },
      runtime: { get lastError() { errorRead = true; return { message: 'unsupported' }; } }
    }
  });
  assert.ok((await context.listSystemFonts()).length > 0);
  assert.equal(errorRead, true);
});
