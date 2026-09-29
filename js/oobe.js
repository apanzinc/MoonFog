/**
 * MoonFog - 首次欢迎 OOBE
 * 左右切换动画 + 外观选择
 */

// image：右侧介绍图路径（放 images/oobe/ 下即可）
const OOBE_STEPS = [
  {
    id: 'welcome',
    kicker: 'MoonFog',
    title: '欢迎使用 MoonFog',
    desc: '用几步完成初始设置。点「开始」继续，之后随时可在设置中修改。',
    points: [
      { icon: 'mgc_pic_2_line', title: '主页背景', tip: '纯色、流光渐变、必应每日或本地图片' },
      { icon: 'mgc_sun_line', title: '界面明暗', tip: '浅色、深色，或跟随系统/ 壁纸' },
      { icon: 'mgc_emoji_line', title: '问候内容', tip: '问候语、时间、日期或每日一言' },
      { icon: 'mgc_information_line', title: '功能提示', tip: '模糊、性能与数据备份等可在设置中找到。' },
    ],
    pointsStyle: 'cards',
    // 右侧：系统背景色 + 居中 logo（不读静态welcome.png）
    logo: true,
    image: ''
  },
  {
    id: 'wallpaper',
    kicker: '背景',
    title: '选择主页背景',
    desc: '纯色简洁；流光渐变灵动；也可使用必应每日或本地图片。',
    points: [],
    wallpaper: true,
    // 右侧用实时预览，不读静态图
    image: ''
  },
  {
    id: 'appearance',
    kicker: '外观',
    title: '选择界面明暗',
    desc: '可跟随壁纸深浅自动切换。纯色背景时「壁纸」会改跟系统。',
    points: [],
    appearance: true,
    livePreview: true,
    image: ''
  },
  {
    id: 'greeting',
    kicker: '问候',
    title: '选择问候内容',
    desc: '主页上方显示什么。需要称呼时再填写你的名字。',
    points: [],
    greeting: true,
    livePreview: true,
    image: ''
  },
  {
    id: 'settings',
    kicker: '个性化',
    title: '更多选项在设置里',
    desc: '把鼠标移到页面右下角，点齿轮打开设置。之后可随时改外观、问候与数据。',
    points: [
      { icon: 'mgc_palette_line', title: '外观与背景', tip: '主题、壁纸与明暗' },
      { icon: 'mgc_emoji_line', title: '问候与文字', tip: '显示内容与字体' },
      { icon: 'mgc_eye_line', title: '显示与效果', tip: '模糊强度与性能' },
      { icon: 'mgc_folder_line', title: '数据管理', tip: '导出、导入与重置' }
    ],
    pointsStyle: 'cards',
    pointsNoNum: true,
    settingsTip: true,
    image: ''
  },
  {
    id: 'ready',
    kicker: 'MoonFog',
    title: 'MoonFog',
    desc: '欢迎使用',
    points: [],
    // 与欢迎页同布局：居中 logo + 标题
    logo: true,
    image: ''
  }
];

// 先选背景，再选明暗；默认跟随壁纸
const OOBE_APPEARANCE = [
  { id: 'light', label: '浅色', icon: 'mgc_sun_line', tip: '固定浅色' },
  { id: 'dark', label: '深色', icon: 'mgc_moon_line', tip: '固定深色' },
  { id: 'system', label: '系统', icon: 'mgc_computer_line', tip: '跟随系统' },
  { id: 'wallpaper', label: '壁纸', icon: 'mgc_pic_2_line', tip: '跟随壁纸' }
];

const OOBE_WALLPAPER = [
  { id: 'solid', label: '纯色', icon: 'mgc_palette_line', tip: '主题色调' },
  { id: 'grain', label: '流光渐变', icon: 'mgc_sparkles_line', tip: '动态柔和' },
  { id: 'bing', label: '必应每日', icon: 'mgc_sun_line', tip: '每日一图' },
  { id: 'local', label: '本地图片', icon: 'mgc_pic_2_line', tip: '选一张图' }
];

// 纯色色调（与设置页一致）
const OOBE_TONES = [
  { id: 'sand', label: '暖沙', color: '#F5F0E8', darkColor: '#1E1C18' },
  { id: 'cream', label: '奶油', color: '#FDF6EC', darkColor: '#1E1A14' },
  { id: 'rose', label: '玫瑰', color: '#F8EDE8', darkColor: '#1E1818' },
  { id: 'sage', label: '青苔', color: '#ECEEE5', darkColor: '#181C16' },
  { id: 'sky', label: '晴空', color: '#E8F0F5', darkColor: '#161B20' },
  { id: 'lavender', label: '薄紫', color: '#EDE8F0', darkColor: '#1A1620' },
  { id: 'slate', label: '素墨', color: '#E8E9EC', darkColor: '#1A1B1E' }
];

const OOBE_GREETING_MODES = [
  { id: 'greeting', label: '问候语', icon: 'mgc_emoji_line', tip: '按时段称呼', needsName: true },
  { id: 'quote', label: '每日一言', icon: 'mgc_quote_left_line', tip: '随机金句' },
  { id: 'clock', label: '当前时间', icon: 'mgc_time_line', tip: '大号时钟' },
  { id: 'date', label: '日期', icon: 'mgc_calendar_line', tip: '今日日期' },
  { id: 'custom', label: '自定义', icon: 'mgc_edit_2_line', tip: '自己写一句', needsCustom: true }
];

let oobeStep = 0;
let oobeBound = false;
let oobeAnimToken = 0;
let oobeAppearancePref = 'wallpaper';
let oobeBgMode = 'solid';
let oobeTone = 'sand';
/** 本次欢迎是否新选了本地图（不用历史本地图冒充预览） */
let oobeLocalPickedSession = false;
let oobeGreetingMode = 'greeting';
let oobeUsername = '';
let oobeCustomText = '';
/** 进入 OOBE 前的真实配置快照；未点完成刷新时恢复 */
let oobeBaseline = null;
/** 本地图预触发dataUrl（未完成前不写入LOCAL_BG_KEY（*/
let oobeLocalPreviewDataUrl = '';
/** 右侧媒体当前种类，步骤切换时同种不重载*/
let oobeMediaKind = '';
let oobePreviewAnimToken = 0;
let oobeIntroTimer = 0;

function oobeStorageKey() {
  return typeof OOBE_DONE_KEY === 'string' ? OOBE_DONE_KEY : 'moonfog_oobe_done';
}

function captureOobeBaseline() {
  const bgKey = typeof BG_MODE_KEY === 'string' ? BG_MODE_KEY : 'moonfog_bg_mode';
  const localKey = typeof LOCAL_BG_KEY === 'string' ? LOCAL_BG_KEY : 'moonfog_bg_local';
  const customKey =
    typeof CUSTOM_TEXT_KEY === 'string' ? CUSTOM_TEXT_KEY : 'moonfog_custom_text';
  const prefKey =
    typeof MODE_PREF_KEY === 'string' ? MODE_PREF_KEY : 'moonfog_mode_pref';
  let snap = {
    modePref: 'system',
    mode: 'light',
    tone: 'sand',
    bgMode: 'solid',
    greetingMode: 'greeting',
    username: '',
    customText: '',
    localBg: null,
    hadLocalBg: false
  };
  try {
    snap.modePref =
      (typeof loadModePref === 'function' && loadModePref()) ||
      localStorage.getItem(prefKey) ||
      document.documentElement.getAttribute('data-mode-pref') ||
      'system';
    snap.mode =
      document.documentElement.getAttribute('data-mode') ||
      localStorage.getItem('moonfog_mode') ||
      'light';
    snap.tone =
      document.documentElement.getAttribute('data-tone') ||
      localStorage.getItem('moonfog_tone') ||
      (typeof DEFAULT_TONE === 'string' ? DEFAULT_TONE : 'sand');
    snap.bgMode =
      (typeof currentBgMode === 'string' && currentBgMode) ||
      localStorage.getItem(bgKey) ||
      'solid';
    snap.greetingMode = localStorage.getItem('moonfog_greeting_mode') || 'greeting';
    snap.username = localStorage.getItem('moonfog_username') || '';
    snap.customText = localStorage.getItem(customKey) || '';
    const local = localStorage.getItem(localKey);
    snap.hadLocalBg = !!(local && local.length);
    // 不把整图塞进 baseline（可能很大）；用 hadLocalBg + 内存 localBgDataUrl 还原
    snap.localBgInMemory =
      typeof localBgDataUrl === 'string' && localBgDataUrl ? localBgDataUrl : '';
  } catch (_) {}
  oobeBaseline = snap;
  return snap;
}

