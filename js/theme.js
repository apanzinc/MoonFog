/**
 * MoonFog - 主题 / 字体 / 明暗偏好
 */

/**
 * 更新粗细标签文案
 */
function updateWeightLabel(weight, elOrId) {
  const labels = {
    '400': '常规',
    '450': '中等偏细',
    '500': '中等',
    '600': '半粗',
    '700': '粗体'
  };
  const el = typeof elOrId === 'string'
    ? document.getElementById(elOrId)
    : (elOrId || document.getElementById('weightValue'));
  if (el) el.textContent = labels[String(weight)] || '常规';
}

/**
 * 同步 theme-color color-scheme（系统滚动条 / 表单控件 */
function syncThemeChrome(mode) {
  const root = document.documentElement;
  const isDark = mode === 'dark';
  root.style.colorScheme = isDark ? 'dark' : 'light';

  const meta = document.getElementById('themeColorMeta');
  if (!meta) return;
  const bg = getComputedStyle(root).getPropertyValue('--bg-warm').trim() || (isDark ? '#1E1C18' : '#F5F0E8');
  meta.setAttribute('content', bg);
}

/** 主题过渡计时器：避免连续切换时提前关掉动*/
let themeAnimTimer = null;
/** 当前用户明暗偏好 */
let currentModePref =
  typeof loadModePref === 'function' ? loadModePref() : 'light';
/** 系统配色监听 */
let systemSchemeMql = null;
let systemSchemeBound = false;

/**
 * 将流光渐变调色板应用UI 元素
 * grain 调色板中提取颜色，直接设CSS 变量驱动所UI
 */
