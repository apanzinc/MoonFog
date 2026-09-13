/**
 * MoonFog - 配置与默认值
 */

// 问候语模板
const GREETING_TEMPLATES = {
  morning: name => `早安，${name}`,
  afternoon: name => `午安，${name}`,
  evening: name => `下午好，${name}`,
  night: name => `晚上好，${name}`,
  lateNight: name => `夜深了，${name}`
};

// 默认用户名
const DEFAULT_USERNAME = '朋友';

// 字体配置
const FONTS = {
  sourcehanserif: "'SourceHanSerif', 'Noto Serif SC', 'Source Han Serif SC', serif",
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
};

const CUSTOM_SYSTEM_FONT_KEY = 'moonfog_custom_system_font';

function normalizeSystemFontName(name) {
  return String(name || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[;{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function makeSystemFontFamily(name) {
  const normalized = normalizeSystemFontName(name);
  if (!normalized) return '';
  const quoted = normalized.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${quoted}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
}

function getCustomSystemFontName() {
  try {
    return normalizeSystemFontName(localStorage.getItem(CUSTOM_SYSTEM_FONT_KEY));
  } catch (_) {
    return '';
  }
}

function syncCustomSystemFont() {
  const name = getCustomSystemFontName();
  if (name) FONTS.custom = makeSystemFontFamily(name);
  else delete FONTS.custom;
  return name;
}

function saveCustomSystemFontName(name) {
  const normalized = normalizeSystemFontName(name);
  try {
    if (normalized) localStorage.setItem(CUSTOM_SYSTEM_FONT_KEY, normalized);
    else localStorage.removeItem(CUSTOM_SYSTEM_FONT_KEY);
  } catch (_) {}
  syncCustomSystemFont();
  return normalized;
}

syncCustomSystemFont();

const DEFAULT_FONT = 'sourcehanserif';
const DEFAULT_WEIGHT = '700';

/** 页面各文字区域：问候主文案 / 来源副标题 / 搜索框 / 快捷标签 */
const TYPE_ROLE_KEYS = ['greeting', 'greetingSub', 'search', 'shortcuts'];

const DEFAULT_TYPE_ROLES = {
  greeting: { font: 'sourcehanserif', weight: '700', size: 100 },
  greetingSub: { font: 'system', weight: '400', size: 100 },
  search: { font: 'system', weight: '400', size: 100 },
  shortcuts: { font: 'system', weight: '450', size: 100 }
};

/** 字号缩放 %：70–140，100 为默认 */
const TYPE_SIZE_MIN = 70;
const TYPE_SIZE_MAX = 140;
const TYPE_SIZE_DEFAULT = 100;

const TYPE_ROLE_META = {
  greeting: {
    label: '问候主文案',
    tip: '欢迎语 / 时间 / 日期 / 每日一言正文',
    weightDefault: '700',
    weights: ['400', '500', '600', '700'],
    sizeDefault: 100
  },
  greetingSub: {
    label: '来源副标题',
    tip: '每日一言出处、时间日期副文案',
    weightDefault: '400',
    weights: ['400', '500', '600', '700'],
    sizeDefault: 100
  },
  search: {
    label: '搜索框',
    tip: '搜索输入文字与占位符',
    weightDefault: '400',
    weights: ['400', '500', '600', '700'],
    sizeDefault: 100
  },
  shortcuts: {
    label: '快捷标签',
    tip: '底部快捷导航文字',
    weightDefault: '450',
    // 450 为系统无衬线常用中间档；思源宋体无 450 文件时会落到最近字重
    weights: ['400', '500', '600', '700'],
    sizeDefault: 100
  }
};

function normalizeTypeSize(size, fallback) {
  const n = Number(size);
  const fb = Number.isFinite(Number(fallback)) ? Number(fallback) : TYPE_SIZE_DEFAULT;
  if (!Number.isFinite(n)) return Math.min(TYPE_SIZE_MAX, Math.max(TYPE_SIZE_MIN, Math.round(fb)));
  return Math.min(TYPE_SIZE_MAX, Math.max(TYPE_SIZE_MIN, Math.round(n)));
}

const TYPE_ROLES_STORAGE_KEY = 'moonfog_type_roles';

/** 兼容旧 key：源ノ明朝 = 思源宋体日文版，统一迁到思源宋体 */
function resolveFontKey(fontKey) {
  if (fontKey === 'genyomin') return 'sourcehanserif';
  // 兼容旧「自定义系统字体」：转成 sys:名称
  if (fontKey === 'custom') {
    const legacy = typeof getCustomSystemFontName === 'function' ? getCustomSystemFontName() : '';
    return legacy ? ('sys:' + legacy) : 'system';
  }
  if (typeof fontKey === 'string' && fontKey.indexOf('sys:') === 0) {
    const name = typeof normalizeSystemFontName === 'function'
      ? normalizeSystemFontName(fontKey.slice(4))
      : String(fontKey.slice(4) || '').trim();
    return name ? ('sys:' + name) : 'system';
  }
  if (fontKey && FONTS[fontKey]) return fontKey;
  return DEFAULT_FONT;
}

function getFontFamily(fontKey) {
  const key = resolveFontKey(fontKey);
  if (key.indexOf('sys:') === 0) {
    return typeof makeSystemFontFamily === 'function'
      ? makeSystemFontFamily(key.slice(4))
      : FONTS.system;
  }
  return FONTS[key] || FONTS[DEFAULT_FONT] || FONTS.system;
}

function getFontLabel(fontKey) {
  const key = resolveFontKey(fontKey);
  if (key === 'sourcehanserif') return '\u601d\u6e90\u5b8b\u4f53';
  if (key === 'system') return '\u7cfb\u7edf\u9ed8\u8ba4';
  if (key.indexOf('sys:') === 0) return key.slice(4);
  return key;
}

/**
 * 检查字体是否支持粗细调整
 * - 思源宋体支持 400/500/600/700 四档
 * - 系统字体 / 自定义字体也支持 CSS font-weight
 */
function fontSupportsWeight(fontKey) {
  const key = resolveFontKey(fontKey);
  if (key === 'sourcehanserif') return true;
  if (key === 'system') return true;
  if (typeof key === 'string' && key.indexOf('sys:') === 0) return true;
  // 所有字体均支持粗细
  return true;
}

function getSupportedWeights(fontKey) {
  // 所有字体均支持 400~700 粗细范围，无限制
  if (!fontSupportsWeight(fontKey)) return [];
  return ['400', '500', '600', '700'];
}


function normalizeWeight(weight, fallback) {
  const w = String(weight == null ? '' : weight);
  if (/^(400|450|500|600|700)$/.test(w)) return w;
  return String(fallback || DEFAULT_WEIGHT);
}

/**
 * 读取各区域字体配置；兼容旧 moonfog_font / moonfog_weight（只作用于问候主文案）
 */
function loadTypeRoles() {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_TYPE_ROLES));
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(TYPE_ROLES_STORAGE_KEY) || 'null');
  } catch (_) {
    stored = null;
  }

  // 迁移旧全局字体
  const legacyFontRaw = localStorage.getItem('moonfog_font');
  const legacyWeight = localStorage.getItem('moonfog_weight');
  if (legacyFontRaw || legacyWeight) {
    const legacyFont = resolveFontKey(legacyFontRaw || defaults.greeting.font);
    defaults.greeting.font = legacyFont;
    if (legacyWeight) defaults.greeting.weight = normalizeWeight(legacyWeight, defaults.greeting.weight);
  }

  const roles = {};
  TYPE_ROLE_KEYS.forEach((key) => {
    const base = defaults[key] || DEFAULT_TYPE_ROLES.greeting;
    const fromStore = stored && stored[key] ? stored[key] : null;
    const sizeDefault =
      (TYPE_ROLE_META[key] && TYPE_ROLE_META[key].sizeDefault) ||
      base.size ||
      TYPE_SIZE_DEFAULT;
    roles[key] = {
      font: resolveFontKey((fromStore && fromStore.font) || base.font),
      weight: normalizeWeight((fromStore && fromStore.weight) || base.weight, base.weight),
      size: normalizeTypeSize(
        fromStore && fromStore.size != null ? fromStore.size : base.size,
        sizeDefault
      )
    };
  });
  return roles;
}