/**
 * 未完成OOBE 时：把预览改动撤回到进入前的配置
 */
function restoreOobeBaseline() {
  const b = oobeBaseline;
  if (!b) return;
  try {
    const pref =
      typeof normalizeModePref === 'function'
        ? normalizeModePref(b.modePref)
        : b.modePref;
    const tone =
      typeof resolveToneKey === 'function' ? resolveToneKey(b.tone) : b.tone;
    if (typeof applyTheme === 'function') {
      applyTheme(tone, pref, { animate: false, persist: true });
    } else {
      document.documentElement.setAttribute('data-tone', tone);
      document.documentElement.setAttribute('data-mode-pref', pref);
      document.documentElement.setAttribute('data-mode', b.mode || 'light');
      localStorage.setItem('moonfog_tone', tone);
      localStorage.setItem('moonfog_mode', b.mode || 'light');
      localStorage.setItem(
        typeof MODE_PREF_KEY === 'string' ? MODE_PREF_KEY : 'moonfog_mode_pref',
        pref
      );
    }

    // 本地图：若进入时磁盘有图，保持；OOBE 期间只预览的图不要写盘
    if (typeof localBgDataUrl !== 'undefined') {
      if (b.hadLocalBg && b.localBgInMemory) {
        localBgDataUrl = b.localBgInMemory;
      } else if (!b.hadLocalBg) {
        // 进入时没有本地图：清掉预览内存，不要污染盘
        if (oobeLocalPreviewDataUrl) {
          localBgDataUrl = '';
        }
      }
    }
    oobeLocalPreviewDataUrl = '';

    const bg =
      typeof normalizeBgMode === 'function'
        ? normalizeBgMode(b.bgMode)
        : b.bgMode;
    if (typeof applyBackgroundMode === 'function') {
      Promise.resolve(
        applyBackgroundMode(bg, { silent: true, persist: true })
      ).catch(() => {});
    } else {
      localStorage.setItem(
        typeof BG_MODE_KEY === 'string' ? BG_MODE_KEY : 'moonfog_bg_mode',
        bg
      );
    }

    localStorage.setItem('moonfog_greeting_mode', b.greetingMode || 'greeting');
    if (typeof applyGreetingMode === 'function') {
      applyGreetingMode(b.greetingMode || 'greeting', false);
    }
    if (b.username) localStorage.setItem('moonfog_username', b.username);
    else localStorage.removeItem('moonfog_username');
    if (typeof currentUsername !== 'undefined') {
      currentUsername =
        b.username ||
        (typeof DEFAULT_USERNAME === 'string' ? DEFAULT_USERNAME : '朋友');
    }
    const customKey =
      typeof CUSTOM_TEXT_KEY === 'string' ? CUSTOM_TEXT_KEY : 'moonfog_custom_text';
    if (b.customText) localStorage.setItem(customKey, b.customText);
    else localStorage.removeItem(customKey);
    if (typeof currentCustomText !== 'undefined') {
      currentCustomText = b.customText || '';
    }
  } catch (_) {}
}

function isOobeDone() {
  try {
    return localStorage.getItem(oobeStorageKey()) === '1';
  } catch (_) {
    return false;
  }
}

function markOobeDone() {
  try {
    localStorage.setItem(oobeStorageKey(), '1');
  } catch (_) {}
}

function clearOobeDone() {
  try {
    localStorage.removeItem(oobeStorageKey());
  } catch (_) {}
}

function isOobeActive() {
  return document.body.classList.contains('oobe-active');
}

function getOobeAppearancePref() {
  try {
    if (typeof loadModePref === 'function') return loadModePref();
    if (typeof getModePref === 'function') return getModePref();
    const p = localStorage.getItem(
      typeof MODE_PREF_KEY === 'string' ? MODE_PREF_KEY : 'moonfog_mode_pref'
    );
    return typeof normalizeModePref === 'function'
      ? normalizeModePref(p || 'wallpaper')
      : (p || 'wallpaper');
  } catch (_) {
    return 'wallpaper';
  }
}

