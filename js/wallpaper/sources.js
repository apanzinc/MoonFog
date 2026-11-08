/**
 * MoonFog - Wallpaper Sources
 * 源只做一件事：被问的时候，告诉打开策略“用哪个背景”。
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const CACHE_KEY = 'moonfog_wp_source_cache';
  const TIMEOUT_MS = 1500;

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function uid() {
    return 'src-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function nowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function timeoutPromise(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms);
    });
  }

  function createTempItem(kind, url, title) {
    return {
      id: uid(),
      kind,
      source: 'runtime',
      name: title || '源背景',
      url,
      createdAt: Date.now()
    };
  }

  async function fetchBing(source) {
    let url = '';
    let title = '';
    try {
      if (typeof window.fetchBingDailyMeta === 'function') {
        const meta = await Promise.race([window.fetchBingDailyMeta(), timeoutPromise(TIMEOUT_MS)]);
        const img = meta && meta.images && meta.images[0];
        url = img && (img.imageUrl || img.url);
        title = (img && (img.title || img.copyright)) || '必应每日';
      } else if (typeof window.fetchBingImagePool === 'function') {
        const pool = await Promise.race([window.fetchBingImagePool(false), timeoutPromise(TIMEOUT_MS)]);
        const current = pool && pool.items && (pool.items[pool.cursor] || pool.items[0]);
        url = current && current.imageUrl;
        title = (current && (current.title || current.copyright)) || '必应每日';
      }
    } catch (err) {
      console.warn('[MoonFogWp] 必应源失败:', err);
    }
    return url ? createTempItem('image', url, title) : null;
  }

  async function fetchApi(source) {
    const config = source.config || {};
    const url = config.url;
    if (!url) return null;
    try {
      const res = await Promise.race([fetch(url, { mode: 'cors', cache: 'no-cache' }), timeoutPromise(TIMEOUT_MS)]);
      if (!res.ok) throw new Error('api error');
      const data = await res.json();
      const imageUrl = data.url || data.imageUrl || data.image || (data.images && data.images[0] && data.images[0].url);
      if (!imageUrl) throw new Error('api no image');
      return createTempItem('image', imageUrl, data.title || '第三方源');
    } catch (err) {
      console.warn('[MoonFogWp] API 源失败:', err);
      return null;
    }
  }

  function resolveWdd(source) {
    const config = source.config || {};
    const frames = Array.isArray(config.frames) ? config.frames : [];
    if (!frames.length) return null;
    const minutes = nowMinutes();
    let chosen = frames[0];
    frames.forEach((frame) => {
      if ((frame.at || 0) <= minutes) chosen = frame;
    });
    if (!chosen || !chosen.url) return null;
    return createTempItem('image', chosen.url, chosen.title || '.wdd 源');
  }

  function resolveScheme(source) {
    const config = source.config || {};
    const ids = Array.isArray(config.itemIds) ? config.itemIds : [];
    if (!ids.length) return null;
    const items = ids.map((id) => WP.library && WP.library.getItem(id)).filter(Boolean);
    if (!items.length) return null;
    const order = config.order || 'sequence';
    let idx = 0;
    if (order === 'shuffle') {
      idx = Math.floor(Math.random() * items.length);
    } else {
      const sessionKey = 'moonfog_wp_scheme_' + source.id;
      let last = 0;
      try { last = parseInt(sessionStorage.getItem(sessionKey) || '0', 10) || 0; } catch (_) {}
      idx = (last + 1) % items.length;
      try { sessionStorage.setItem(sessionKey, String(idx)); } catch (_) {}
    }
    return items[idx];
  }

  async function resolveSource(source) {
    if (!source) return null;
    const cache = readCache();
    let item = null;

    if (source.kind === 'bing') item = await fetchBing(source);
    else if (source.kind === 'api') item = await fetchApi(source);
    else if (source.kind === 'wdd') item = resolveWdd(source);
    else if (source.kind === 'scheme') item = resolveScheme(source);

    if (item && item.url) {
      cache[source.id] = { url: item.url, name: item.name, at: Date.now() };
      writeCache(cache);
    }
    return item;
  }

  function getCachedSource(source) {
    if (!source) return null;
    const cache = readCache();
    const entry = cache[source.id];
    if (!entry || !entry.url) return null;
    return createTempItem('image', entry.url, entry.name);
  }

  function listAllSourceItems() {
    const sources = WP.library ? WP.library.listSources() : [];
    const items = [];
    sources.forEach((source) => {
      if (source.kind === 'scheme') {
        const config = source.config || {};
        const ids = Array.isArray(config.itemIds) ? config.itemIds : [];
        ids.forEach((id) => {
          const item = WP.library && WP.library.getItem(id);
          if (item) items.push(item);
        });
      } else {
        const cached = getCachedSource(source);
        if (cached) items.push(cached);
      }
    });
    return items;
  }

  const rotateCache = { key: '', itemId: '' };

  function resolveRotate(strategy, advance) {
    const all = WP.library ? WP.library.listItems() : [];
    const eligible = all.filter((item) => item.kind === 'image' || item.kind === 'video');
    const ids = Array.isArray(strategy.itemIds) ? strategy.itemIds : [];
    let pool = ids.length ? eligible.filter((item) => ids.indexOf(item.id) >= 0) : eligible;
    if (!pool.length) pool = eligible;
    if (!pool.length) return null;
    const key = (ids.join(',')) + '|' + pool.map((item) => item.id).join(',');
    if (!advance && rotateCache.key === key && rotateCache.itemId) {
      const existing = pool.find((item) => item.id === rotateCache.itemId);
      if (existing) return existing;
    }
    let idx = 0;
    try { idx = parseInt(sessionStorage.getItem('moonfog_wp_rotate_idx') || '0', 10) || 0; } catch (_) {}
    const item = pool[idx % pool.length];
    rotateCache.key = key;
    rotateCache.itemId = item.id;
    try { sessionStorage.setItem('moonfog_wp_rotate_idx', String((idx + 1) % pool.length)); } catch (_) {}
    return item;
  }

  async function resolveStrategy(strategy, options) {
    const spec = WP.spec && WP.spec.get();
    const globals = spec ? spec.globals : {};
    const useCache = globals.onlineFailure === 'cache';
    const advance = !!(options && options.advance);

    if (!strategy) strategy = spec ? spec.strategy : { kind: 'fixed' };

    if (strategy.kind === 'fixed') {
      if (!strategy.itemId) return null;
      return WP.library ? WP.library.getItem(strategy.itemId) : null;
    }

    if (strategy.kind === 'rotate') {
      return resolveRotate(strategy, advance);
    }

    if (strategy.kind === 'source') {
      if (!strategy.sourceId) return null;
      const source = WP.library ? WP.library.getSource(strategy.sourceId) : null;
      let item = await resolveSource(source);
      if (!item && useCache) item = getCachedSource(source);
      return item;
    }

    return null;
  }

  WP.sources = {
    resolveStrategy,
    resolveSource,
    getCachedSource,
    listAllSourceItems,
    TIMEOUT_MS
  };
})();
