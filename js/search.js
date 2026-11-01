/**
 * MoonFog - 搜索引擎
 */

/**
 * 初始化搜索 */
function initSearch() {
  applyBrowserSearchSettings();
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');

  const syncClearBtn = () => {
    if (!clearBtn || !input) return;
    clearBtn.hidden = !input.value;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const picked = takeActiveSuggestion();
    const query = (picked || input.value).trim();
    if (query) {
      if (picked) input.value = picked;
      closeSearchSuggest();
      performSearch(query);
    }
  });

  input.addEventListener('input', () => {
    syncClearBtn();
    scheduleSearchSuggest();
  });
  input.addEventListener('search', syncClearBtn);
  input.addEventListener('compositionstart', () => {
    searchSuggestComposing = true;
  });
  input.addEventListener('compositionend', () => {
    searchSuggestComposing = false;
    scheduleSearchSuggest();
  });
  input.addEventListener('keydown', onSearchSuggestKeydown);
  input.addEventListener('focus', () => {
    if (input.value.trim()) scheduleSearchSuggest();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncClearBtn();
      closeSearchSuggest();
      input.focus();
    });
  }

  document.addEventListener('pointerdown', (e) => {
    const section = form.closest('.search-section');
    if (section && section.contains(e.target)) return;
    closeSearchSuggest();
  });

  const engineGrid = document.getElementById('engineGrid');
  if (engineGrid) {
    engineGrid.addEventListener('click', () => {
      if (input.value.trim()) scheduleSearchSuggest();
    });
  }

  window.addEventListener('resize', () => {
    const panel = document.getElementById('searchSuggest');
    if (panel && !panel.hidden) placeSearchSuggest(panel);
  });

  bindSearchSuggestToggle();
  refreshSuggestPermission();
  syncClearBtn();
  input.focus();
}

const SEARCH_SUGGEST_LIMIT = 8;
let searchSuggestTimer = 0;
let searchSuggestAbort = null;
let searchSuggestSeq = 0;
let searchSuggestActive = -1;
let searchSuggestComposing = false;

/**
 * 扩展（Chrome / Edge）里搜索交给浏览器的 chrome.search API：
 * 使用用户设置的默认搜索引擎，不读取也不修改搜索设置，
 * 这样「新标签页」仍是扩展的唯一用途，不叠加「修改搜索体验」。
 */
function usesBrowserSearch() {
  if (!window.MoonFogEnv || !window.MoonFogEnv.browserSearch) return false;
  try {
    return typeof chrome !== 'undefined' && !!chrome.search && typeof chrome.search.query === 'function';
  } catch (_) {
    return false;
  }
}

/** 调用 chrome.search 打开查询；仅在 API 调用失败时回退到页面内引擎 */
function submitBrowserSearch(query) {
  try {
    const pending = chrome.search.query({ text: query, disposition: 'CURRENT_TAB' });
    if (pending && typeof pending.catch === 'function') {
      pending.catch((err) => {
        console.warn('[MoonFog] chrome.search 调用失败，回退到页面内引擎：', err);
        openEngineSearch(query);
      });
    }
  } catch (err) {
    console.warn('[MoonFog] chrome.search 调用失败，回退到页面内引擎：', err);
    openEngineSearch(query);
  }
}

/** 扩展内：搜索执行「跟随浏览器」走 chrome.search；引擎卡片列表用于选择搜索/联想引擎 */
function applyBrowserSearchSettings() {
  if (!usesBrowserSearch()) return;
  const setText = (el, text) => { if (el) el.textContent = text; };
  // 恢复引擎卡片列表：选「跟随浏览器」时搜索走浏览器默认引擎；选具体引擎则直接用该引擎搜索
  const engineGroup = document.getElementById('searchEngineGroup');
  if (engineGroup) {
    engineGroup.hidden = false;
    setText(engineGroup.querySelector('.settings-group-title'), '搜索引擎');
  }
  const grid = document.getElementById('engineGrid');
  if (grid) {
    // 扩展内只恢复内置搜索引擎卡片；自定义引擎模板涉及额外「搜索配置」，保持隐藏
    if (typeof grid.querySelectorAll === 'function') {
      grid.querySelectorAll('.engine-item').forEach((card) => {
        const value = card.dataset && card.dataset.value;
        if (value && value.indexOf('custom_') === 0) card.hidden = true;
      });
    }
    const autoCard = grid.querySelector('[data-value="auto"]');
    if (autoCard) autoCard.hidden = false;
  }
  const addBtn = document.getElementById('addEngineBtn');
  if (addBtn) addBtn.hidden = true;
  const engineLabel = document.getElementById('engineLabel');
  if (engineLabel) engineLabel.textContent = '搜索引擎';
  const suggestTip = document.getElementById('engineSuggestTip');
  if (suggestTip) suggestTip.hidden = false;
  // 首次进入：默认选中「跟随浏览器」
  const stored = localStorage.getItem('moonfog_engine');
  if (!stored) localStorage.setItem('moonfog_engine', 'auto');
  setText(document.querySelector('#searchSuggestGroup > .settings-group-title'), '输入联想');
  const nav = document.querySelector('.settings-nav-item[data-settings-page="search"]');
  if (nav) {
    setText(nav.querySelector('.settings-nav-title'), '搜索');
    setText(nav.querySelector('.settings-nav-desc'), '搜索引擎与输入联想');
  }
  const page = document.querySelector('.settings-page[data-page="search"]');
  if (page) {
    setText(page.querySelector('.settings-page-head-title'), '搜索');
    setText(page.querySelector('.settings-page-head-desc'), '选择搜索引擎，控制输入联想');
    setText(page.querySelector('.settings-section-title'), '搜索');
  }
}