function resolveOobePreviewDark() {
  const pref = oobeAppearancePref || 'system';
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (pref === 'wallpaper') {
    try {
      if (document.body.classList.contains('img-scene-dark')) return true;
      if (document.body.classList.contains('img-scene-light')) return false;
    } catch (_) {}
  }
  try {
    return !!(
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch (_) {
    return false;
  }
}

function applyOobeAppearance(pref, options = {}) {
  const next =
    typeof normalizeModePref === 'function'
      ? normalizeModePref(pref)
      : pref;
  // 纯色和Grain 没有可取样场景，「壁纸」无效→系统
  let resolved = next;
  if (
    resolved === 'wallpaper' &&
    !isOobeWallpaperSceneAvailable()
  ) {
    resolved = 'system';
  }
  oobeAppearancePref = resolved;
  // 默认实时预览界面；persist:true 才写盘）完成引导）
  const persist = options.persist === true;
  try {
    if (typeof applyTheme === 'function') {
      applyTheme(oobeTone || getOobeTone(), resolved, {
        animate: options.animate !== false,
        persist
      });
    } else if (persist) {
      if (typeof saveModePref === 'function') saveModePref(resolved);
      else {
        localStorage.setItem(
          typeof MODE_PREF_KEY === 'string' ? MODE_PREF_KEY : 'moonfog_mode_pref',
          resolved
        );
      }
    }
  } catch (_) {}
  syncOobeAppearanceUI();
  oobeMediaKind = 'preview';
  updateOobeWallpaperPreview(oobeBgMode || getOobeBgMode());
}

function isOobeWallpaperSceneAvailable() {
  const m = oobeBgMode || getOobeBgMode();
  return m === 'local' || m === 'bing';
}

function syncOobeAppearanceUI() {
  const grid = document.getElementById('oobeAppearance');
  if (!grid) return;
  let pref = oobeAppearancePref || getOobeAppearancePref();
  const supportsWallpaper = isOobeWallpaperSceneAvailable();
  // 没有可取样壁纸场景时隐藏「壁纸」选项，并落到系统。
  const wallBtn = grid.querySelector('[data-oobe-mode="wallpaper"]');
  if (wallBtn) {
    wallBtn.hidden = !supportsWallpaper;
    if (!supportsWallpaper && pref === 'wallpaper') {
      pref = 'system';
      oobeAppearancePref = 'system';
    }
  }
  grid.querySelectorAll('[data-oobe-mode]').forEach((btn) => {
    if (btn.hidden) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-checked', 'false');
      return;
    }
    const on = btn.getAttribute('data-oobe-mode') === pref;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  // 3 列或 4 列布局
  grid.classList.toggle('oobe-appear-3', !supportsWallpaper);
  grid.classList.toggle('oobe-appear-4', supportsWallpaper);
}

function getOobeBgMode() {
  // OOBE 内优先会话选择，绝不被主页 currentBgMode 带跑
  if (oobeBgMode) {
    return typeof normalizeBgMode === 'function'
      ? normalizeBgMode(oobeBgMode)
      : oobeBgMode;
  }
  try {
    const raw = localStorage.getItem(
      typeof BG_MODE_KEY === 'string' ? BG_MODE_KEY : 'moonfog_bg_mode'
    );
    return typeof normalizeBgMode === 'function'
      ? normalizeBgMode(raw || 'solid')
      : raw || 'solid';
  } catch (_) {
    return 'solid';
  }
}

function syncOobeWallpaperUI() {
  const grid = document.getElementById('oobeWallpaper');
  if (!grid) return;
  const mode = oobeBgMode || getOobeBgMode();
  grid.querySelectorAll('[data-oobe-bg]').forEach((btn) => {
    const on = btn.getAttribute('data-oobe-bg') === mode;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  const tip = document.getElementById('oobeWallpaperTip');
  if (tip) {
    // 纯色时用色调区备注，这里不再重复
    if (mode === 'solid') {
      tip.hidden = true;
      tip.textContent = '';
    } else {
      const tips = {
        grain: '使用动态流光渐句',
        bing: '将使用必应今日壁纸（需联网（',
        local: '从本机选择一张图片'
      };
      tip.textContent = tips[mode] || '';
      tip.hidden = !tips[mode];
    }
  }
  // 背景步骤：右侧实时预览当前选择
  updateOobeWallpaperPreview(mode);
}

/**
 * 迷你主页文案：跟所选问候模式实时同歉 */
function getOobeMiniGreetingText() {
  const mode = oobeGreetingMode || 'greeting';
  const now = new Date();
  const name =
    (oobeUsername && String(oobeUsername).trim()) ||
    (typeof currentUsername === 'string' && currentUsername) ||
    (typeof DEFAULT_USERNAME === 'string' ? DEFAULT_USERNAME : '朋友');

  if (mode === 'clock') {
    try {
      if (typeof formatClock === 'function') return formatClock(now);
    } catch (_) {}
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  if (mode === 'date') {
    try {
      if (typeof formatDateLabel === 'function') return formatDateLabel(now);
    } catch (_) {}
    return (
      now.getFullYear() +
      '年' +
      (now.getMonth() + 1) +
      '月' +
      now.getDate() +
      '日'
    );
  }
  if (mode === 'quote') {
    try {
      if (typeof cachedDailyQuote === 'object' && cachedDailyQuote && cachedDailyQuote.content) {
        return String(cachedDailyQuote.content);
      }
      if (typeof loadDailyQuoteCache === 'function') {
        const q = loadDailyQuoteCache();
        if (q && q.content) return String(q.content);
      }
    } catch (_) {}
    return '慢慢来，比较快。';
  }
  if (mode === 'custom') {
    const t = (oobeCustomText && String(oobeCustomText).trim()) || '';
    return t || '写下一句欢迎语…';
  }
  try {
    if (typeof getTimeGreeting === 'function') {
      return getTimeGreeting(name, now.getHours());
    }
  } catch (_) {}
  const h = now.getHours();
  if (h >= 6 && h < 12) return '早安，' + name;
  if (h >= 12 && h < 14) return '午安，' + name;
  if (h >= 14 && h < 19) return '下午好，' + name;
  if (h >= 19 && h < 22) return '晚上好，' + name;
  return '夜深了，' + name;
}

function refreshOobeMiniGreeting() {
  const greet = document.getElementById('oobeMiniGreeting');
  if (greet) greet.textContent = getOobeMiniGreetingText();
}

function getOobeBingPreviewUrl() {
  try {
    if (typeof currentBingMeta === 'object' && currentBingMeta) {
      const u = currentBingMeta.imageUrl || currentBingMeta.url || '';
      if (u) return u;
    }
    if (typeof readBingCache === 'function') {
      const c = readBingCache();
      if (c && (c.imageUrl || c.url)) return c.imageUrl || c.url;
    }
    const raw = localStorage.getItem(
      typeof BING_CACHE_KEY === 'string' ? BING_CACHE_KEY : 'moonfog_bg_bing'
    );
    if (raw) {
      const c = JSON.parse(raw);
      if (c && (c.imageUrl || c.url)) return c.imageUrl || c.url;
    }
  } catch (_) {}
  return '';
}

function setOobeMiniHomeVisible(show, isImage) {
  const mini = document.getElementById('oobeMiniHome');
  const greet = document.getElementById('oobeMiniGreeting');
  const note = document.getElementById('oobeMiniNote');
  const media = document.getElementById('oobeMedia');
  const frame = document.querySelector('.oobe-media-frame');
  if (greet) greet.textContent = getOobeMiniGreetingText();
  if (mini) {
    mini.hidden = !show;
    mini.classList.toggle('is-on-image', !!isImage);
    mini.classList.toggle('is-on-solid', !isImage && !!show);
    // 明暗预览：只作用在迷你主页，不动背后整页
    const dark = resolveOobePreviewDark();
    mini.classList.toggle('is-preview-dark', !!show && dark);
    mini.classList.toggle('is-preview-light', !!show && !dark);
  }
  if (note) {
    note.hidden = !show;
    note.classList.toggle('is-on-image', !!isImage);
  }
  // has-mini-home 挂在 media 上；frame 始终 overflow:hidden 保圆角
  if (media) media.classList.toggle('has-mini-home', !!show);
  if (frame) frame.classList.toggle('has-mini-home', !!show);
}

function setOobeGrainPreviewActive(active) {
  const frame = document.querySelector('.oobe-media-frame');
  if (frame) frame.classList.toggle('is-grain-preview', !!active);
  if (window.OobeGrain && typeof window.OobeGrain.setPreviewActive === 'function') {
    window.OobeGrain.setPreviewActive(!!active);
  }
}

function getOobeTone() {
  try {
    const t =
      document.documentElement.getAttribute('data-tone') ||
      localStorage.getItem('moonfog_tone') ||
      (typeof DEFAULT_TONE === 'string' ? DEFAULT_TONE : 'sand');
    if (t === 'custom') return typeof DEFAULT_TONE === 'string' ? DEFAULT_TONE : 'sand';
    return t;
  } catch (_) {
    return 'sand';
  }
}

function applyOobeTone(toneId, options = {}) {
  let next = String(toneId || 'sand');
  if (next === 'custom') next = typeof DEFAULT_TONE === 'string' ? DEFAULT_TONE : 'sand';
  oobeTone = next;
  const persist = options.persist === true;
  try {
    if (typeof applyTheme === 'function') {
      const pref =
        oobeAppearancePref ||
        (typeof getModePref === 'function' ? getModePref() : null) ||
        'system';
      applyTheme(next, pref, {
        animate: options.animate !== false,
        persist
      });
    } else {
      document.documentElement.setAttribute('data-tone', next);
      if (persist) localStorage.setItem('moonfog_tone', next);
    }
  } catch (_) {}
  syncOobeToneUI();
  oobeMediaKind = 'preview';
  updateOobeWallpaperPreview(oobeBgMode || getOobeBgMode());
}

function syncOobeToneUI() {
  const grid = document.getElementById('oobeToneSwatches');
  if (!grid) return;
  const cur = oobeTone || getOobeTone();
  grid.querySelectorAll('[data-oobe-tone]').forEach((btn) => {
    const on = btn.getAttribute('data-oobe-tone') === cur;
    // 与设置页一致：active
    btn.classList.toggle('active', on);
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function ensureOobeToneSwatches() {
  const grid = document.getElementById('oobeToneSwatches');
  if (!grid || grid.dataset.built === '1') return;
  grid.dataset.built = '1';
  // 复用设置页 theme-swatch 结构与样式
  grid.classList.add('theme-swatches');
  grid.innerHTML = OOBE_TONES.map((t) => {
    return (
      '<button type="button" class="theme-swatch" role="radio" data-oobe-tone="' +
      t.id +
      '" title="' +
      t.label +
      '" aria-label="' +
      t.label +
      '" aria-checked="false">' +
      '<span class="theme-swatch-fill" style="--swatch-light:' +
      t.color +
      ';--swatch-dark:' +
      t.darkColor +
      '" aria-hidden="true"></span>' +
      '<span class="theme-swatch-check mgc_check_line" aria-hidden="true"></span>' +
      '</button>'
    );
  }).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-oobe-tone]');
    if (!btn || !grid.contains(btn)) return;
    applyOobeTone(btn.getAttribute('data-oobe-tone'));
  });
}

function setOobeToneBlockVisible(show) {
  const block = document.getElementById('oobeToneBlock');
  if (!block) return;
  if (show) {
    block.hidden = false;
    ensureOobeToneSwatches();
    oobeTone = getOobeTone();
    syncOobeToneUI();
  } else {
    block.hidden = true;
  }
}

/**
 * 背景步骤右侧预览：纯色图+ 迷你主页（问倝+ 搜索 + 快捷（ */
function updateOobeWallpaperPreview(mode, options = {}) {
  const frame = document.querySelector('.oobe-media-frame');
  const grain = document.getElementById('oobeMediaGrain');
  const img = document.getElementById('oobeMediaImg');
  const empty = document.getElementById('oobeMediaEmpty');
  if (!frame || !grain || !img || !empty) return;

  // 从设置步返回 livePreview 时必须卸掉齿�?指针
  setOobeSettingsTipVisible(false);
  setOobeLogoPanelVisible(false);
  frame.classList.remove('has-settings-tip', 'has-logo');

  const m = mode || oobeBgMode || getOobeBgMode();
  const emptyText = empty.querySelector('.oobe-media-empty-text');

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const previousMode = frame.dataset.oobePreviewMode || '';
  if (!options.instant && !reduceMotion && previousMode && previousMode !== m) {
    const token = ++oobePreviewAnimToken;
    frame.classList.remove('is-preview-entering');
    frame.classList.add('is-preview-leaving');
    window.setTimeout(() => {
      if (token !== oobePreviewAnimToken) return;
      frame.dataset.oobePreviewMode = m;
      frame.classList.remove('is-preview-leaving');
      updateOobeWallpaperPreview(m, { instant: true });
      void frame.offsetWidth;
      frame.classList.add('is-preview-entering');
      window.setTimeout(() => {
        if (token === oobePreviewAnimToken) {
          frame.classList.remove('is-preview-entering');
        }
      }, 300);
    }, 160);
    return;
  }
  frame.dataset.oobePreviewMode = m;

  const playOobeBgEnter = (el) => {
    if (!el || reduceMotion) {
      if (el) {
        el.classList.remove('is-enter');
        el.classList.add('is-settle');
      }
      return;
    }
    el.classList.remove('is-enter', 'is-settle');
    // 强制重排，确保每次切换都重播缩放
    void el.offsetWidth;
    el.classList.add('is-enter');
    const done = () => {
      el.classList.remove('is-enter');
      el.classList.add('is-settle');
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
    window.setTimeout(done, 920);
  };

  const showSolid = () => {
    setOobeGrainPreviewActive(false);
    img.hidden = true;
    img.removeAttribute('src');
    img.alt = '';
    img.classList.remove('is-enter', 'is-settle');
    empty.hidden = true;
    frame.classList.add('has-image', 'is-solid-preview');
    frame.classList.remove('is-image-preview');
    // 画OOBE 所选色调，不读主页 CSS 变量（避免动主页主题）
    let warm = '#F5F0E8';
    try {
      const tid = oobeTone || getOobeTone();
      const meta = OOBE_TONES.find((t) => t.id === tid);
      if (meta) {
        warm = resolveOobePreviewDark() ? meta.darkColor : meta.color;
      }
      else if (typeof THEMES === 'object' && THEMES && THEMES[tid]) {
        const pack = THEMES[tid].light || THEMES[tid].dark;
        if (pack && pack['--bg-warm']) warm = String(pack['--bg-warm']).trim();
      }
    } catch (_) {}
    frame.style.background =
      'linear-gradient(145deg, ' + warm + ' 0%, ' + warm + ' 100%)';
    frame.classList.remove('is-solid-enter');
    void frame.offsetWidth;
    if (!reduceMotion) frame.classList.add('is-solid-enter');
    setOobeMiniHomeVisible(true, false);
  };

  const showImage = (url, label) => {
    setOobeGrainPreviewActive(false);
    frame.classList.remove('is-solid-preview', 'is-solid-enter');
    frame.classList.add('is-image-preview');
    frame.style.background = '';
    if (!url) {
      img.hidden = true;
      img.removeAttribute('src');
      img.classList.remove('is-enter', 'is-settle');
      empty.hidden = false;
      frame.classList.remove('has-image');
      if (emptyText) emptyText.textContent = label || '暂无预览';
      // 无图时也显示迷你主页，叠在占位上
      setOobeMiniHomeVisible(true, false);
      return;
    }
    empty.hidden = false;
    img.hidden = true;
    img.classList.remove('is-enter', 'is-settle');
    frame.classList.remove('has-image');
    setOobeMiniHomeVisible(true, true);
    const onLoad = () => {
      img.hidden = false;
      empty.hidden = true;
      frame.classList.add('has-image');
      setOobeMiniHomeVisible(true, true);
      playOobeBgEnter(img);
    };
    const onError = () => {
      img.hidden = true;
      img.classList.remove('is-enter', 'is-settle');
      empty.hidden = false;
      frame.classList.remove('has-image');
      if (emptyText) emptyText.textContent = label || '加载失败';
      setOobeMiniHomeVisible(true, false);
    };
    img.onload = onLoad;
    img.onerror = onError;
    img.alt = label || '背景预览';
    const same =
      img.getAttribute('src') === url && img.complete && img.naturalWidth > 0;
    if (same) {
      onLoad();
    } else {
      img.src = url;
    }
  };

  if (m === 'solid') {
    showSolid();
    // 色调 UI 只在「背景」步显示，不在问候明暗预览里带出
    return;
  }

  if (m === 'grain') {
    img.hidden = true;
    img.removeAttribute('src');
    img.alt = '';
    img.classList.remove('is-enter', 'is-settle');
    empty.hidden = true;
    frame.classList.remove('has-image', 'is-solid-preview', 'is-image-preview', 'is-solid-enter');
    frame.style.background = '';
    setOobeGrainPreviewActive(true);
    setOobeMiniHomeVisible(true, false);
    return;
  }

  if (m === 'local') {
    // 仅本次会话选中的本地图才预览（不读盘上旧图冒充）
    let url = '';
    if (oobeLocalPickedSession && oobeLocalPreviewDataUrl) {
      url = oobeLocalPreviewDataUrl;
    }
    if (url) {
      showImage(url, '本地图片');
    } else {
      const bing = getOobeBingPreviewUrl();
      if (bing) {
        showImage(bing, '未选图 · 显示必应预览');
      } else {
        showImage('', '请选择一张图片');
      }
    }
    return;
  }

  if (m === 'bing') {
    const url = getOobeBingPreviewUrl();
    showImage(url, url ? '必应今日' : '加载中…');
    if (!url) {
      window.setTimeout(() => {
        if ((oobeBgMode || getOobeBgMode()) === 'bing') {
          updateOobeWallpaperPreview('bing');
        }
      }, 800);
    }
  }
}

function applyOobeWallpaper(mode) {
  const next =
    typeof normalizeBgMode === 'function' ? normalizeBgMode(mode) : mode;
  oobeBgMode = next;

  if (next === 'local') {
    // 不高亮历史本地图：先用必应作预览，再弹文件选择
    oobeLocalPickedSession = false;
    oobeLocalPreviewDataUrl = '';
    oobeMediaKind = 'preview';
    syncOobeWallpaperUI();
    updateOobeWallpaperPreview('local');
    const input = document.getElementById('oobeLocalInput');
    if (input) {
      input.value = '';
      input.click();
    }
    return;
  }

  if (next !== 'local') {
    oobeLocalPickedSession = false;
    oobeLocalPreviewDataUrl = '';
  }

  oobeMediaKind = 'preview';
  // 实时预览主页背景（OOBE 内不写盘）
  if (typeof applyBackgroundMode === 'function') {
    Promise.resolve(
      applyBackgroundMode(next, { silent: true, persist: false })
    )
      .then(() => updateOobeWallpaperPreview(next))
      .catch(() => updateOobeWallpaperPreview(next));
  } else {
    updateOobeWallpaperPreview(next);
  }
  // 没有可取样壁纸场景时，若外观是「壁纸」则改为系统。
  if (!isOobeWallpaperSceneAvailable() && oobeAppearancePref === 'wallpaper') {
    applyOobeAppearance('system', { persist: false, animate: false });
  } else {
    syncOobeAppearanceUI();
  }
  setOobeToneBlockVisible(next === 'solid');
  syncOobeWallpaperUI();
}

function ensureOobeAppearanceGrid() {
  const grid = document.getElementById('oobeAppearance');
  if (!grid || grid.dataset.built === '1') return;
  grid.dataset.built = '1';
  grid.innerHTML = OOBE_APPEARANCE.map((item) => {
    return (
      '<button type="button" class="oobe-appear-card" role="radio" data-oobe-mode="' +
      item.id +
      '" aria-checked="false" title="' +
      item.tip +
      '">' +
      '<span class="oobe-appear-icon ' +
      item.icon +
      '" aria-hidden="true"></span>' +
      '<span class="oobe-appear-label">' +
      item.label +
      '</span>' +
      '<span class="oobe-appear-tip">' +
      item.tip +
      '</span>' +
      '</button>'
    );
  }).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-oobe-mode]');
    if (!btn || !grid.contains(btn)) return;
    applyOobeAppearance(btn.getAttribute('data-oobe-mode'));
  });
}

function applyOobeGreetingMode(mode, options = {}) {
  const next = String(mode || 'greeting');
  const ok = OOBE_GREETING_MODES.some((m) => m.id === next);
  oobeGreetingMode = ok ? next : 'greeting';
  const persist = options.persist === true;
  try {
    if (persist) {
      localStorage.setItem('moonfog_greeting_mode', oobeGreetingMode);
    }
    // 实时预览主页问候（OOBE 内不写盘）
    if (typeof applyGreetingMode === 'function') {
      applyGreetingMode(oobeGreetingMode, true);
    } else if (typeof currentGreetingMode !== 'undefined') {
      currentGreetingMode = oobeGreetingMode;
    }
  } catch (_) {}
  syncOobeGreetingUI();
  refreshOobeMiniGreeting();
  oobeMediaKind = 'preview';
  updateOobeWallpaperPreview(oobeBgMode || getOobeBgMode());
}

/**
 * 问候二级输入：展开/收起（高度+ 透明度）
 */
function setOobeFieldReveal(el, show) {
  if (!el) return;
  const reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const want = !!show;
  const isHidden = el.hasAttribute('hidden') || el.hidden === true;

  if (want) {
    if (!isHidden && el.classList.contains('is-open')) return;
    el.hidden = false;
    el.removeAttribute('hidden');
    if (reduce) {
      el.classList.add('is-open');
      el.classList.remove('is-entering');
      return;
    }
    el.classList.remove('is-open');
    el.classList.add('is-entering');
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      el.classList.remove('is-entering');
    });
  } else {
    if (isHidden) return;
    if (reduce) {
      el.classList.remove('is-open', 'is-entering');
      el.hidden = true;
      el.setAttribute('hidden', '');
      return;
    }
    el.classList.remove('is-open', 'is-entering');
    // 等收起动画后内hidden
    const done = () => {
      if (el.classList.contains('is-open')) return;
      el.hidden = true;
      el.setAttribute('hidden', '');
    };
    el.addEventListener('transitionend', done, { once: true });
    window.setTimeout(done, 280);
  }
}

function syncOobeGreetingUI() {
  const grid = document.getElementById('oobeGreeting');
  if (grid) {
    grid.querySelectorAll('[data-oobe-greeting]').forEach((btn) => {
      const on = btn.getAttribute('data-oobe-greeting') === oobeGreetingMode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  const nameField = document.getElementById('oobeNameField');
  const customField = document.getElementById('oobeCustomField');
  const meta = OOBE_GREETING_MODES.find((m) => m.id === oobeGreetingMode) || {};
  setOobeFieldReveal(nameField, !!meta.needsName);
  setOobeFieldReveal(customField, !!meta.needsCustom);
  // 二级区显隐后，卡片高度平滑跟随
  window.requestAnimationFrame(() => {
    if (typeof animateOobeCardHeight === 'function') animateOobeCardHeight();
  });
}

function ensureOobeGreetingGrid() {
  const grid = document.getElementById('oobeGreeting');
  if (!grid) return;
  // 重建为紧凑的单列选择列表。
  if (grid.dataset.built === '1' && grid.querySelector('.oobe-greet-chip')) return;
  grid.classList.remove('oobe-appearance', 'greeting-mode-list');
  grid.classList.add('oobe-greeting');
  grid.dataset.built = '1';
  grid.innerHTML = OOBE_GREETING_MODES.map((item) => {
    return (
      '<button type="button" class="oobe-greet-chip" role="radio" data-oobe-greeting="' +
      item.id +
      '" aria-checked="false" title="' +
      item.tip +
      '">' +
      '<span class="oobe-greet-chip-icon ' +
      (item.icon || 'mgc_emoji_line') +
      '" aria-hidden="true"></span>' +
      '<span class="oobe-greet-chip-copy">' +
      '<span class="oobe-greet-chip-label">' +
      item.label +
      '</span>' +
      '<span class="oobe-greet-chip-tip">' +
      item.tip +
      '</span>' +
      '</span>' +
      '<span class="oobe-greet-chip-check mgc_check_line" aria-hidden="true">' +
      '</span>' +
      '</button>'
    );
  }).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-oobe-greeting]');
    if (!btn || !grid.contains(btn)) return;
    applyOobeGreetingMode(btn.getAttribute('data-oobe-greeting'));
  });

  const nameInput = document.getElementById('oobeNameInput');
  if (nameInput && nameInput.dataset.bound !== '1') {
    nameInput.dataset.bound = '1';
    nameInput.value = oobeUsername || '';
    nameInput.addEventListener('input', () => {
      // 仅内存预览，完成时再写盘
      oobeUsername = String(nameInput.value || '').trim();
      if (typeof currentUsername !== 'undefined') {
        currentUsername =
          oobeUsername ||
          (typeof DEFAULT_USERNAME === 'string' ? DEFAULT_USERNAME : '朋友');
      }
      refreshOobeMiniGreeting();
    });
  }

  const customInput = document.getElementById('oobeCustomInput');
  if (customInput && customInput.dataset.bound !== '1') {
    customInput.dataset.bound = '1';
    customInput.value = oobeCustomText || '';
    customInput.addEventListener('input', () => {
      // 仅内存预览，完成时再写盘
      oobeCustomText = String(customInput.value || '').trim();
      if (typeof currentCustomText !== 'undefined') {
        currentCustomText = oobeCustomText;
      }
      refreshOobeMiniGreeting();
    });
  }
}

function setOobeGreetingBlockVisible(show) {
  const block = document.getElementById('oobeGreetingBlock');
  if (!block) return;
  if (show) {
    block.hidden = false;
    ensureOobeGreetingGrid();
    const nameInput = document.getElementById('oobeNameInput');
    const customInput = document.getElementById('oobeCustomInput');
    if (nameInput) nameInput.value = oobeUsername || '';
    if (customInput) customInput.value = oobeCustomText || '';
    // 进入问候步：按当前模式展开二级（带动画）
  syncOobeGreetingUI();
  } else {
    block.hidden = true;
    // 离开时收起二级，避免下次闪一下
    const nameField = document.getElementById('oobeNameField');
    const customField = document.getElementById('oobeCustomField');
    if (nameField) {
      nameField.classList.remove('is-open', 'is-entering');
      nameField.hidden = true;
    }
    if (customField) {
      customField.classList.remove('is-open', 'is-entering');
      customField.hidden = true;
    }
  }
}

function ensureOobeWallpaperGrid() {
  const grid = document.getElementById('oobeWallpaper');
  if (!grid || grid.dataset.built === '1') return;
  grid.dataset.built = '1';
  grid.innerHTML = OOBE_WALLPAPER.map((item) => {
    return (
      '<button type="button" class="oobe-appear-card" role="radio" data-oobe-bg="' +
      item.id +
      '" aria-checked="false" title="' +
      item.tip +
      '">' +
      '<span class="oobe-appear-icon ' +
      item.icon +
      '" aria-hidden="true"></span>' +
      '<span class="oobe-appear-label">' +
      item.label +
      '</span>' +
      '<span class="oobe-appear-tip">' +
      item.tip +
      '</span>' +
      '</button>'
    );
  }).join('');
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-oobe-bg]');
    if (!btn || !grid.contains(btn)) return;
    applyOobeWallpaper(btn.getAttribute('data-oobe-bg'));
  });

  // 隐藏 file input（挂则oobe 根上）
  let input = document.getElementById('oobeLocalInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'oobeLocalInput';
    input.accept = 'image/*';
    input.hidden = true;
    const root = document.getElementById('oobe');
    if (root) root.appendChild(input);
    else document.body.appendChild(input);
  }
  if (input.dataset.bound !== '1') {
    input.dataset.bound = '1';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file || !file.type.startsWith('image/')) {
        const tip = document.getElementById('oobeWallpaperTip');
        if (tip) {
          tip.hidden = false;
          tip.textContent = '请选择图片文件';
        }
        return;
      }
      try {
        const tip = document.getElementById('oobeWallpaperTip');
        if (tip) {
          tip.hidden = false;
          tip.textContent = '正在处理图片…';
        }
        let dataUrl;
        if (typeof compressImageFile === 'function') {
          dataUrl = await compressImageFile(file);
        } else {
          dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
        }
        // 内存预览 + 实时切主页背景；完成引导才写盘
        oobeLocalPreviewDataUrl = dataUrl;
        if (typeof localBgDataUrl !== 'undefined') localBgDataUrl = dataUrl;
        oobeBgMode = 'local';
        oobeLocalPickedSession = true;
        oobeMediaKind = 'preview';
        if (typeof applyBackgroundMode === 'function') {
          await applyBackgroundMode('local', {
            silent: true,
            persist: false
          });
        }
        syncOobeWallpaperUI();
        updateOobeWallpaperPreview('local');
        if (tip) {
          tip.hidden = false;
          tip.textContent = '已预览本地图片（完成引导后保存）';
        }
      } catch (err) {
        const tip = document.getElementById('oobeWallpaperTip');
        if (tip) {
          tip.hidden = false;
          tip.textContent = (err && err.message) || '图片处理失败';
        }
      }
    });
  }
}