function applyGrainPalette() {
  const root = document.documentElement;

  if (typeof currentBgMode === 'undefined' || currentBgMode !== 'grain') {
    // 非流光模式：清除自定义变量，回退tokens.css
    console.log('[MoonFog] applyGrainPalette: removing vars, currentBgMode:', currentBgMode, '| before: --bg-warm=', root.style.getPropertyValue('--bg-warm'), '| --text-primary=', root.style.getPropertyValue('--text-primary'))
    root.style.removeProperty('--bg-warm');
    root.style.removeProperty('--bg-warm-alt');
    root.style.removeProperty('--card-bg');
    root.style.removeProperty('--text-primary');
    root.style.removeProperty('--text-secondary');
    root.style.removeProperty('--text-tertiary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
    root.style.removeProperty('--accent-glow');
    root.style.removeProperty('--border');
    root.style.removeProperty('--border-strong');
    root.classList.remove('has-grain-ui');
    document.body.classList.remove('has-grain-ui');
    // 清除流光模式强制白字
    root.style.removeProperty('--img-text');
    let greetingEl = document.getElementById('greeting');
    let subEl = document.getElementById('greetingSub');
    if (greetingEl) greetingEl.style.removeProperty('color');
    if (subEl) subEl.style.removeProperty('color');
    console.log('[MoonFog] applyGrainPalette: AFTER removal — --bg-warm=', root.style.getPropertyValue('--bg-warm') || '(empty)', '| --text-primary=', root.style.getPropertyValue('--text-primary') || '(empty)')
    return;
  }

  // 流光模式：立即强制问候白字（不依GrainBackground，模块加载可能尚未就绪）
  root.style.setProperty('--img-text', '#FFFFFF');
  root.classList.add('has-grain-ui');
  if (document.body) document.body.classList.add('has-grain-ui');
  ensureGrainGreetingStyle();
  applyGrainGreetingColor();

  if (!window.GrainBackground || typeof window.GrainBackground.getSettings !== 'function') return;

  const settings = window.GrainBackground.getSettings();
  if (!settings) return;

  const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
  const palette = isDark ? settings.dark : settings.light;
  if (!palette || !palette.colorBack) return;

  const back = hexToRgb(palette.colorBack);
  if (!back) return;

  // 从调色板第一个颜色提取强调色
  const accentRgb = (palette.colors && palette.colors[0]) ? hexToRgb(palette.colors[0]) : null;

  // 衍生 UI 颜色
  const bgWarm = palette.colorBack;
  const bgWarmAlt = isDark
    ? blendColor(back, [255, 255, 255], 0.08)
    : blendColor(back, [0, 0, 0], 0.04);
  const cardBg = isDark
    ? blendColor(back, [255, 255, 255], 0.12)
    : blendColor(back, [255, 255, 255], 0.85);

  // 文字颜色：使用固定高对比度颜色（tone 系统一致）
  const textPrimary = isDark ? '#E5DFD0' : '#1A1814';
  const textSecondary = isDark ? '#9A9485' : '#5A5548';
  const textTertiary = isDark ? '#6A6558' : '#8A8578';

  // 强调
  const accent = accentRgb ? rgbToHex(accentRgb) : (isDark ? '#D4A855' : '#8B6914');
  const accentHover = accentRgb ? blendColor(accentRgb, isDark ? [255,255,255] : [0,0,0], 0.1) : accent;
  const accentGlow = accentRgb ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)` : 'rgba(180, 140, 60, 0.15)';

  const border = isDark
    ? `rgba(255, 255, 255, 0.12)`
    : `rgba(${back.r}, ${back.g}, ${back.b}, 0.15)`;
  const borderStrong = isDark
    ? `rgba(255, 255, 255, 0.2)`
    : `rgba(${back.r}, ${back.g}, ${back.b}, 0.25)`;

  // 直接设置标准 CSS 变量（覆盖tokens.css）
  root.style.setProperty('--bg-warm', bgWarm);
  root.style.setProperty('--bg-warm-alt', bgWarmAlt);
  root.style.setProperty('--card-bg', cardBg);
  root.style.setProperty('--text-primary', textPrimary);
  root.style.setProperty('--text-secondary', textSecondary);
  root.style.setProperty('--text-tertiary', textTertiary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', accentHover);
  root.style.setProperty('--accent-glow', accentGlow);
  root.style.setProperty('--border', border);
  root.style.setProperty('--border-strong', borderStrong);
}

/** 流光模式：注<style> <head>，强制问候白字，绕过所CSS 加载*/
function ensureGrainGreetingStyle() {
  if (document.getElementById('moonfog-grain-greeting')) return;
  let s = document.createElement('style');
  s.id = 'moonfog-grain-greeting';
  s.textContent =
    'html body.has-grain-ui .greeting-title,' +
    'html.boot-has-grain .greeting-title,' +
    'html body.has-grain-ui .greeting-sub,' +
    'html.boot-has-grain .greeting-sub{' +
      'color:#FFF!important;' +
      '-webkit-text-fill-color:currentColor!important;' +
      'text-shadow:none!important;' +
      'background:none!important;' +
      'border:none!important;' +
      'box-shadow:none!important;' +
      'filter:none!important;' +
    '}';
  (document.head || document.documentElement).appendChild(s);
}

/** 流光模式：强制问候白字（含延迟重试，应对元素尚未渲染*/
function applyGrainGreetingColor() {
  function paint() {
    let el = document.getElementById('greeting');
    let sub = document.getElementById('greetingSub');
    if (el) el.style.color = '#FFFFFF';
    if (sub) sub.style.color = '#FFFFFF';
  }
  paint();
  // 元素可能DOM 尚未就绪时不存在，延迟重试
  setTimeout(paint, 0);
  setTimeout(paint, 200);
}

// 流光模式下持续保白（防任何代码覆inline color
(function grainColorGuard() {
  setInterval(function () {
    if (typeof currentBgMode === 'undefined' || currentBgMode !== 'grain') return;
    let el = document.getElementById('greeting');
    let sub = document.getElementById('greetingSub');
    if (el) el.style.color = '#FFFFFF';
    if (sub) sub.style.color = '#FFFFFF';
  }, 100);
})();

/** 解析 hex 颜色到RGB 对象 */
function hexToRgb(hex) {
  const m = String(hex).match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** RGB hex — accepts (rgb) object or (r, g, b) */
function rgbToHex(rgbOrR, g, b) {
  let r, green, blue;
  if (typeof rgbOrR === 'object' && rgbOrR !== null) {
    r = rgbOrR.r; green = rgbOrR.g; blue = rgbOrR.b;
  } else {
    r = rgbOrR; green = g; blue = b;
  }
  const toHex = (c) => (c == null ? '00' : Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'));
  return '#' + toHex(r) + toHex(green) + toHex(blue);
}

/** 混合颜色：blendColor(rgb, [r,g,b], ratio) hex */
function blendColor(base, target, ratio) {
  const r = Math.round(base.r + (target[0] - base.r) * ratio);
  const g = Math.round(base.g + (target[1] - base.g) * ratio);
  const b = Math.round(base.b + (target[2] - base.b) * ratio);
  return rgbToHex({ r, g, b });
}

/** 加深颜色 */
function darkenColor(hex, amount) {
  const rgb = typeof hex === 'string' ? hexToRgb(hex) : hex;
  if (!rgb) return hex;
  return blendColor(rgb, [0, 0, 0], 1 - amount);
}

/** 提亮颜色 */
function lightenColor(hex, amount) {
  const rgb = typeof hex === 'string' ? hexToRgb(hex) : hex;
  if (!rgb) return hex;
  return blendColor(rgb, [255, 255, 255], 1 - amount);
}

/**
 * 短暂开启颜色过渡（仅换色，不改布局 */
function beginThemeTransition() {
  const el = document.documentElement;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  el.classList.add('theme-animating');
  if (themeAnimTimer) clearTimeout(themeAnimTimer);
  themeAnimTimer = setTimeout(() => {
    el.classList.remove('theme-animating');
    themeAnimTimer = null;
  }, 420);
}

function getModePref() {
  if (currentModePref) return normalizeModePref(currentModePref);
  return typeof loadModePref === 'function' ? loadModePref() : 'light';
}

function getWallpaperSceneDarkHint() {
  try {
    if (typeof lastDominant === 'object' && lastDominant && typeof lastDominant.sceneDark === 'boolean') {
      return lastDominant.sceneDark;
    }
    if (document.body.classList.contains('img-scene-dark')) return true;
    if (document.body.classList.contains('img-scene-light')) return false;
  } catch (_) {}
  return null;
}

/**
 * 根据偏好解析最light/dark
 */
function resolveModeFromPref(pref, options = {}) {
  const p = typeof normalizeModePref === 'function' ? normalizeModePref(pref) : pref;
  const sceneHint =
    typeof options.sceneDark === 'boolean'
      ? options.sceneDark
      : getWallpaperSceneDarkHint();
  if (typeof resolveEffectiveMode === 'function') {
    return resolveEffectiveMode(p, { sceneDark: sceneHint });
  }
  if (p === 'dark' || p === 'light') return p;
  if (p === 'system' && typeof getSystemColorScheme === 'function') {
    return getSystemColorScheme();
  }
  if (p === 'wallpaper' && typeof sceneHint === 'boolean') {
    return sceneHint ? 'dark' : 'light';
  }
  return 'light';
}

function ensureSystemSchemeListener() {
  if (systemSchemeBound || !window.matchMedia) return;
  try {
    systemSchemeMql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getModePref() !== 'system') return;
      applyTheme(null, null, { animate: true, fromSystem: true });
    };
    if (systemSchemeMql.addEventListener) {
      systemSchemeMql.addEventListener('change', onChange);
    } else if (systemSchemeMql.addListener) {
      systemSchemeMql.addListener(onChange);
    }
    systemSchemeBound = true;
  } catch (_) {}
}

/**
 * 应用主题（色调 + 明暗偏好） * - mode 参数可为 light|dark|system|wallpaper（偏好）
 * - data-mode 始终写解析后light|dark（供 CSS token * - data-mode-pref 写用户偏 */
function applyTheme(tone, mode, options = {}) {
  const el = document.documentElement;
  let rawTone = tone || el.getAttribute('data-tone') || DEFAULT_TONE;
  if (rawTone === 'custom') rawTone = DEFAULT_TONE || 'sand';
  const nextTone =
    typeof resolveToneKey === 'function' ? resolveToneKey(rawTone) : rawTone;

  // 解析偏好：显式传> 当前偏好 > 存储
  let nextPref;
  if (mode === 'light' || mode === 'dark' || mode === 'system' || mode === 'wallpaper') {
    nextPref = mode;
  } else if (options.pref) {
    nextPref = normalizeModePref(options.pref);
  } else {
    nextPref = getModePref();
  }
  // OOBE 中默认只实时预览界面，不写盘（persist:true 才落盘）
  const oobeLive =
    typeof document !== 'undefined' &&
    document.body &&
    document.body.classList.contains('oobe-active');
  const persist =
    options.persist === true ||
    (options.persist !== false && !oobeLive);
  if (persist && typeof saveModePref === 'function') {
    nextPref = saveModePref(nextPref);
  } else if (typeof normalizeModePref === 'function') {
    nextPref = normalizeModePref(nextPref);
  }
  currentModePref = nextPref;

  const nextMode = resolveModeFromPref(nextPref, {
    sceneDark: options.sceneDark
  });

  const prevTone = el.getAttribute('data-tone');
  const prevMode = el.getAttribute('data-mode');
  const prevPref = el.getAttribute('data-mode-pref');
  const changed =
    prevTone !== nextTone ||
    prevMode !== nextMode ||
    prevPref !== nextPref;

  if (changed && options.animate !== false) {
    beginThemeTransition();
  }

  const customStyle = document.getElementById('moonfog-custom-tone');
  if (customStyle) customStyle.remove();

  el.setAttribute('data-tone', nextTone);
  el.setAttribute('data-mode', nextMode);
  el.setAttribute('data-mode-pref', nextPref);
  if (persist) {
    try {
      // 兼容旧键：仍写解析后light/dark
      localStorage.setItem('moonfog_mode', nextMode);
      localStorage.setItem('moonfog_tone', nextTone);
    } catch (_) {}
  }

  ensureSystemSchemeListener();
  syncThemeChrome(nextMode);
  if (typeof updateModeToggleUI === 'function') {
    updateModeToggleUI(nextPref, nextMode);
  }

  // 图片背景：仅在浅色色调变化时重算控件颜色
  if (changed && typeof refreshImagePaletteForMode === 'function') {
    refreshImagePaletteForMode(nextMode);
  }
  if (typeof getEffectiveBgMode === 'function' ? getEffectiveBgMode() === 'solid' : typeof currentBgMode !== 'undefined' && currentBgMode === 'solid') {
    document.body.classList.remove('img-ui-dark', 'img-ui-light', 'img-scene-dark', 'img-scene-light');
  }

  // 流光渐变：应用调色板UI
  if (typeof applyGrainPalette === 'function') {
    applyGrainPalette();
  }

  // 通知其他模块色调已变
  if (prevTone !== nextTone) {
    window.dispatchEvent(new CustomEvent('tone-change', { detail: { tone: nextTone } }));
  }
  // 通知其他模块模式已变
  if (prevMode !== nextMode) {
    window.dispatchEvent(new CustomEvent('mode-change', { detail: { mode: nextMode } }));
  }

  // 同步 ThemeManager：统一 surface tokens
  if (window.__MOONFOG_THEME_MANAGER__) {
    var _tm = window.__MOONFOG_THEME_MANAGER__;
    console.log('[MoonFog] applyTheme → ThemeManager.apply: imageBg:', _tm.state.imageBg, 'imagePalette:', !!_tm.state.imagePalette, 'tone:', nextTone, 'mode:', nextMode)
    _tm.apply({
      tone: nextTone,
      mode: nextMode,
      modePref: nextPref
    });
  }

  return { pref: nextPref, mode: nextMode, tone: nextTone };
}

/**
 * 壁纸场景变化时：若偏好为 wallpaper 则重解析明暗
 */
function syncModeWithWallpaperScene(sceneDark, options = {}) {
  if (getModePref() !== 'wallpaper') return null;
  if (typeof sceneDark !== 'boolean') return null;
  const want = sceneDark ? 'dark' : 'light';
  const cur = document.documentElement.getAttribute('data-mode');
  if (cur === want) {
    return { pref: 'wallpaper', mode: want, skipped: true };
  }
  return applyTheme(null, 'wallpaper', {
    animate: options.animate !== false,
    sceneDark,
    fromWallpaper: true,
    // 跟随壁纸场景时：OOBE 内不写盘（applyTheme 会看 oobe-active）
    persist: options.persist
  });
}

/**
 * 更新明暗分段 UI
 * @param {string} [pref] 用户偏好
 * @param {string} [resolved] 实际 light/dark
 */
function updateModeToggleUI(pref, resolved) {
  const nextPref = typeof normalizeModePref === 'function'
    ? normalizeModePref(pref || getModePref())
    : (pref || 'light');
  const nextMode =
    resolved === 'dark' || resolved === 'light'
      ? resolved
      : resolveModeFromPref(nextPref);

  const modeToggle = document.getElementById('modeToggle');
  if (modeToggle) {
    const next = nextMode === 'dark' ? '浅色' : '深色';
    modeToggle.setAttribute('aria-label', `切换{next}界面`);
    modeToggle.title = `切换{next}界面`;
  }

  const segment = document.getElementById('modeSegment');
  if (segment) {
    segment.querySelectorAll('.mode-segment-btn').forEach((btn) => {
      const active = btn.getAttribute('data-mode') === nextPref;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  const tip = document.getElementById('modeSettingTip');
  if (tip) {
    const unsupportedBg =
      (typeof isImageBackgroundActive === 'function' && !isImageBackgroundActive());
    const tips = {
      light: '固定浅色界面',
      dark: '固定深色界面',
      system: '跟随系统浅深',
      wallpaper: unsupportedBg
        ? '当前背景无壁纸场景，请先选图片背景'
        : '跟随壁纸深浅'
    };
    tip.textContent = tips[nextPref] || tips.light;
  }

  // 当前背景没有可取样场景时隐藏「壁纸」选项（正式设置与欢迎一致）
  if (segment) {
    const unsupportedBg =
      (typeof isImageBackgroundActive === 'function' && !isImageBackgroundActive());
    const wallBtn = segment.querySelector('[data-mode="wallpaper"]');
    if (wallBtn) {
      wallBtn.hidden = !!unsupportedBg;
      wallBtn.disabled = !!unsupportedBg;
      wallBtn.classList.toggle('is-disabled', !!unsupportedBg);
      wallBtn.setAttribute('aria-disabled', unsupportedBg ? 'true' : 'false');
      wallBtn.title = unsupportedBg ? '当前背景不可用，请先选图片背景' : '跟随壁纸深浅';
      if (unsupportedBg) {
        wallBtn.classList.remove('active');
        wallBtn.setAttribute('aria-checked', 'false');
      }
    }
    segment.classList.toggle('mode-segment--3', !!unsupportedBg);
    segment.classList.toggle('mode-segment--4', !unsupportedBg);
  }
}

/**
 * CSS 变量映射（区--font-* / --weight-* */
const TYPE_ROLE_CSS = {
  greeting: { font: '--font-greeting', weight: '--weight-greeting', size: '--size-greeting' },
  greetingSub: { font: '--font-greeting-sub', weight: '--weight-greeting-sub', size: '--size-greeting-sub' },
  search: { font: '--font-search', weight: '--weight-search', size: '--size-search' },
  shortcuts: { font: '--font-shortcuts', weight: '--weight-shortcuts', size: '--size-shortcuts' }
};

/**
 * 应用全部文字区域字体（写 CSS 变量；问候主文案额外写内联，兼容旧逻辑 */
function applyTypeRoles(rolesInput) {
  const roles = rolesInput || (typeof loadTypeRoles === 'function' ? loadTypeRoles() : DEFAULT_TYPE_ROLES);
  const root = document.documentElement;

  TYPE_ROLE_KEYS.forEach((key) => {
    const role = roles[key] || DEFAULT_TYPE_ROLES[key];
    const fontKey = resolveFontKey(role.font);
    const weight = normalizeWeight(role.weight, (DEFAULT_TYPE_ROLES[key] || {}).weight || DEFAULT_WEIGHT);
    const size = typeof normalizeTypeSize === 'function'
      ? normalizeTypeSize(role.size, (DEFAULT_TYPE_ROLES[key] || {}).size || 100)
      : 100;
    const fontFamily = (typeof getFontFamily === 'function' ? getFontFamily(fontKey) : (FONTS[fontKey] || FONTS[DEFAULT_FONT]));
    const css = TYPE_ROLE_CSS[key];
    if (!css) return;
    root.style.setProperty(css.font, fontFamily);
    root.style.setProperty(css.weight, weight);
    if (css.size) root.style.setProperty(css.size, String(size / 100));
  });

  const greeting = roles.greeting || DEFAULT_TYPE_ROLES.greeting;
  const greetingFont = (typeof getFontFamily === 'function' ? getFontFamily(greeting.font) : (FONTS[resolveFontKey(greeting.font)] || FONTS[DEFAULT_FONT]));
  const greetingWeight = normalizeWeight(greeting.weight, DEFAULT_WEIGHT);
  const greetingSize = typeof normalizeTypeSize === 'function'
    ? normalizeTypeSize(greeting.size, 100)
    : 100;
  root.style.setProperty('--font-display', greetingFont);
  root.style.setProperty('--boot-greeting-weight', greetingWeight);
  root.style.setProperty('--size-greeting', String(greetingSize / 100));

  const greetingEl = document.getElementById('greeting');
  if (greetingEl) {
    greetingEl.style.fontFamily = greetingFont;
    greetingEl.style.fontWeight = greetingWeight;
  }

  const subEl = document.getElementById('greetingSub');
  if (subEl) {
    const sub = roles.greetingSub || DEFAULT_TYPE_ROLES.greetingSub;
    subEl.style.fontFamily = (typeof getFontFamily === 'function' ? getFontFamily(sub.font) : (FONTS[resolveFontKey(sub.font)] || FONTS.system));
    subEl.style.fontWeight = normalizeWeight(sub.weight, '400');
  }

  return roles;
}

/**
 * 更新单个区域
 */
function applyTypeRole(roleKey, patch) {
  const roles = typeof loadTypeRoles === 'function' ? loadTypeRoles() : JSON.parse(JSON.stringify(DEFAULT_TYPE_ROLES));
  const current = roles[roleKey] || { ...(DEFAULT_TYPE_ROLES[roleKey] || DEFAULT_TYPE_ROLES.greeting) };
  if (patch.font != null) current.font = resolveFontKey(patch.font);
  if (patch.weight != null) current.weight = normalizeWeight(patch.weight, current.weight);
  if (patch.size != null) {
    current.size = typeof normalizeTypeSize === 'function'
      ? normalizeTypeSize(patch.size, current.size || 100)
      : Number(patch.size) || 100;
  }
  roles[roleKey] = current;
  if (typeof saveTypeRoles === 'function') saveTypeRoles(roles);
  applyTypeRoles(roles);
  return roles;
}

/**
 * 兼容API：全局标题字体 映射到问候主文案
 */
function applyFont(fontKey) {
  const resolved = resolveFontKey(fontKey);
  applyTypeRole('greeting', { font: resolved });
  return resolved;
}

/**
 * 兼容API：全局标题粗细 映射到问候主文案
 */
function applyWeight(weight) {
  const w = normalizeWeight(weight, DEFAULT_WEIGHT);
  applyTypeRole('greeting', { weight: w });
  return w;
}

/**
 * 流光渐变调色UI 颜色桥接
 * 当流光设置变化、背景模式切换、明暗切换时，重新应用调色板
 */
(function initGrainUiBridge() {
  if (window.__grainUiBridgeBound) return;
  window.__grainUiBridgeBound = true;

  // 流光设置变化
  window.addEventListener('grain-settings-change', () => {
    applyGrainPalette();
  });

  // 背景模式切换时（solid/grain/bing/local题
  window.addEventListener('bg-mode-change', () => {
    applyGrainPalette();
  });

  // 明暗切换
  window.addEventListener('mode-change', () => {
    applyGrainPalette();
  });
})();