function isSearchSuggestEnabled() {
  if (typeof getStorageTyped !== 'function') return true;
  return getStorageTyped(SEARCH_SUGGEST_KEY, true, 'boolean');
}

/** 快捷方式联想开关（默认开） */
function isShortcutSuggestEnabled() {
  if (typeof getStorageTyped !== 'function') return true;
  return getStorageTyped(SHORTCUT_SUGGEST_KEY, true, 'boolean');
}

/** 收集本地快捷方式（含文件夹内）为 { name, url } 列表 */
function collectShortcutEntries() {
  if (typeof getShortcuts !== 'function') return [];
  const out = [];
  const walk = (list) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      if (!item) return;
      if (item.type === 'folder') {
        walk(item.children);
        return;
      }
      if (item.name && item.url) out.push({ name: String(item.name), url: String(item.url) });
    });
  };
  walk(getShortcuts());
  return out;
}

const SHORTCUT_SUGGEST_MAX = 3;

/** 输入词匹配本地快捷方式：全等 > 前缀 > 包含，最多 3 条，附带 favicon */
function getLocalShortcutMatches(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return collectShortcutEntries()
    .map((entry) => {
      const name = entry.name.toLowerCase();
      let rank = -1;
      if (name === q) rank = 0;
      else if (name.startsWith(q)) rank = 1;
      else if (name.includes(q)) rank = 2;
      return rank >= 0 ? { rank, name: entry.name, url: entry.url } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, SHORTCUT_SUGGEST_MAX)
    .map((entry) => {
      // 图标交给渲染层的 fetchFavicon（Image 加载 + 三级回退 + 缓存），
      // 不要用 google s2 直链：重定向后的站点 favicon 无 CORS 头，扩展页加载失败
      let initial = (String(entry.name || '').trim().charAt(0) || '?').toUpperCase();
      return {
        text: entry.name,
        desc: '快捷方式',
        image: '',
        initial,
        url: entry.url
      };
    });
}

/** 本地快捷方式排前，与同名网页建议去重 */
function mergeShortcutSuggest(local, webItems) {
  if (!local || !local.length) return webItems;
  const names = new Set(local.map((item) => item.text.toLowerCase()));
  const filtered = (webItems || []).filter(
    (item) => !item || !names.has(String(item.text || '').trim().toLowerCase())
  );
  return local.concat(filtered);
}

/** 联想来源可选：跟随浏览器（默认）/ Google / Bing / 百度（沿用引擎卡片列表的选择） */
const SUGGEST_SOURCE_CHOICES = ['auto', 'google', 'bing', 'baidu'];
// Chrome 不向扩展暴露「浏览器默认搜索引擎」，这里按浏览器品牌做最接近的推断：
// Edge 默认 Bing；Chrome / Firefox / Safari 默认 Google。推断不出的情况回退必应。
const SUGGEST_AUTO_BY_HOST = { edge: 'bing', chrome: 'google', firefox: 'google', safari: 'google' };
// 所选引擎不支持联想时，按 Google → 必应 → 百度 依次回退（固定顺序，用户无需设置）
const SUGGEST_FALLBACK_ORDER = ['google', 'bing', 'baidu'];
// 联想候选链：切换搜索引擎后解析一次并缓存，之后每次按键直接复用，不重复解析
const SUGGEST_CHAIN_KEY = 'moonfog_suggest_chain';
// 已确定的联想来源（成功返回过结果的 provider）：置顶，避免每次按键都重试失效来源
const SUGGEST_PROVIDER_CACHE_KEY = 'moonfog_suggest_provider';
// 本会话内网络失败过的 provider：后续按键直接跳过，不再重试
const suggestFailedProviders = new Set();

// 扩展内直接调用各引擎官方联想接口（有 host 权限，不受 CORS 限制；网页版仍走聚合接口）
const SUGGEST_OFFICIAL_API = {
  google: {
    url: 'https://suggestqueries.google.com/complete/search',
    params: (query, locale) => ({ client: 'firefox', q: query, hl: locale })
  },
  bing: {
    url: 'https://api.bing.com/osjson.aspx',
    params: (query) => ({ query, market: 'zh-CN' })
  },
  baidu: {
    url: 'https://suggestion.baidu.com/su',
    params: (query) => ({ wd: query, cb: 'cb' })
  }
};

function usesOfficialSuggestApi() {
  const env = window.MoonFogEnv || {};
  return env.isExtension === true;
}

// 官方联想接口按需授权：安装时不出现这些主机权限，用户开启「输入联想」时再申请
const SUGGEST_PERMISSION_ORIGINS = [
  'https://api.bing.com/*',
  'https://suggestqueries.google.com/*',
  'https://suggestion.baidu.com/*'
];
let suggestPermissionGranted = false;
let suggestPermissionCheck = null;

function hasSuggestPermissionApi() {
  return typeof chrome !== 'undefined' && !!chrome.permissions
    && typeof chrome.permissions.contains === 'function';
}

function syncSuggestPermissionUI() {
  if (!usesOfficialSuggestApi()) return;
  const el = document.getElementById('searchSuggestToggle');
  const tip = document.getElementById('searchSuggestPermissionTip');
  if (el) {
    el.checked = suggestPermissionGranted ? isSearchSuggestEnabled() : false;
    el.dataset.needGrant = suggestPermissionGranted ? '' : '1';
  }
  if (tip) tip.hidden = suggestPermissionGranted;
}

function refreshSuggestPermission() {
  if (!usesOfficialSuggestApi()) {
    suggestPermissionGranted = true;
    return Promise.resolve(true);
  }
  if (suggestPermissionCheck) return suggestPermissionCheck;
  const contains = hasSuggestPermissionApi()
    ? chrome.permissions.contains({ origins: SUGGEST_PERMISSION_ORIGINS })
    : Promise.resolve(false);
  suggestPermissionCheck = contains
    .then((granted) => {
      suggestPermissionGranted = !!granted;
      return suggestPermissionGranted;
    })
    .catch(() => {
      suggestPermissionGranted = false;
      return false;
    })
    .then((granted) => {
      suggestPermissionCheck = null;
      syncSuggestPermissionUI();
      return granted;
    });
  return suggestPermissionCheck;
}

function requestSuggestPermission() {
  if (typeof chrome === 'undefined' || !chrome.permissions
    || typeof chrome.permissions.request !== 'function') {
    return Promise.resolve(false);
  }
  return chrome.permissions.request({ origins: SUGGEST_PERMISSION_ORIGINS })
    .then((granted) => {
      suggestPermissionGranted = !!granted;
      suggestPermissionCheck = null;
      syncSuggestPermissionUI();
      return suggestPermissionGranted;
    })
    .catch(() => false);
}

function buildOfficialSuggestUrl(provider, query, locale) {
  const api = SUGGEST_OFFICIAL_API[provider];
  if (!api) return '';
  const url = new URL(api.url);
  const params = api.params(query, locale);
  Object.keys(params).forEach((key) => url.searchParams.set(key, String(params[key])));
  return url.toString();
}

/** 百度官方联想返回 `cb({q:"...",p:false,s:["a","b"]})`（GBK 编码），从 s 数组提取建议 */
function parseBaiduSuggest(text) {
  const bracket = /(?:["']s["']|\bs)\s*:\s*\[([\s\S]*?)\]/.exec(String(text || ''));
  const raw = bracket ? bracket[1] : '';
  const items = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let match;
  while ((match = re.exec(raw))) items.push(match[1] || match[2] || '');
  return items
    .map((item) => item.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\//g, '/'))
    .filter(Boolean);
}

async function fetchOfficialSuggest(provider, query, locale, signal) {
  const url = buildOfficialSuggestUrl(provider, query, locale);
  if (!url) return [];
  if (!suggestPermissionGranted) {
    const granted = await refreshSuggestPermission();
    if (!granted) return [];
  }
  const res = await (async () => {
    try {
      return await fetch(url, { signal });
    } catch (error) {
      // 扩展重载/权限迁移后，浏览器可能还没同步可选权限（表现为 CORS/网络失败）：
      // 降级为关闭联想并提示重新授权，避免每次按键都刷报错。
      if (!(signal && signal.aborted)) {
        suggestPermissionGranted = false;
        suggestPermissionCheck = null;
        syncSuggestPermissionUI();
      }
      throw error;
    }
  })();
  if (!res.ok) throw new Error(String(res.status));
  if (provider === 'baidu') {
    const buffer = await res.arrayBuffer();
    let text = '';
    try {
      text = new TextDecoder('gbk').decode(buffer);
    } catch (_) {
      text = new TextDecoder().decode(buffer);
    }
    return parseBaiduSuggest(text).map((item) => ({ text: item }));
  }
  const data = await res.json();
  const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
  return list.filter((item) => typeof item === 'string' && item.trim()).map((item) => ({ text: item }));
}

function fetchSuggestFromEndpoint(provider, query, signal) {
  const locale = suggestLocale();
  if (usesOfficialSuggestApi()) return fetchOfficialSuggest(provider, query, locale, signal);
  // 网页版：CORS 限制，走服务端聚合接口
  const url = new URL(SEARCH_SUGGEST_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('with', provider);
  url.searchParams.set('l', locale);
  return fetch(url.toString(), { signal })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then((data) => (Array.isArray(data) ? data : []));
}

function resetSuggestProviderCache() {
  try { localStorage.removeItem(SUGGEST_PROVIDER_CACHE_KEY); } catch (_) {}
}

function resetSuggestChain() {
  try { localStorage.removeItem(SUGGEST_CHAIN_KEY); } catch (_) {}
}

function getSelectedEngineKey() {
  const stored = localStorage.getItem('moonfog_engine');
  if (!stored || stored === 'auto') return 'auto';
  return stored;
}

function getSuggestSourceKey() {
  const stored = localStorage.getItem('moonfog_engine');
  if (SUGGEST_SOURCE_CHOICES.includes(stored || '')) return stored;
  return 'auto';
}

/** 把「跟随浏览器」解析成实际联想来源；推断不出或引擎不支持联想时回退必应 */
function resolveSuggestSource() {
  const source = getSuggestSourceKey();
  if (source !== 'auto') return source;
  const host = (window.MoonFogEnv && window.MoonFogEnv.host) || '';
  const detected = SUGGEST_AUTO_BY_HOST[host] || 'bing';
  const engine = SEARCH_ENGINES[detected];
  return engine && engine.suggest ? detected : 'bing';
}

/** 解析联想候选链：所选引擎支持联想则排第一（「跟随浏览器」按品牌推断）；
 *  不支持联想时按 Google → 必应 → 百度 的顺序回退。 */
function buildSuggestProviders() {
  const chain = [];
  const push = (key) => {
    if (!key) return;
    const engine = SEARCH_ENGINES[key];
    if (!engine || !engine.suggest) return;
    if (!chain.includes(engine.suggest)) chain.push(engine.suggest);
  };
  const selected = getSelectedEngineKey();
  if (selected === 'auto') {
    push(resolveSuggestSource());
  } else {
    push(selected);
  }
  SUGGEST_FALLBACK_ORDER.forEach(push);
  return chain;
}

/** 联想候选链：切换搜索引擎后解析一次并缓存，之后每次按键直接复用，不重复解析 */
function currentSuggestProviders() {
  const selected = getSelectedEngineKey();
  let cached = null;
  try {
    const raw = localStorage.getItem(SUGGEST_CHAIN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.engine === selected && Array.isArray(parsed.providers) && parsed.providers.length) {
        cached = parsed.providers.slice();
      }
    }
  } catch (_) { cached = null; }
  let chain = cached;
  if (!chain) {
    chain = buildSuggestProviders();
    try {
      localStorage.setItem(SUGGEST_CHAIN_KEY, JSON.stringify({ engine: selected, providers: chain }));
    } catch (_) {}
  }
  // 本会话网络失败过的来源不再重试；已成功返回过结果的来源置顶
  const available = chain.filter((key) => !suggestFailedProviders.has(key));
  let successful = null;
  try { successful = localStorage.getItem(SUGGEST_PROVIDER_CACHE_KEY); } catch (_) {}
  if (successful && available.includes(successful) && available[0] !== successful) {
    available.splice(available.indexOf(successful), 1);
    available.unshift(successful);
  }
  return available;
}

function suggestLocale() {
  const lang = String((navigator.language || 'zh-CN')).replace(/_/g, '-');
  const lower = lang.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower.startsWith('zh-hans')) return 'zh-CN';
  return lang || 'zh-CN';
}

function bindSearchSuggestToggle() {
  const el = document.getElementById('searchSuggestToggle');
  if (el && !el.dataset.bound) {
    el.dataset.bound = '1';
    el.checked = isSearchSuggestEnabled();
    el.addEventListener('change', () => {
      const enable = !!el.checked;
      if (enable && usesOfficialSuggestApi() && !suggestPermissionGranted) {
        el.disabled = true;
        requestSuggestPermission().then((granted) => {
          el.disabled = false;
          if (typeof setStorageTyped === 'function') {
            setStorageTyped(SEARCH_SUGGEST_KEY, granted, 'boolean');
          }
          if (!granted) {
            el.checked = false;
            closeSearchSuggest();
            return;
          }
          syncSuggestPermissionUI();
          scheduleSearchSuggest();
        });
        return;
      }
      if (typeof setStorageTyped === 'function') {
        setStorageTyped(SEARCH_SUGGEST_KEY, !!el.checked, 'boolean');
      }
      if (!el.checked) closeSearchSuggest();
      else scheduleSearchSuggest();
    });
  }

  const shortcutEl = document.getElementById('shortcutSuggestToggle');
  if (shortcutEl && !shortcutEl.dataset.bound) {
    shortcutEl.dataset.bound = '1';
    shortcutEl.checked = isShortcutSuggestEnabled();
    shortcutEl.addEventListener('change', () => {
      if (typeof setStorageTyped === 'function') {
        setStorageTyped(SHORTCUT_SUGGEST_KEY, !!shortcutEl.checked, 'boolean');
      }
      if (!shortcutEl.checked) closeSearchSuggest();
      else scheduleSearchSuggest();
    });
  }
}

function scheduleSearchSuggest() {
  window.clearTimeout(searchSuggestTimer);
  if (searchSuggestComposing) return;
  const input = document.getElementById('searchInput');
  const query = input ? input.value.trim() : '';
  const hasWeb = isSearchSuggestEnabled() && currentSuggestProviders().length > 0;
  const hasLocal = isShortcutSuggestEnabled();
  if (!query || (!hasWeb && !hasLocal)) {
    closeSearchSuggest();
    return;
  }
  searchSuggestTimer = window.setTimeout(fetchSearchSuggest, 160);
}

function fetchSearchSuggest() {
  const input = document.getElementById('searchInput');
  const panel = document.getElementById('searchSuggest');
  if (!input || !panel) return;
  const query = input.value.trim();
  const providers = currentSuggestProviders();
  const hasWeb = isSearchSuggestEnabled() && providers.length > 0;
  const local = isShortcutSuggestEnabled() ? getLocalShortcutMatches(query) : [];
  if (!query || (!hasWeb && !local.length)) {
    closeSearchSuggest();
    return;
  }
  // 关闭网页建议或当前引擎不支持时：仅显示本地快捷方式命中
  if (!hasWeb) {
    renderSearchSuggest(panel, input, local);
    return;
  }
  if (searchSuggestAbort) searchSuggestAbort.abort();
  searchSuggestAbort = new AbortController();
  const seq = ++searchSuggestSeq;
  const signal = searchSuggestAbort.signal;
  const fetchProvider = (provider) => fetchSuggestFromEndpoint(provider, query, signal);
  // 按顺序尝试：所选引擎 → 必应 → 百度 → Google；成功来源记住并置顶；
  // 本会话网络失败过的来源不再重试（避免每次按键都等一遍失效来源）
  (async () => {
    let webItems = [];
    for (const provider of providers) {
      if (suggestFailedProviders.has(provider)) continue;
      try {
        webItems = await fetchProvider(provider);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        suggestFailedProviders.add(provider);
        webItems = [];
      }
      if (webItems.length) {
        try { localStorage.setItem(SUGGEST_PROVIDER_CACHE_KEY, provider); } catch (_) {}
        break;
      }
    }
    if (seq !== searchSuggestSeq) return;
    if (input.value.trim() !== query) return;
    // 全部来源为空：仍有本地命中就展示本地，否则关闭
    if (!webItems.length && !local.length) {
      closeSearchSuggest();
      return;
    }
    renderSearchSuggest(panel, input, mergeShortcutSuggest(local, webItems));
  })().catch((err) => {
    if (err && err.name === 'AbortError') return;
    if (seq !== searchSuggestSeq) return;
    if (local.length) renderSearchSuggest(panel, input, local);
    else closeSearchSuggest();
  });
}

function renderSearchSuggest(panel, input, items) {
  const list = items
    .map((item) => {
      if (typeof item === 'string') item = { text: item };
      return {
        text: item && typeof item.text === 'string' ? item.text.trim() : '',
        desc: item && typeof item.desc === 'string' ? item.desc.trim() : '',
        image: item && typeof item.image === 'string' ? item.image.trim() : '',
        initial: item && typeof item.initial === 'string' ? item.initial.trim() : '',
        url: item && typeof item.url === 'string' ? item.url : ''
      };
    })
    .filter((item) => item.text)
    .slice(0, SEARCH_SUGGEST_LIMIT);

  panel.replaceChildren();
  if (!list.length) {
    closeSearchSuggest();
    return;
  }

  list.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-suggest-item';
    btn.id = 'searchSuggestOpt' + index;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', 'false');
    if (item.url) {
      btn.dataset.targetUrl = item.url;
      btn.classList.add('is-local-shortcut');
    }

    if (/^https:\/\//i.test(item.image)) {
      const img = document.createElement('img');
      img.className = 'search-suggest-icon';
      img.alt = '';
      img.width = 16;
      img.height = 16;
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove());
      img.src = item.image;
      btn.appendChild(img);
    } else if (item.url) {
      // 本地快捷方式：走 fetchFavicon（Image 加载 + duckduckgo/站点回退 + 缓存），
      // 避免直链 favicon 的 CORS 失败；失败时退回首字母占位
      const img = document.createElement('img');
      img.className = 'search-suggest-icon';
      img.alt = '';
      img.width = 16;
      img.height = 16;
      img.referrerPolicy = 'no-referrer';
      const fallbackInitial = item.initial || (item.text.trim().charAt(0) || '?').toUpperCase();
      img.addEventListener('error', () => fallbackIcon(img, fallbackInitial));
      btn.appendChild(img);
      if (typeof fetchFavicon === 'function') {
        Promise.resolve(fetchFavicon(item.url))
          .then((src) => {
            if (src) img.src = src;
            else fallbackIcon(img, fallbackInitial);
          })
          .catch(() => fallbackIcon(img, fallbackInitial));
      } else {
        fallbackIcon(img, fallbackInitial);
      }
    }

    const copy = document.createElement('span');
    copy.className = 'search-suggest-copy';
    const title = document.createElement('span');
    title.className = 'search-suggest-title';
    title.textContent = item.text;
    copy.appendChild(title);
    if (item.desc) {
      const desc = document.createElement('span');
      desc.className = 'search-suggest-desc';
      desc.textContent = item.desc;
      copy.appendChild(desc);
    }
    btn.appendChild(copy);

    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => chooseSearchSuggest(item.text, item.url || ''));
    btn.addEventListener('pointerenter', () => setSearchSuggestActive(index));
    panel.appendChild(btn);
  });

  setSearchSuggestActive(-1);
  openSearchSuggest(panel, input);
}