/**
 * 右侧媒体种类：同种步骤间切换不重统 * logo | preview | settings | image | empty
 */
function getOobeMediaKind(step) {
  if (!step) return 'empty';
  if (step.logo) return 'logo';
  if (step.settingsTip) return 'settings';
  if (step.wallpaper || step.livePreview || step.appearance || step.greeting) {
    return 'preview';
  }
  if (step.image) return 'image:' + String(step.image);
  return 'empty';
}

function setOobeLogoPanelVisible(show) {
  const panel = document.getElementById('oobeLogoPanel');
  const frame = document.querySelector('.oobe-media-frame');
  if (panel) {
    panel.hidden = !show;
    panel.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  if (frame) frame.classList.toggle('has-logo', !!show);
}

function setOobeSettingsTipVisible(show) {
  const panel = document.getElementById('oobeSettingsTip');
  const frame = document.querySelector('.oobe-media-frame');
  const cursor = panel && panel.querySelector('.oobe-settings-cursor');
  const btn = panel && panel.querySelector('.oobe-settings-btn-mock');
  if (panel) {
    panel.hidden = !show;
    panel.setAttribute('aria-hidden', show ? 'false' : 'true');
    // 隐藏时强制停动画，避免回上一页仍残留指针
    if (!show) {
      if (cursor) {
        cursor.style.animation = 'none';
        cursor.style.opacity = '0';
      }
      if (btn) btn.style.animation = 'none';
    } else {
      // 再显示时重启动画
      if (cursor) {
        cursor.style.animation = '';
        cursor.style.opacity = '';
      }
      if (btn) btn.style.animation = '';
      // 强制重排，确保animation 件0% 重播
      if (cursor) void cursor.offsetWidth;
      if (btn) void btn.offsetWidth;
    }
  }
  if (frame) frame.classList.toggle('has-settings-tip', !!show);
}

function updateOobeMedia(step) {
  const frame = document.querySelector('.oobe-media-frame');
  const img = document.getElementById('oobeMediaImg');
  const empty = document.getElementById('oobeMediaEmpty');
  if (!img || !empty) return;

  // 背景 / 明暗 / 问候：同一套实时预览
  if (
    step &&
    (step.wallpaper || step.livePreview || step.appearance || step.greeting)
  ) {
    setOobeLogoPanelVisible(false);
    setOobeSettingsTipVisible(false);
    updateOobeWallpaperPreview(oobeBgMode || getOobeBgMode());
    return;
  }

  setOobeGrainPreviewActive(false);

  // 欢迎页：系统背景色+ 居中 SVG logo
  if (step && step.logo) {
    setOobeMiniHomeVisible(false, false);
    setOobeSettingsTipVisible(false);
    if (frame) {
      frame.classList.remove('is-solid-preview', 'is-image-preview', 'is-grain-preview', 'has-mini-home', 'has-image');
      frame.style.background = '';
    }
    const mediaLogo = document.getElementById('oobeMedia');
    if (mediaLogo) mediaLogo.classList.remove('has-mini-home');
    img.hidden = true;
    img.removeAttribute('src');
    empty.hidden = true;
    setOobeLogoPanelVisible(true);
    return;
  }

  // 设置引导：右下角齿轮 + 鼠标
  if (step && step.settingsTip) {
    setOobeLogoPanelVisible(false);
    setOobeMiniHomeVisible(false, false);
    if (frame) {
      frame.classList.remove('is-solid-preview', 'is-image-preview', 'has-mini-home', 'has-image');
      frame.style.background = '';
    }
    const mediaTip = document.getElementById('oobeMedia');
    if (mediaTip) mediaTip.classList.remove('has-mini-home');
    img.hidden = true;
    img.removeAttribute('src');
    empty.hidden = true;
    setOobeSettingsTipVisible(true);
    return;
  }

  // 其它步骤：恢复默认框样式，隐�?logo / 设置示意 / 迷你主页，再加载 image 字段
  setOobeLogoPanelVisible(false);
  setOobeSettingsTipVisible(false);
  if (frame) {
    frame.classList.remove('is-solid-preview', 'is-image-preview', 'has-mini-home');
    frame.style.background = '';
  }
  const mediaClear = document.getElementById('oobeMedia');
  if (mediaClear) mediaClear.classList.remove('has-mini-home');
  setOobeMiniHomeVisible(false, false);

  const src = step && step.image ? String(step.image).trim() : '';
  const showEmpty = () => {
    img.hidden = true;
    img.removeAttribute('src');
    img.alt = '';
    empty.hidden = false;
    if (frame) frame.classList.remove('has-image');
    const t = empty.querySelector('.oobe-media-empty-text');
    if (t) t.textContent = '介绍图';
  };

  if (!src) {
    showEmpty();
    return;
  }

  empty.hidden = false;
  img.hidden = true;
  if (frame) frame.classList.remove('has-image');

  const onLoad = () => {
    img.hidden = false;
    empty.hidden = true;
    if (frame) frame.classList.add('has-image');
  };
  const onError = () => showEmpty();

  img.onload = onLoad;
  img.onerror = onError;
  img.alt = (step && step.title) || '';
  if (img.getAttribute('src') === src) {
    if (img.complete && img.naturalWidth > 0) onLoad();
    else showEmpty();
  } else {
    img.src = src;
  }
}

function fillOobeStepContent(step) {
  const kicker = document.getElementById('oobeKicker');
  const title = document.getElementById('oobeTitle');
  const desc = document.getElementById('oobeDesc');
  const points = document.getElementById('oobePoints');
  const appear = document.getElementById('oobeAppearance');
  const wall = document.getElementById('oobeWallpaper');
  const wallTip = document.getElementById('oobeWallpaperTip');
  const card = document.querySelector('.oobe-card');
  const root = document.getElementById('oobe');
  // 欢迎页/ 完成页：同套居中 logo 布局中grain 背景
  const isHeroStep = !!(step && step.logo);

  if (card) card.dataset.step = step.id || '';
  if (root) root.classList.toggle('is-welcome-step', isHeroStep);
  if (window.OobeGrain && typeof window.OobeGrain.setActive === 'function') {
    window.OobeGrain.setActive(isHeroStep);
  }

  if (kicker) kicker.textContent = step.kicker || 'MoonFog';
  if (title) title.textContent = step.title || '';
  if (desc) desc.textContent = step.desc || '';

  if (points) {
    const list = Array.isArray(step.points) ? step.points : [];
    points.classList.remove('oobe-points--cards', 'oobe-points--mosaic', 'oobe-points--no-num');
    if (!list.length) {
      points.hidden = true;
      points.innerHTML = '';
    } else if (step.pointsStyle === 'mosaic') {
      // 设置步：2×2 错落磁贴，避免与欢迎页列表同一风格
      points.hidden = false;
      points.classList.add('oobe-points--mosaic');
      points.innerHTML = list
        .map((item, i) => {
          if (!(item && typeof item === 'object')) {
            return '<li class="oobe-mosaic-tile">' + String(item) + '</li>';
          }
          const accent = item.accent || ['a', 'b', 'c', 'd'][i % 4];
          return (
            '<li class="oobe-mosaic-tile is-accent-' +
            accent +
            '">' +
            '<span class="oobe-mosaic-icon ' +
            (item.icon || 'mgc_check_line') +
            '" aria-hidden="true"></span>' +
            '<span class="oobe-mosaic-title">' +
            String(item.title || '') +
            '</span>' +
            (item.tip
              ? '<span class="oobe-mosaic-tip">' + String(item.tip) + '</span>'
              : '') +
            '</li>'
          );
        })
        .join('');
    } else if (step.pointsStyle === 'cards') {
      points.hidden = false;
      points.classList.add('oobe-points--cards');
      if (step.pointsNoNum) points.classList.add('oobe-points--no-num');
      else points.classList.remove('oobe-points--no-num');
      points.innerHTML = list
        .map((item, i) => {
          if (item && typeof item === 'object') {
            const icon = item.icon || 'mgc_check_line';
            const title = item.title || '';
            const tip = item.tip || '';
            const num =
              step.pointsNoNum
                ? ''
                : '<span class="oobe-point-num" aria-hidden="true">' +
                  String(i + 1) +
                  '</span>';
            return (
              '<li class="oobe-point-card">' +
              '<span class="oobe-point-icon ' +
              icon +
              '" aria-hidden="true"></span>' +
              '<span class="oobe-point-text">' +
              '<span class="oobe-point-title">' +
              String(title) +
              '</span>' +
              (tip
                ? '<span class="oobe-point-tip">' + String(tip) + '</span>'
                : '') +
              '</span>' +
              num +
              '</li>'
            );
          }
          return '<li>' + String(item) + '</li>';
        })
        .join('');
    } else {
      points.hidden = false;
      points.innerHTML = list
        .map((t) => {
          if (t && typeof t === 'object') {
            return '<li>' + String(t.title || t.tip || '') + '</li>';
          }
          return '<li>' + String(t) + '</li>';
        })
        .join('');
    }
  }

  if (appear) {
    if (step.appearance) {
      appear.hidden = false;
      ensureOobeAppearanceGrid();
      syncOobeAppearanceUI();
    } else {
      appear.hidden = true;
    }
  }

  if (wall) {
    if (step.wallpaper) {
      wall.hidden = false;
      ensureOobeWallpaperGrid();
      oobeTone = getOobeTone();
      syncOobeWallpaperUI();
      setOobeToneBlockVisible((oobeBgMode || getOobeBgMode()) === 'solid');
    } else {
      wall.hidden = true;
      setOobeToneBlockVisible(false);
    }
  }
  if (wallTip && !step.wallpaper) wallTip.hidden = true;

  setOobeGreetingBlockVisible(!!step.greeting);

  // 右侧媒体：仅种类变化时重绘（背景/明暗/问候同步 preview，不跟页切换）
  const kind = getOobeMediaKind(step);
  if (kind !== oobeMediaKind) {
    oobeMediaKind = kind;
    updateOobeMedia(step);
  } else if (kind === 'preview' && step.greeting) {
    // 仍在预览态：只同步迷你问候文案，不重播壁纸动画
    refreshOobeMiniGreeting();
  }
}

function updateOobeChrome() {
  const backBtn = document.getElementById('oobeBackBtn');
  const nextBtn = document.getElementById('oobeNextBtn');
  const skipBtn = document.getElementById('oobeSkipBtn');
  const progress = document.getElementById('oobeProgress');
  const last = oobeStep >= OOBE_STEPS.length - 1;

  if (backBtn) backBtn.hidden = oobeStep <= 0;
  if (skipBtn) skipBtn.hidden = !!last;
  if (nextBtn) {
    nextBtn.textContent =
      oobeStep === 0 ? '开始' : last ? '开始使用' : '下一步';
  }
  if (progress) {
    progress.innerHTML = OOBE_STEPS.map((_, i) => {
      const cls =
        i === oobeStep ? 'is-active' : i < oobeStep ? 'is-done' : '';
      return '<span class="oobe-dot ' + cls + '"></span>';
    }).join('');
  }
}

/**
 * 步骤切换后：卡片高度从当前值平滑过渡到内容自然高度
 */
function animateOobeCardHeight(options = {}) {
  const card = document.querySelector('.oobe-card');
  if (!card) return;
  card.style.height = '';
  card.classList.remove('is-resizing');
}

function stopOobeWelcomeIntro() {
  if (oobeIntroTimer) {
    window.clearTimeout(oobeIntroTimer);
    oobeIntroTimer = 0;
  }
  const root = document.getElementById('oobe');
  if (root) root.classList.remove('is-welcome-intro');
}

function renderOobeStep(options = {}) {
  const step = OOBE_STEPS[oobeStep] || OOBE_STEPS[0];
  const dir = options.dir || 0; // 1 = 前进（从右入），-1 = 后退（从左入）
  const body = document.getElementById('oobeStage');
  const reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!body || !dir || reduce) {
    fillOobeStepContent(step);
    updateOobeChrome();
    // 首帧 / 无动画：下一帧再量高，避免布局未完成
    window.requestAnimationFrame(() => {
      animateOobeCardHeight({ instant: !dir || reduce });
    });
    return;
  }

  const token = ++oobeAnimToken;
  body.classList.remove(
    'is-slide-out-left',
    'is-slide-out-right',
    'is-slide-in-left',
    'is-slide-in-right'
  );
  // 当前页滑出
  body.classList.add(dir > 0 ? 'is-slide-out-left' : 'is-slide-out-right');

  window.setTimeout(() => {
    if (token !== oobeAnimToken) return;
    fillOobeStepContent(step);
    updateOobeChrome();
    body.classList.remove('is-slide-out-left', 'is-slide-out-right');
    // 新页滑入
    body.classList.add(dir > 0 ? 'is-slide-in-right' : 'is-slide-in-left');
    // 与滑入同步：高度向新内容伸缩
    window.requestAnimationFrame(() => {
      if (token !== oobeAnimToken) return;
      animateOobeCardHeight();
    });
    const clear = () => {
      if (token !== oobeAnimToken) return;
      body.classList.remove('is-slide-in-left', 'is-slide-in-right');
    };
    body.addEventListener('animationend', clear, { once: true });
    window.setTimeout(clear, 360);
  }, 200);
}