function saveTypeRoles(roles) {
  try {
    localStorage.setItem(TYPE_ROLES_STORAGE_KEY, JSON.stringify(roles));
    // 同步旧 key，避免 boot / 外部脚本读到过期全局字体
    if (roles.greeting) {
      localStorage.setItem('moonfog_font', roles.greeting.font);
      localStorage.setItem('moonfog_weight', roles.greeting.weight);
      localStorage.setItem(
        'moonfog_greeting_size',
        String(normalizeTypeSize(roles.greeting.size, TYPE_SIZE_DEFAULT))
      );
    }
  } catch (_) {}
}

// 搜索引擎配置
const SEARCH_ENGINES = {
  google: {
    name: 'Google',
    getUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  bing: {
    name: 'Bing',
    getUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  baidu: {
    name: '百度',
    getUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
  },
  meta: {
    name: '秘塔AI搜索',
    getUrl: (query) => `https://metaso.cn/search/${encodeURIComponent(query)}`
  },
  chatgpt: {
    name: 'ChatGPT',
    getUrl: (query) => `https://chatgpt.com/?q=${encodeURIComponent(query)}`
  },
  claude: {
    name: 'Claude',
    getUrl: (query) => `https://claude.ai/new?q=${encodeURIComponent(query)}`
  }
};

const DEFAULT_ENGINE = 'bing';
const DEFAULT_TONE = 'sand';
const DEFAULT_MODE = 'light';
// 用户明暗偏好：light | dark | system
const MODE_PREF_KEY = 'moonfog_mode_pref';
const DEFAULT_MODE_PREF = 'light';
const MODE_PREFS = {
  light: 'light',
  dark: 'dark',
  system: 'system'
};

function normalizeModePref(pref) {
  const p = String(pref || '');
  if (p === 'dark' || p === 'system' || p === 'light') return p;
  // 兼容旧版只存 light/dark 到 moonfog_mode
  if (p === 'auto' || p === 'wallpaper') return 'system';
  return DEFAULT_MODE_PREF;
}

function getSystemColorScheme() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (_) {}
  return 'light';
}

/**
 * 解析最终生效的 light/dark
 * @param {string} pref
 * @param {{ sceneDark?: boolean }} [ctx]
 */
function resolveEffectiveMode(pref, ctx) {
  const p = normalizeModePref(pref);
  if (p === 'dark' || p === 'light') return p;
  if (p === 'system') return getSystemColorScheme();
  return DEFAULT_MODE;
}

function loadModePref() {
  try {
    const pref = localStorage.getItem(MODE_PREF_KEY);
    if (pref) return normalizeModePref(pref);
    // 迁移：旧版只有 moonfog_mode = light|dark
    const legacy = localStorage.getItem('moonfog_mode');
    if (legacy === 'dark' || legacy === 'light') return legacy;
  } catch (_) {}
  return DEFAULT_MODE_PREF;
}

function saveModePref(pref) {
  const p = normalizeModePref(pref);
  try {
    localStorage.setItem(MODE_PREF_KEY, p);
  } catch (_) {}
  return p;
}

function resolveToneKey(tone) {
  const t = String(tone || '');
  if (t === 'custom') return DEFAULT_TONE;
  const ok = { sand: 1, cream: 1, rose: 1, sage: 1, sky: 1, lavender: 1, slate: 1 };
  if (ok[t]) return t;
  return DEFAULT_TONE;
}
// 问候区显示模式
const GREETING_MODES = {
  greeting: 'greeting',
  clock: 'clock',
  date: 'date',
  quote: 'quote',
  custom: 'custom'
};
const DEFAULT_GREETING_MODE = GREETING_MODES.greeting;
// 当前时间：12/24 小时制 + 是否显示下方日期
const CLOCK_HOUR12_KEY = 'moonfog_clock_hour12';
const CLOCK_SHOW_DATE_KEY = 'moonfog_clock_show_date';
const DEFAULT_CLOCK_HOUR12 = false;
const DEFAULT_CLOCK_SHOW_DATE = true;
// 自定义欢迎语
const CUSTOM_TEXT_KEY = 'moonfog_custom_text';
const DEFAULT_CUSTOM_TEXT = '';
const CUSTOM_TEXT_MAX_LEN = 48;

// 每日一言 API（优先文学/诗词/动画/影视，相对更通顺；点击可换句）
// c=d 文学, c=i 诗词, c=a 动画, c=b 漫画, c=h 影视
// max_length 由运行时按用户字数限制拼接
const HITOKOTO_API_BASES = [
  'https://v1.hitokoto.cn/?c=d&c=i&c=a&c=b&c=h&encode=json',
  'https://hitokoto.c0ffee.space/?c=d&c=i&c=a&c=b&c=h'
];
// 兼容旧引用
const HITOKOTO_API_URLS = HITOKOTO_API_BASES;
const DAILY_QUOTE_KEY = 'moonfog_daily_quote';
const QUOTE_RECENT_KEY = 'moonfog_quote_recent';
// 记住更多最近展示，尽量保证连续打开不重复
const QUOTE_RECENT_MAX = 40;
// 拉取时只避开最近 N 条，避免 recent 过满导致全拒
const QUOTE_AVOID_RECENT_CHECK = 12;
// 预加载池：跨标签页可用，打开优先取池，后台补 2～5 条
const QUOTE_POOL_KEY = 'moonfog_quote_pool';
const QUOTE_POOL_MIN = 8;
const QUOTE_POOL_MAX = 12;
const QUOTE_POOL_TARGET = 10;
// 首次欢迎 OOBE 完成标记
const OOBE_DONE_KEY = 'moonfog_oobe_done';

// 一言字数上限（设置可调）
const QUOTE_MAX_LEN_KEY = 'moonfog_quote_max_len';
const DEFAULT_QUOTE_MAX_LEN = 32;
const QUOTE_MAX_LEN_MIN = 16;
const QUOTE_MAX_LEN_MAX = 48;
// 连续不合格 / 失败时最多尝试次数
const QUOTE_FETCH_MAX_ATTEMPTS = 10;
const QUOTE_FETCH_ERROR_TEXT = '获取一言失败，请稍后点击重试';

// 内置每日一言（网络失败 / 过滤抽象后回退，偏通顺好懂）
const BUILTIN_QUOTES = [
  { content: '慢慢来，比较快。', author: '李宗盛' },
  { content: '星光不问赶路人，时光不负有心人。', author: '' },
  { content: '保持热爱，奔赴山海。', author: '' },
  { content: '凡是过往，皆为序章。', author: '莎士比亚' },
  { content: '路虽远，行则将至。', author: '' },
  { content: '山高自有客行路，水深自有渡船人。', author: '' },
  { content: '你所浪费的今天，是昨天死去的人奢望的明天。', author: '' },
  { content: '去做就对了，完美会迟到，但不会缺席。', author: '' },
  { content: '把每一天都当作生命中的最后一天。', author: '乔布斯' },
  { content: '世界很大，幸福很小，小到一个微笑就足够。', author: '' },
  { content: '不积跬步，无以至千里。', author: '荀子' },
  { content: '种一棵树最好的时间是十年前，其次是现在。', author: '' },
  { content: '少一点焦虑，多一点行动。', author: '' },
  { content: '今天的努力，是为了明天的从容。', author: '' },
  { content: '你不必很厉害才能开始，但你要开始才会很厉害。', author: '' },
  { content: '心之所向，素履以往。', author: '' },
  { content: '生活不是等待风暴过去，而是学会在雨中跳舞。', author: '' },
  { content: '把简单的事情做好，就是不简单。', author: '' },
  { content: '愿你成为自己的光。', author: '' },
  { content: '所有美好，都在路上。', author: '' }
];
const DEFAULT_BG_MODE = 'solid'; // solid | grain | local | bing
const BG_MODE_KEY = 'moonfog_bg_mode';
const LOCAL_BG_KEY = 'moonfog_bg_local';
const BING_CACHE_KEY = 'moonfog_bg_bing';
const BING_POOL_KEY = 'moonfog_bg_bing_pool';
const BING_POOL_SIZE = 8; // 今日 + 近几日，供「换一张」
const BG_BLUR_KEY = 'moonfog_bg_blur';
const DEFAULT_BG_BLUR = 20; // px，0–40
// 背景中性遮罩：-50 偏黑 … 0 无色 … +50 偏白（不走取色色相）
const BG_WASH_KEY = 'moonfog_bg_wash';
// 默认偏黑，提升图片背景上文案对比度
const DEFAULT_BG_WASH = -20;
const SEARCH_BLUR_KEY = 'moonfog_search_blur';
const DEFAULT_SEARCH_BLUR = 40; // 搜索框毛玻璃
const PANEL_BLUR_KEY = 'moonfog_panel_blur';
const DEFAULT_PANEL_BLUR = 10; // 设置面板毛玻璃（偏实）
// 性能档位：full 完整体验 | balanced 部分限制 | low 完全限制
const PERF_MODE_KEY = 'moonfog_perf_mode';
const DEFAULT_PERF_MODE = 'full';
// 兼容旧键 moonfog_low_perf
const LOW_PERF_KEY = 'moonfog_low_perf';
const DEFAULT_LOW_PERF = false;

function normalizePerfMode(value) {
  const v = String(value == null ? '' : value).toLowerCase();
  if (v === 'full' || v === '0' || v === 'off' || v === 'false') return 'full';
  if (v === 'balanced' || v === '1' || v === 'partial' || v === 'mid') return 'balanced';
  if (v === 'low' || v === '2' || v === 'full-limit' || v === 'true' || v === 'on') return 'low';
  return DEFAULT_PERF_MODE;
}
const LOCAL_BG_MAX_BYTES = 2.2 * 1024 * 1024; // 压缩后上限，避免撑爆存储

// 当前用户名
let currentUsername = DEFAULT_USERNAME;
// 当前自定义欢迎语
let currentCustomText = DEFAULT_CUSTOM_TEXT;
// 当前问候区模式
let currentGreetingMode = DEFAULT_GREETING_MODE;
// 当前会话的一言（每次打开新标签页都会重新拉取）
let cachedDailyQuote = null;
let cachedQuoteDayKey = '';
// 点击换句进行中
let quoteSwitching = false;
// 本次打开是否已完成首次一言拉取
let quoteSessionReady = false;
// 首次拉取进行中（用于骨架屏）
let quoteBootLoading = false;
// 预加载池补货进行中
let quotePoolRefillPromise = null;
// 一言单通道：进行中禁止二次写入（打开/换句/定时器共用）
let quoteBusy = false;
// 每次展示递增，过期响应直接丢弃
let quoteCommitId = 0;
// 一言字数上限（运行时）
let currentQuoteMaxLen =
  typeof DEFAULT_QUOTE_MAX_LEN === 'number' ? DEFAULT_QUOTE_MAX_LEN : 32;
// 背景状态：同步读 localStorage，避免 initBackground 异步/异常导致设置面板显示错误模式
let currentBgMode = DEFAULT_BG_MODE;
try {
  const _saved = localStorage.getItem(BG_MODE_KEY);
  if (_saved === 'solid' || _saved === 'bing' || _saved === 'local' || _saved === 'grain') {
    currentBgMode = _saved;
  }
} catch (_) {}
let currentBingMeta = null;
let localBgDataUrl = '';
let currentBgBlur = DEFAULT_BG_BLUR;
let currentBgWash = DEFAULT_BG_WASH;
// 图片取色结果缓存（按 url 粗略缓存）
let lastPaletteUrl = '';
let lastPalette = null;
// 最近一次取样的主色（切换明暗时复用，无需重读图）
let lastDominant = null;