function openSearchSuggest(panel, input) {
  panel.hidden = false;
  placeSearchSuggest(panel);
  if (input) input.setAttribute('aria-expanded', 'true');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    panel.classList.add('is-open');
    return;
  }
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function closeSearchSuggest() {
  const panel = document.getElementById('searchSuggest');
  const input = document.getElementById('searchInput');
  searchSuggestActive = -1;
  if (input) {
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  if (!panel || panel.hidden) return;
  panel.classList.remove('is-open');
  panel.querySelectorAll('[aria-selected="true"]').forEach((el) => {
    el.setAttribute('aria-selected', 'false');
    el.classList.remove('is-active');
  });
  const hide = () => {
    if (!panel.classList.contains('is-open')) panel.hidden = true;
  };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    hide();
    return;
  }
  panel.addEventListener('transitionend', hide, { once: true });
  window.setTimeout(hide, 260);
}

function placeSearchSuggest(panel) {
  const form = document.getElementById('searchForm');
  if (!form) return;
  const rect = form.getBoundingClientRect();
  const space = window.innerHeight - rect.bottom - 16;
  panel.style.maxHeight = Math.max(120, Math.min(space, 360)) + 'px';
}

function setSearchSuggestActive(index) {
  const panel = document.getElementById('searchSuggest');
  const input = document.getElementById('searchInput');
  if (!panel) return;
  const items = panel.querySelectorAll('.search-suggest-item');
  if (!items.length) {
    searchSuggestActive = -1;
    return;
  }
  if (index >= items.length) index = 0;
  if (index < -1) index = items.length - 1;
  searchSuggestActive = index;
  items.forEach((el, i) => {
    const on = i === index;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (input) {
    if (index >= 0) input.setAttribute('aria-activedescendant', items[index].id);
    else input.removeAttribute('aria-activedescendant');
  }
  if (index >= 0 && typeof items[index].scrollIntoView === 'function') {
    items[index].scrollIntoView({ block: 'nearest' });
  }
}

function takeActiveSuggestion() {
  const panel = document.getElementById('searchSuggest');
  if (!panel || panel.hidden || searchSuggestActive < 0) return '';
  const item = panel.querySelectorAll('.search-suggest-item')[searchSuggestActive];
  const title = item && item.querySelector('.search-suggest-title');
  return title ? title.textContent : '';
}

function chooseSearchSuggest(text, targetUrl) {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  if (input) input.value = text;
  if (clearBtn) clearBtn.hidden = !text;
  closeSearchSuggest();
  if (targetUrl) {
    window.location.href = targetUrl;
    return;
  }
  performSearch(text);
}

function onSearchSuggestKeydown(e) {
  if (e.isComposing || searchSuggestComposing) return;
  const panel = document.getElementById('searchSuggest');
  if (!panel) return;
  const open = !panel.hidden && panel.classList.contains('is-open');
  const count = panel.querySelectorAll('.search-suggest-item').length;
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && count) {
    e.preventDefault();
    if (!open) openSearchSuggest(panel, e.currentTarget);
    const next = e.key === 'ArrowDown'
      ? (searchSuggestActive + 1 >= count ? 0 : searchSuggestActive + 1)
      : (searchSuggestActive <= 0 ? count - 1 : searchSuggestActive - 1);
    setSearchSuggestActive(next);
    return;
  }
  if (e.key === 'Escape' && open) {
    e.preventDefault();
    e.stopPropagation();
    closeSearchSuggest();
    return;
  }
  if (e.key === 'Enter' && open && searchSuggestActive >= 0) {
    const activeItem = panel.querySelectorAll('.search-suggest-item')[searchSuggestActive];
    const picked = takeActiveSuggestion();
    if (picked) {
      e.preventDefault();
      chooseSearchSuggest(picked, activeItem ? activeItem.dataset.targetUrl || '' : '');
    }
  }
}

/**
 * 执行搜索
 */
function performSearch(query) {
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
  if (urlPattern.test(query)) {
    let url = query;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    window.location.href = url;
    return;
  }

  // 扩展内：「跟随浏览器」交给浏览器默认搜索引擎（尊重用户设置）；指定引擎则直接打开该引擎
  const engineKey = localStorage.getItem('moonfog_engine') || 'auto';
  if (usesBrowserSearch() && engineKey === 'auto') {
    submitBrowserSearch(query);
    return;
  }

  openEngineSearch(query);
}

/** 网页版 / Firefox / Safari / 指定引擎：按页面内选择的引擎打开搜索结果 */
function openEngineSearch(query) {
  let engineKey = localStorage.getItem('moonfog_engine') || DEFAULT_ENGINE;
  if (engineKey === 'auto') engineKey = DEFAULT_ENGINE;

  // 先检查自定义引擎
  const customEngines = getCustomEngines();
  if (customEngines[engineKey]) {
    const url = customEngines[engineKey].url.replace('%s', encodeURIComponent(query));
    window.location.href = url;
    return;
  }

  // 内置引擎
  const engine = SEARCH_ENGINES[engineKey] || SEARCH_ENGINES[DEFAULT_ENGINE];
  window.location.href = engine.getUrl(query);
}

/**
 * 自定义引擇- 读写
 */
function getCustomEngines() {
  try {
    return JSON.parse(localStorage.getItem('moonfog_custom_engines') || '{}');
  } catch { return {}; }
}

function saveCustomEngines(engines) {
  localStorage.setItem('moonfog_custom_engines', JSON.stringify(engines));
}

/**
 * 自定义引擇- 创建 DOM
 * 使用 div[role=radio] + 独立删除按钮，避免button 嵌套
 */
function createCustomEngineEl(key, name, url) {
  const row = document.createElement('div');
  row.className = 'engine-item';
  row.dataset.value = key;
  row.setAttribute('role', 'radio');
  row.setAttribute('aria-checked', 'false');
  row.tabIndex = 0;

  let host = '';
  try {
    host = new URL(url.split('%s')[0]).hostname;
  } catch {}

  const initial = (name.charAt(0) || '?').toUpperCase();
  const safeName = escapeHtml(name);
  const safeKey = escapeAttr(key);
  const faviconSrc = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
    : '';

  const favicon = document.createElement('img');
  favicon.width = 16;
  favicon.height = 16;
  favicon.alt = '';
  favicon.setAttribute('aria-hidden', 'true');
  favicon.addEventListener('error', () => fallbackIcon(favicon, initial));

  row.innerHTML = `
    <span class="engine-name">${safeName}</span>
    <button type="button" class="engine-delete" data-delete="${safeKey}" aria-label="删除 ${safeName}">
      <span class="mgc_close_line" aria-hidden="true"></span>
    </button>
    <span class="check-icon" aria-hidden="true"><span class="mgc_check_line"></span></span>
  `;

  const selectEngine = () => {
    const grid = document.getElementById('engineGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-value]').forEach((c) => c.classList.remove('active'));
    row.classList.add('active');
    syncRadioSelection(grid);
    localStorage.setItem('moonfog_engine', key);
  };

  row.insertBefore(favicon, row.firstChild);
  if (faviconSrc) favicon.src = faviconSrc;
  else fallbackIcon(favicon, initial);

  row.addEventListener('click', (e) => {
    if (e.target.closest('.engine-delete')) return;
    selectEngine();
  });

  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectEngine();
    }
  });

  row.querySelector('.engine-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.confirm(`确定删除「${name}」？`)) return;

    const engines = getCustomEngines();
    delete engines[key];
    saveCustomEngines(engines);

    if (localStorage.getItem('moonfog_engine') === key) {
      localStorage.setItem('moonfog_engine', DEFAULT_ENGINE);
      initCardSelection('engineGrid', 'moonfog_engine', DEFAULT_ENGINE);
    }

    row.remove();
  });

  return row;
}