function finishOobe() {
  const root = document.getElementById('oobe');
  stopOobeWelcomeIntro();

  const reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 同一�?zoom 手势：卡往里缩、主页背景从外缩入
  const closeMs = reduce ? 0 : 480;
  const fromOobeMs = reduce ? 0 : 720;

  const disposeOobeGrain = () => {
    if (!window.OobeGrain) return;
    if (typeof window.OobeGrain.setActive === 'function') {
      window.OobeGrain.setActive(false);
    }
    if (typeof window.OobeGrain.setPreviewActive === 'function') {
      window.OobeGrain.setPreviewActive(false);
    }
  };

  /** 动画前把 WebGL 换成同色实底，避免opacity/scale 时canvas 穿帮 */
  const solidifyOobeCard = () => {
    const grain = document.getElementById('oobeGrain');
    const card = root && root.querySelector('.oobe-card');
    const mode = document.documentElement.getAttribute('data-mode');
    const fallback = mode === 'dark' ? '#17140f' : '#f6f1ea';
    if (window.OobeGrain && typeof window.OobeGrain._pause === 'function') {
      try {
        window.OobeGrain._pause();
      } catch (_) {}
    }
    if (grain) {
      grain.style.transition = 'none';
      grain.style.backgroundColor = fallback;
      grain.style.opacity = '1';
      grain.querySelectorAll('canvas').forEach((el) => {
        el.style.visibility = 'hidden';
      });
    }
    if (card) {
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
      card.style.background = fallback;
    }
  };

  const clearSolidify = () => {
    const grain = document.getElementById('oobeGrain');
    const card = root && root.querySelector('.oobe-card');
    if (grain) {
      grain.style.transition = '';
      grain.style.backgroundColor = '';
      grain.style.opacity = '';
      grain.querySelectorAll('canvas').forEach((el) => {
        el.style.visibility = '';
      });
    }
    if (card) {
      card.style.backdropFilter = '';
      card.style.webkitBackdropFilter = '';
      card.style.background = '';
    }
  };

  const stampBootEntered = () => {
    document
      .querySelectorAll(
        '.greeting-section, .search-section, .shortcuts-section, .bing-credit, .search-box, .shortcut-btn, .shortcut-folder-trigger, .settings-wrapper'
      )
      .forEach((el) => {
        try {
          el.classList.add('boot-entered');
        } catch (_) {}
      });
  };

  const startPageReveal = () => {
    const html = document.documentElement;
    html.classList.remove(
      'boot-oobe-pending',
      'boot-ready',
      'bg-swap-ready',
      'bg-entered'
    );
    if (!reduce) html.classList.add('boot-from-oobe');
    else html.classList.remove('boot-from-oobe');
    document.body.classList.add('is-oobe-reveal');
    if (typeof startBootEnter === 'function') {
      try {
        startBootEnter({ fromOobe: true });
      } catch (_) {}
    }
    if (reduce) stampBootEntered();
  };

  /** 重活延后：先让退场动画开跑，避免点按钮后卡一帧*/
  const persistOobeChoices = () => {
    if (oobeBgMode === 'local' && !oobeLocalPickedSession) {
      oobeBgMode = 'bing';
    }
    try {
      if (oobeBgMode === 'local' && oobeLocalPickedSession && oobeLocalPreviewDataUrl) {
        if (typeof saveLocalBackground === 'function') {
          saveLocalBackground(oobeLocalPreviewDataUrl, { persist: true });
        } else {
          localStorage.setItem(
            typeof LOCAL_BG_KEY === 'string' ? LOCAL_BG_KEY : 'moonfog_bg_local',
            oobeLocalPreviewDataUrl
          );
          if (typeof localBgDataUrl !== 'undefined') {
            localBgDataUrl = oobeLocalPreviewDataUrl;
          }
        }
      }
      if (oobeBgMode && typeof applyBackgroundMode === 'function') {
        if (oobeBgMode === 'local' && oobeLocalPickedSession) {
          applyBackgroundMode('local', { silent: true, persist: true });
        } else if (oobeBgMode !== 'local') {
          applyBackgroundMode(oobeBgMode, { silent: true, persist: true });
        }
      }
    } catch (_) {}
    try {
      applyOobeTone(oobeTone || getOobeTone(), { persist: true, animate: false });
      applyOobeAppearance(oobeAppearancePref || getOobeAppearancePref(), {
        persist: true,
        animate: false
      });
    } catch (_) {}
    try {
      localStorage.setItem('moonfog_greeting_mode', oobeGreetingMode || 'greeting');
      if (typeof applyGreetingMode === 'function') {
        applyGreetingMode(oobeGreetingMode || 'greeting', true);
      }
      if (oobeUsername) {
        localStorage.setItem('moonfog_username', oobeUsername);
        if (typeof currentUsername !== 'undefined') currentUsername = oobeUsername;
      } else {
        localStorage.removeItem('moonfog_username');
      }
      const customKey =
        typeof CUSTOM_TEXT_KEY === 'string' ? CUSTOM_TEXT_KEY : 'moonfog_custom_text';
      if (oobeCustomText) localStorage.setItem(customKey, oobeCustomText);
      else localStorage.removeItem(customKey);
      if (typeof currentCustomText !== 'undefined') {
        currentCustomText = oobeCustomText || '';
      }
    } catch (_) {}
    oobeBaseline = null;
    oobeLocalPreviewDataUrl = '';
    markOobeDone();
  };

  const teardownOobe = () => {
    disposeOobeGrain();
    clearSolidify();
    if (root) {
      root.hidden = true;
      root.setAttribute('hidden', '');
      root.style.display = '';
      root.style.position = '';
      root.style.inset = '';
      root.style.zIndex = '';
      root.style.opacity = '';
      root.style.pointerEvents = '';
      root.style.background = '';
      root.classList.remove('is-visible', 'is-closing', 'is-welcome-step');
    }
    document.body.classList.remove('oobe-active', 'is-oobe-reveal');
  };

  const finishFromOobe = () => {
    stampBootEntered();
    document.documentElement.classList.remove('boot-from-oobe');
  };

  if (root) {
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden', 'true');
    root.classList.add('is-visible');
    // 1) 先冻成实色 2) 同帧开 zoom 3) 落盘延后，不挡动画
    solidifyOobeCard();
    root.classList.remove('is-closing');
    void root.offsetWidth;
    root.classList.add('is-closing');
    startPageReveal();
    window.setTimeout(persistOobeChoices, 0);
    window.setTimeout(teardownOobe, closeMs);
    window.setTimeout(finishFromOobe, fromOobeMs);
  } else {
    persistOobeChoices();
    disposeOobeGrain();
    document.body.classList.remove('oobe-active');
    startPageReveal();
    teardownOobe();
    finishFromOobe();
  }
}

