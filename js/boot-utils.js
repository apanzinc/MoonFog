/**
 * MoonFog - Boot 阶段共用工具
 * 与 boot-config.js、greeting-boot.js 复用
 * 必须�?utils.js 之后加载
 */

/**
 * 安全读取 localStorage (同步，带类型转换)
 */
function bootGet(key, fallback = '', type = 'string') {
  try {
    const val = localStorage.getItem(key);
    if (val == null) return fallback;
    switch (type) {
      case 'number': return Number(val);
      case 'boolean': return val === '1' || val === 'true';
      case 'json': return JSON.parse(val);
      default: return val;
    }
  } catch (_) {
    return fallback;
  }
}

/**
 * 安全写入 localStorage (同步)
 */
function bootSet(key, value, type = 'string') {
  try {
    let raw;
    switch (type) {
      case 'number': raw = String(Number(value)); break;
      case 'boolean': raw = value ? '1' : '0'; break;
      case 'json': raw = JSON.stringify(value); break;
      default: raw = String(value);
    }
    localStorage.setItem(key, raw);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 解析色调
 */
function bootResolveTone(raw) {
  const valid = { sand: 1, cream: 1, rose: 1, sage: 1, sky: 1, lavender: 1, slate: 1 };
  return valid[raw] ? raw : 'sand';
}

/**
 * 解析模式偏好
 */
function bootResolveModePref(raw) {
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  if (raw === 'auto' || raw === 'wallpaper') return 'system';
  return 'light';
}

/**
 * 获取系统配色方案
 */
function bootGetSystemColorScheme() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (_) {}
  return 'light';
}

/**
 * 根据偏好解析最�?light/dark
 */
function bootResolveEffectiveMode(pref, sceneDark) {
  const p = bootResolveModePref(pref);
  if (p === 'dark' || p === 'light') return p;
  if (p === 'system') return bootGetSystemColorScheme();
  return 'light';
}

/**
 * 解析字体�? */
function bootResolveFontKey(raw) {
  if (raw === 'genyomin') return 'sourcehanserif';
  if (raw === 'custom') {
    const legacy = bootGet('moonfog_custom_system_font', '', 'string');
    return legacy ? ('sys:' + legacy) : 'system';
  }
  if (typeof raw === 'string' && raw.startsWith('sys:')) {
    const name = String(raw.slice(4) || '').replace(/[\r\n\t]/g, ' ').replace(/[;{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    return name ? ('sys:' + name) : 'system';
  }
  const fonts = { sourcehanserif: 1, system: 1 };
  return fonts[raw] ? raw : 'sourcehanserif';
}

/**
 * 获取字体�? */
function bootGetFontFamily(fontKey) {
  const key = bootResolveFontKey(fontKey);
  if (key.startsWith('sys:')) {
    const name = key.slice(4);
    return `'${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  }
  const fonts = {
    sourcehanserif: "'SourceHanSerif', 'Noto Serif SC', 'Source Han Serif SC', serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };
  return fonts[key] || fonts.sourcehanserif;
}

/**
 * 归一化模糊�?0-40
 */
function bootNormalizeBlur(val, def) {
  const n = Number(val);
  if (!Number.isFinite(n)) return def;
  return Math.min(40, Math.max(0, Math.round(n)));
}

/**
 * 归一化背景模�? */
function bootNormalizeBgMode(val) {
  return ['local', 'bing', 'grain', 'solid'].includes(val) ? val : 'solid';
}

/**
 * 归一化问候模�? */
function bootNormalizeGreetingMode(val) {
  const modes = ['greeting', 'clock', 'date', 'quote', 'custom'];
  return modes.includes(val) ? val : 'greeting';
}

/**
 * 归一化性能模式
 */
function bootNormalizePerfMode(val) {
  const v = String(val == null ? '' : val).toLowerCase();
  if (v === 'full' || v === '0' || v === 'off' || v === 'false') return 'full';
  if (v === 'balanced' || v === '1' || v === 'partial' || v === 'mid') return 'balanced';
  if (v === 'low' || v === '2' || v === 'full-limit' || v === 'true' || v === 'on') return 'low';
  return 'full';
}

/**
 * 构建 boot 配置对象 (�?window.__MOONFOG_BOOT__ 使用)
 */
function buildBootConfig() {
  const tone = bootResolveTone(bootGet('moonfog_tone', 'sand'));
  const modePref = bootResolveModePref(bootGet('moonfog_mode_pref') || bootGet('moonfog_mode'));
  const mode = bootResolveEffectiveMode(modePref);
  const fontKey = bootResolveFontKey(bootGet('moonfog_font', 'sourcehanserif'));
  const weight = bootGet('moonfog_weight', '700');
  if (!/^(400|500|600|700)$/.test(weight)) weight = '700';

  const bgBlur = bootNormalizeBlur(bootGet('moonfog_bg_blur'), 20);
  const searchBlur = bgBlur;
  const panelBlur = bootNormalizeBlur(bootGet('moonfog_panel_blur'), 10);
  const perfMode = bootNormalizePerfMode(bootGet('moonfog_perf_mode'));
  const bgMode = bootNormalizeBgMode(bootGet('moonfog_bg_mode', 'solid'));
  const greetingMode = bootNormalizeGreetingMode(bootGet('moonfog_greeting_mode', 'greeting'));

  let bgUrl = '';
  if (bgMode === 'local') {
    bgUrl = bootGet('moonfog_bg_local', '');
  } else if (bgMode === 'bing') {
    try {
      const bing = JSON.parse(bootGet('moonfog_bg_bing', 'null'));
      if (bing && bing.imageUrl) bgUrl = bing.imageUrl;
    } catch (_) {}
  }

  return {
    tone,
    mode,
    modePref,
    fontKey,
    weight,
    bgMode,
    bgUrl,
    blur: bgBlur,
    searchBlur,
    panelBlur,
    perfMode,
    greetingMode
  };
}

/**
 * 应用性能模式到根元素
 */
function applyPerfModeToRoot(root, mode) {
  root.classList.remove('low-perf', 'perf-balanced', 'perf-low', 'perf-full');
  root.setAttribute('data-perf', mode);
  if (mode === 'low') root.classList.add('low-perf', 'perf-low');
  else if (mode === 'balanced') root.classList.add('perf-balanced');
  else root.classList.add('perf-full');
}

/**
 * 计算视觉模糊�?(考虑性能模式)
 */
function computeVisualBlur(baseBlur, perfMode) {
  if (perfMode === 'low') return 0;
  if (perfMode === 'balanced') return Math.min(6, Math.round(baseBlur * 0.45));
  return baseBlur;
}

/**
 * 计算缩放比例
 */
function computeScale(visualBlur, perfMode) {
  if (perfMode === 'low') return 1;
  return 1 + Math.min(0.12, visualBlur / 200);
}

/**
 * 计算中性遮�?CSS
 */
function computeBgWashCss(wash) {
  const v = Math.min(50, Math.max(-50, Math.round(Number(wash) || 0)));
  if (v === 0) return 'transparent';
  const a = Math.min(0.72, Math.abs(v) / 50 * 0.72);
  return v < 0 ? `rgba(0,0,0,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`;
}

/**
 * 归一化问候字�?70-140
 */
function bootNormalizeGreetingSize(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 100;
  return Math.min(140, Math.max(70, Math.round(n)));
}

/**
 * 解析背景色板 (用于 boot 注入)
 */
function bootParsePalette(raw) {
  try {
    const palette = JSON.parse(raw || 'null');
    if (!palette || !palette.text || !(palette.v >= 4 && palette.v <= 30)) return null;
    return palette;
  } catch (_) {
    return null;
  }
}

/**
 * 生成问候标�?CSS (根据模式)
 */
function buildGreetingTitleCss(mode, greetingSize, fontFamily, weight) {
  const size = `calc(clamp(1.35rem,3.2vw,1.9rem)*${greetingSize/100})`;
  const sizeClock = `calc(clamp(2.25rem,6vw,3.25rem)*${greetingSize/100})`;
  const sizeDefault = `calc(clamp(1.75rem,4vw,2.25rem)*${greetingSize/100})`;

  if (mode === 'quote' || mode === 'custom') {
    return `.greeting-title{font-family:${fontFamily}!important;font-weight:${weight}!important;font-size:${size}!important;letter-spacing:0.01em!important;line-height:1.4!important;}`;
  }
  if (mode === 'clock') {
    return `.greeting-title{font-family:${fontFamily}!important;font-weight:${weight}!important;font-size:${sizeClock}!important;letter-spacing:0.04em!important;font-variant-numeric:tabular-nums;}`;
  }
  return `.greeting-title{font-family:${fontFamily}!important;font-weight:${weight}!important;font-size:${sizeDefault}!important;}`;
}

/**
 * 预加载图片并解码
 */
function bootPreloadImage(url) {
  return new Promise(resolve => {
    if (!url) return resolve(false);
    const img = new Image();
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    img.onload = () => {
      if (img.decode) img.decode().then(() => finish(true)).catch(() => finish(true));
      else if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => finish(true)));
      } else setTimeout(finish, 0);
    };
    img.onerror = () => finish(false);
    img.src = url;
    if (img.complete && img.naturalWidth > 0) img.onload();
  });
}

// 导出到全局�?boot 脚本使用
window.__MOONFOG_BOOT_UTILS__ = {
  bootGet,
  bootSet,
  bootResolveTone,
  bootResolveModePref,
  bootGetSystemColorScheme,
  bootResolveEffectiveMode,
  bootResolveFontKey,
  bootGetFontFamily,
  bootNormalizeBlur,
  bootNormalizeBgMode,
  bootNormalizeGreetingMode,
  bootNormalizePerfMode,
  bootNormalizeGreetingSize,
  buildBootConfig,
  applyPerfModeToRoot,
  computeVisualBlur,
  computeScale,
  computeBgWashCss,
  bootParsePalette,
  buildGreetingTitleCss,
  bootPreloadImage
};