/**
 * 渲染所有自定义引擎到列表 */
function renderCustomEngines() {
  const grid = document.getElementById('engineGrid');
  if (!grid) return;
  // 移除旧的
  grid.querySelectorAll('.engine-item[data-value^="custom_"]').forEach(el => el.remove());
  
  const engines = getCustomEngines();
  for (const [key, val] of Object.entries(engines)) {
    grid.appendChild(createCustomEngineEl(key, val.name, val.url));
  }
}

/** 打开「添加自定义搜索引擎」弹窗 */
function openEngineModal() {
  const engineModal = document.getElementById('engineModal');
  const modalNameInput = document.getElementById('customEngineName');
  const modalUrlInput = document.getElementById('customEngineUrl');
  const errorEl = document.getElementById('engineModalError');
  if (!engineModal || !modalNameInput || !modalUrlInput) return;

  modalNameInput.value = '';
  modalUrlInput.value = '';
  if (typeof clearModalValidation === 'function') {
    clearModalValidation(errorEl, [modalNameInput, modalUrlInput]);
  }
  if (typeof openModal === 'function') openModal(engineModal, modalNameInput);
  else {
    engineModal.classList.add('active');
    engineModal.setAttribute('aria-hidden', 'false');
    engineModal.removeAttribute('inert');
    setTimeout(() => modalNameInput.focus(), 30);
  }
}