function oobeNext() {
  stopOobeWelcomeIntro();
  if (oobeStep >= OOBE_STEPS.length - 1) {
    finishOobe();
    return;
  }
  oobeStep += 1;
  renderOobeStep({ dir: 1 });
}

function oobeBack() {
  stopOobeWelcomeIntro();
  if (oobeStep <= 0) return;
  oobeStep -= 1;
  renderOobeStep({ dir: -1 });
}

/** 跳过剩余引导，保存当前已选并进入主页 */
function oobeSkip() {
  finishOobe();
}

function bindOobe() {
  if (oobeBound) return;
  oobeBound = true;
  const nextBtn = document.getElementById('oobeNextBtn');
  const backBtn = document.getElementById('oobeBackBtn');
  const skipBtn = document.getElementById('oobeSkipBtn');
  if (nextBtn) nextBtn.addEventListener('click', oobeNext);
  if (backBtn) backBtn.addEventListener('click', oobeBack);
  if (skipBtn) skipBtn.addEventListener('click', oobeSkip);
  document.addEventListener('keydown', (e) => {
    if (!isOobeActive()) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      oobeNext();
    } else if (e.key === 'Escape' && oobeStep > 0) {
      e.preventDefault();
      oobeBack();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      oobeNext();
    } else if (e.key === 'ArrowLeft' && oobeStep > 0) {
      e.preventDefault();
      oobeBack();
    }
  });
  // 未点完成就刷新关闭：把预览改动撤回到进入前的配置（不落盘）
  const discardPreview = () => {
    if (!isOobeActive() || isOobeDone()) return;
    try {
      restoreOobeBaseline();
    } catch (_) {}
  };
  window.addEventListener('pagehide', discardPreview);
  window.addEventListener('beforeunload', discardPreview);
}

