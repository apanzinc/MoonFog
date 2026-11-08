/**
 * MoonFog - Wallpaper Spec
 * 新设计：背景库（图片/视频/动效/纯色）+ 源 + 打开策略 + 全局开关。
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const SPEC_KEY = 'moonfog_wallpaper_spec';
  const ITEMS_KEY = 'moonfog_wallpaper_items';
  const SOURCES_KEY = 'moonfog_wallpaper_sources';
  const MIGRATED_KEY = 'moonfog_wallpaper_migrated_v2';

  // 旧键（v1 迁移用）
  const LEGACY_SPEC_KEY = 'moonfog_wallpaper_spec';
  const LEGACY_MODE_KEY = 'moonfog_bg_mode';
  const LEGACY_LOCAL_KEY = 'moonfog_bg_local';
  const LEGACY_BING_KEY = 'moonfog_bg_bing';
  const LEGACY_BLUR_KEY = 'moonfog_bg_blur';
  const LEGACY_WASH_KEY = 'moonfog_bg_wash';
  const LEGACY_GRAIN_KEY = 'moonfog_grain';

  const EVENT = 'moonfog-wp-spec-change';

  const subscribers = new Set();

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function uid(prefix) {
    return (prefix || 'wp') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function defaultSpec() {
    return {
      v: 2,
      strategy: { kind: 'fixed', itemId: null },
      globals: {
        mute: 'follow',
        performance: 'balanced',
        onlineFailure: 'cache'
      }
    };
  }

  function normalizeStrategy(s) {
    const strategy = { kind: 'fixed', itemId: null, sourceId: null, itemIds: [], intervalMin: 0 };
    if (!s || typeof s !== 'object') return strategy;
    const kind = s.kind;
    if (kind === 'fixed' || kind === 'rotate' || kind === 'source') {
      strategy.kind = kind;
    } else if (kind === 'random-all') {
      strategy.kind = 'rotate';
    } else if (kind === 'random-source') {
      strategy.kind = 'source';
    }
    if (typeof s.itemId === 'string') strategy.itemId = s.itemId;
    if (typeof s.sourceId === 'string') strategy.sourceId = s.sourceId;
    if (Array.isArray(s.itemIds)) {
      strategy.itemIds = s.itemIds.filter((id) => typeof id === 'string');
    }
    const mins = Number(s.intervalMin);
    if (Number.isFinite(mins) && mins >= 0) strategy.intervalMin = Math.round(mins);
    return strategy;
  }

  function normalizeGlobals(g) {
    const globals = {
      mute: 'follow',
      performance: 'balanced',
      onlineFailure: 'cache'
    };
    if (!g || typeof g !== 'object') return globals;
    if (g.mute === 'force' || g.mute === 'follow' || g.mute === 'allow') globals.mute = g.mute;
    if (g.performance === 'high' || g.performance === 'balanced' || g.performance === 'low') {
      globals.performance = g.performance;
    }
    if (g.onlineFailure === 'skip' || g.onlineFailure === 'cache') globals.onlineFailure = g.onlineFailure;
    return globals;
  }

  function normalizeSpec(raw) {
    const spec = defaultSpec();
    if (!raw || typeof raw !== 'object') return spec;
    spec.strategy = normalizeStrategy(raw.strategy);
    spec.globals = normalizeGlobals(raw.globals);
    return spec;
  }

  function migrate() {
    // v1 spec 迁移
    const legacy = readJson(LEGACY_SPEC_KEY);
    if (legacy && legacy.v === 1) {
      const spec = defaultSpec();
      const kind = legacy.content && legacy.content.kind;
      const itemId = legacy.content && legacy.content.itemId;
      if (kind === 'solid' || kind === 'gradient') {
        spec.strategy = { kind: 'fixed', itemId: null };
      } else if (itemId) {
        spec.strategy = { kind: 'fixed', itemId };
      }
      if (legacy.globals) spec.globals = normalizeGlobals(legacy.globals);
      writeJson(SPEC_KEY, spec);
      try { localStorage.setItem(MIGRATED_KEY, '1'); } catch (_) {}
      return spec;
    }

    // 更旧的 bg_mode 迁移
    let mode = '';
    try { mode = localStorage.getItem(LEGACY_MODE_KEY) || ''; } catch (_) {}
    let localUrl = '';
    try { localUrl = localStorage.getItem(LEGACY_LOCAL_KEY) || ''; } catch (_) {}
    const bing = readJson(LEGACY_BING_KEY);

    const items = [];
    let fixedItemId = null;

    if (mode === 'grain' || mode === 'gradient') {
      // 动效作为库条目
      const grain = readJson(LEGACY_GRAIN_KEY);
      const item = {
        id: uid('effect'),
        kind: 'effect',
        source: 'built-in',
        name: '流光渐变',
        effect: 'grain',
        params: grain && typeof grain === 'object' ? grain : {},
        createdAt: Date.now()
      };
      items.push(item);
      fixedItemId = item.id;
    } else if (mode === 'solid' || !mode) {
      fixedItemId = null;
    } else if (localUrl && localUrl.indexOf('data:') === 0) {
      const item = {
        id: uid('image'),
        kind: 'image',
        source: 'local',
        name: '本地图片',
        url: localUrl,
        createdAt: Date.now()
      };
      items.push(item);
      fixedItemId = item.id;
    } else if (bing && (bing.imageUrl || bing.url)) {
      const url = bing.imageUrl || bing.url;
      const item = {
        id: uid('image'),
        kind: 'image',
        source: 'online',
        name: bing.title || '必应每日',
        url,
        createdAt: Date.now()
      };
      items.push(item);
      fixedItemId = item.id;
    }

    const spec = defaultSpec();
    if (fixedItemId) spec.strategy = { kind: 'fixed', itemId: fixedItemId };

    try {
      const blur = localStorage.getItem(LEGACY_BLUR_KEY);
      if (blur !== null) spec.globals.blur = clamp(Math.round(num(blur, 0)), 0, 40);
      const wash = localStorage.getItem(LEGACY_WASH_KEY);
      if (wash !== null) spec.globals.wash = clamp(Math.round(num(wash, 0)), -50, 50);
    } catch (_) {}

    if (items.length) {
      writeJson(ITEMS_KEY, items);
    } else {
      const existing = readJson(ITEMS_KEY);
      if (!Array.isArray(existing)) writeJson(ITEMS_KEY, []);
    }
    writeJson(SPEC_KEY, spec);
    try { localStorage.setItem(MIGRATED_KEY, '1'); } catch (_) {}
    return spec;
  }

  let repaired = false;

  /**
   * 一次性修复老数据：迁移只搬了「源」，没搬「策略」。
   * bg_mode=bing 但 spec.strategy 停在 fixed + 空 itemId 时，必应每日会被静默
   * 降级成纯色，看起来像「选了壁纸却什么都没有」。
   * 库里有条目时不动，免得盖掉用户主动选的纯色。
   */
  function repairLegacyStrategy() {
    if (repaired) return;
    try {
      const raw = readJson(SPEC_KEY);
      // 条件还没齐（spec 或源还没建好）就先不置位，等下次 get() 再试
      if (!raw || !raw.strategy) return;
      const st = raw.strategy;
      if (st.kind !== 'fixed' || st.itemId) {
        repaired = true;
        return;
      }
      const items = readJson(ITEMS_KEY);
      if (Array.isArray(items) && items.length) {
        repaired = true;
        return;
      }
      const mode = localStorage.getItem(LEGACY_MODE_KEY) || '';
      if (mode !== 'bing') {
        repaired = true;
        return;
      }
      const sources = readJson(SOURCES_KEY) || [];
      const bingSrc = Array.isArray(sources) ? sources.find((s) => s && s.kind === 'bing') : null;
      if (!bingSrc || !bingSrc.id) return;
      raw.strategy = {
        kind: 'source',
        sourceId: bingSrc.id,
        itemId: null,
        itemIds: [],
        intervalMin: 0
      };
      writeJson(SPEC_KEY, raw);
      repaired = true;
    } catch (_) {}
  }

  function get() {
    repairLegacyStrategy();
    const raw = readJson(SPEC_KEY);
    if (!raw) {
      const migrated = migrate();
      return normalizeSpec(migrated);
    }
    return normalizeSpec(raw);
  }

  function notify(spec) {
    subscribers.forEach((cb) => {
      try { cb(spec); } catch (err) { console.error('[MoonFogWp] spec listener failed:', err); }
    });
    try {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: spec }));
    } catch (_) {}
  }

  function set(next) {
    const current = get();
    const merged = normalizeSpec(Object.assign({}, current, next && typeof next === 'object' ? next : {}));
    writeJson(SPEC_KEY, merged);
    notify(merged);
    return merged;
  }

  function update(patch) {
    const current = get();
    let next;
    if (typeof patch === 'function') {
      next = patch(current);
      if (!next || typeof next !== 'object') next = current;
    } else {
      next = Object.assign({}, current, patch || {});
    }
    return set(next);
  }

  function setStrategy(strategy) {
    return update({ strategy: normalizeStrategy(strategy) });
  }

  function setGlobals(globals) {
    return update({ globals: normalizeGlobals(globals) });
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.add(cb);
    return function () { subscribers.delete(cb); };
  }

  window.addEventListener('storage', (event) => {
    if (!event || event.key !== SPEC_KEY || !event.newValue) return;
    try {
      notify(normalizeSpec(JSON.parse(event.newValue)));
    } catch (_) {}
  });

  WP.spec = {
    SPEC_KEY,
    get,
    set,
    update,
    setStrategy,
    setGlobals,
    onChange,
    EVENT,
    normalizeStrategy,
    normalizeGlobals
  };
})();