/** 关闭引擎弹窗 */
function closeEngineModal() {
  const engineModal = document.getElementById('engineModal');
  if (!engineModal) return;
  const errorEl = document.getElementById('engineModalError');
  const modalNameInput = document.getElementById('customEngineName');
  const modalUrlInput = document.getElementById('customEngineUrl');
  if (typeof clearModalValidation === 'function') {
    clearModalValidation(errorEl, [modalNameInput, modalUrlInput]);
  }
  const addEngineBtn = document.getElementById('addEngineBtn');
  if (typeof closeModal === 'function') closeModal(engineModal, addEngineBtn);
  else {
    engineModal.classList.remove('active');
    engineModal.setAttribute('aria-hidden', 'true');
    engineModal.setAttribute('inert', '');
    if (addEngineBtn && engineModal.contains(document.activeElement)) addEngineBtn.focus();
  }
}

/** 确认添加自定义引擇*/
function confirmAddCustomEngine() {
  const modalNameInput = document.getElementById('customEngineName');
  const modalUrlInput = document.getElementById('customEngineUrl');
  const errorEl = document.getElementById('engineModalError');
  const grid = document.getElementById('engineGrid');
  if (!modalNameInput || !modalUrlInput || !grid) return;

  const name = modalNameInput.value.trim();
  const url = modalUrlInput.value.trim();
  if (typeof clearModalValidation === 'function') {
    clearModalValidation(errorEl, [modalNameInput, modalUrlInput]);
  }

  if (!name) {
    if (typeof setModalError === 'function') setModalError(errorEl, '请填写引擎名称', modalNameInput);
    modalNameInput.focus();
    return;
  }
  if (!url) {
    if (typeof setModalError === 'function') setModalError(errorEl, '请填写搜索链接', modalUrlInput);
    modalUrlInput.focus();
    return;
  }
  if (!url.includes('%s')) {
    if (typeof setModalError === 'function') setModalError(errorEl, '链接里需要包启%s 作为搜索词占低', modalUrlInput);
    modalUrlInput.focus();
    return;
  }
  try {
    // allow %s in query
    const probe = url.replace('%s', 'test');
    // eslint-disable-next-line no-new
    new URL(probe);
  } catch (_) {
    if (typeof setModalError === 'function') setModalError(errorEl, '请输入有效的链接地址', modalUrlInput);
    modalUrlInput.focus();
    return;
  }

  const engines = getCustomEngines();
  const key = 'custom_' + Date.now();
  engines[key] = { name, url };
  saveCustomEngines(engines);

  grid.appendChild(createCustomEngineEl(key, name, url));
  grid.querySelectorAll('[data-value]').forEach((c) => c.classList.remove('active'));
  const created = grid.querySelector('[data-value="' + key + '"]');
  if (created) created.classList.add('active');
  syncRadioSelection(grid);
  localStorage.setItem('moonfog_engine', key);

  closeEngineModal();
}