function preparePageUnderOobe() {
  const html = document.documentElement;
  html.classList.add('boot-oobe-pending');
  html.classList.remove('boot-ready', 'bg-swap-ready', 'bg-entered');
  document.querySelectorAll(
    '.greeting-section, .search-section, .shortcuts-section, .bing-credit, .search-box, .shortcut-btn, .shortcut-folder-trigger'
  ).forEach((el) => {
    try {
      el.classList.remove('boot-entered');
      el.style.removeProperty('opacity');
      el.style.removeProperty('visibility');
      el.style.removeProperty('animation');
    } catch (_) {}
  });
  const pageBg = document.getElementById('pageBg');
  if (pageBg) {
    pageBg.style.removeProperty('opacity');
    pageBg.style.removeProperty('visibility');
  }
  document.querySelectorAll('.page-bg-image.is-active').forEach((el) => {
    el.style.removeProperty('opacity');
  });
}

function openOobe(options = {}) {
  const root = document.getElementById('oobe');
  if (!root) {
    return false;
  }

  preparePageUnderOobe();
  // 进入前快照：未完成刷新时恢复「之前的配置」。
  captureOobeBaseline();
  // 先挂 oobe-active，后续预览默认不写盘
  document.body.classList.add('oobe-active');
  oobeLocalPreviewDataUrl = '';
  oobeBgMode = getOobeBgMode();
  oobeTone = getOobeTone();
  oobeLocalPickedSession = false;
  try {
    oobeUsername =
      localStorage.getItem('moonfog_username') ||
      (typeof currentUsername === 'string' ? currentUsername : '') ||
      '';
    oobeCustomText =
      localStorage.getItem(
        typeof CUSTOM_TEXT_KEY === 'string' ? CUSTOM_TEXT_KEY : 'moonfog_custom_text'
      ) || '';
    const gm = localStorage.getItem('moonfog_greeting_mode') || 'greeting';
    oobeGreetingMode = OOBE_GREETING_MODES.some((m) => m.id === gm) ? gm : 'greeting';
  } catch (_) {
    oobeGreetingMode = 'greeting';
  }
  // 欢迎默认：跟随壁纸（实时预览，不写盘）
  oobeAppearancePref = 'wallpaper';
  if (!isOobeWallpaperSceneAvailable()) oobeAppearancePref = 'system';
  try {
    applyOobeAppearance(oobeAppearancePref, {
      persist: false,
      animate: false
    });
  } catch (_) {}

  bindOobe();
  oobeStep = 0;
  oobeMediaKind = '';
  renderOobeStep({ dir: 0 });

  root.hidden = false;
  root.removeAttribute('hidden');
  root.setAttribute('aria-hidden', 'false');
  root.style.display = 'flex';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '10000';
  root.style.background = 'transparent';
  stopOobeWelcomeIntro();
  root.classList.remove('is-visible', 'is-closing');
  root.style.opacity = '0';
  root.style.pointerEvents = 'none';
  void root.offsetWidth;
  window.requestAnimationFrame(() => {
    root.classList.add('is-visible');
    const reduce =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      root.classList.add('is-welcome-intro');
      oobeIntroTimer = window.setTimeout(() => {
        root.classList.remove('is-welcome-intro');
        oobeIntroTimer = 0;
      }, 2350);
    }
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
  });

  const nextBtn = document.getElementById('oobeNextBtn');
  if (nextBtn) {
    try {
      nextBtn.focus({ preventScroll: true });
    } catch (_) {
      try {
        nextBtn.focus();
      } catch (e) {}
    }
  }
  if (options.force) {
    clearOobeDone();
  }
  return true;
}

function maybeShowOobe() {
  // OOBE 因编码损坏暂不可用，直接显示主页
  document.body.classList.remove('oobe-active', 'is-oobe-reveal');
  return false;
}