function initEngineSettings() {
  initCardClick('engineGrid', 'moonfog_engine', (value) => {
    localStorage.setItem('moonfog_engine', value);
    // 切换搜索引擎后：清掉记住的回退来源与候选链缓存，重新解析一次
    if (typeof resetSuggestProviderCache === 'function') resetSuggestProviderCache();
    if (typeof resetSuggestChain === 'function') resetSuggestChain();
    if (typeof suggestFailedProviders === 'object' && suggestFailedProviders.clear) suggestFailedProviders.clear();
    // 切换搜索引擎后立即按新引擎刷新联想
    if (typeof usesBrowserSearch === 'function' && usesBrowserSearch()) scheduleSearchSuggest();
  });

  const engineModal = document.getElementById('engineModal');
  const modalNameInput = document.getElementById('customEngineName');
  const modalUrlInput = document.getElementById('customEngineUrl');
  const errorEl = document.getElementById('engineModalError');
  const addEngineBtn = document.getElementById('addEngineBtn');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const modalConfirm = document.getElementById('modalConfirm');

  if (addEngineBtn) addEngineBtn.addEventListener('click', openEngineModal);
  if (modalClose) modalClose.addEventListener('click', closeEngineModal);
  if (modalCancel) modalCancel.addEventListener('click', closeEngineModal);
  if (modalConfirm) modalConfirm.addEventListener('click', confirmAddCustomEngine);

  if (engineModal) {
    engineModal.addEventListener('click', (e) => {
      if (e.target === engineModal) closeEngineModal();
    });
  }

  [modalNameInput, modalUrlInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', () => {
      if (typeof clearModalValidation === 'function') {
        clearModalValidation(errorEl, [modalNameInput, modalUrlInput]);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmAddCustomEngine();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeEngineModal();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!engineModal || !engineModal.classList.contains('active')) return;
    e.preventDefault();
    closeEngineModal();
  });
}
