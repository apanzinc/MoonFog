/**
 * MoonFog - 首屏同步配置（精简版）
 * 职责：theme 注入 + CSS 变量 + boot-ready 状态
 * 问候文案 → greeting-boot.js | 背景预加载 → background-boot.js
 */
(function () {
  'use strict';

  const root = document.documentElement;

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // OOBE 因编码损坏暂不可用，跳过 boot-oobe-pending
  // if (get('moonfog_oobe_done') !== '1') {
  //   root.classList.add('boot-oobe-pending');
  // }

  const DEF_BG_BLUR = 20;
  const DEF_SEARCH_BLUR = 40;
  const DEF_PANEL_BLUR = 10;
  const DEF_BG_WASH = -20;

  const THEMES = {
    sand: {
      light: { '--bg-warm':'#F5F0E8','--bg-warm-alt':'#EDE8E0','--card-bg':'#FFFFFF','--text-primary':'#1A1A1A','--text-secondary':'#6B6B6B','--text-tertiary':'#9A9A9A','--border':'rgba(0,0,0,0.08)','--border-strong':'rgba(0,0,0,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.06)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.1)' },
      dark:  { '--bg-warm':'#1E1C18','--bg-warm-alt':'#2A2720','--card-bg':'#332F28','--text-primary':'#E5DFD0','--text-secondary':'#9A9485','--text-tertiary':'#6A6558','--accent':'#D4A855','--accent-hover':'#C49A45','--accent-glow':'rgba(212,168,85,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    cream: {
      light: { '--bg-warm':'#FDF6EC','--bg-warm-alt':'#F5ECD8','--card-bg':'#FFFEFA','--text-primary':'#2C1810','--text-secondary':'#7A6555','--text-tertiary':'#A89888','--border':'rgba(80,50,20,0.08)','--border-strong':'rgba(80,50,20,0.15)','--shadow':'0 4px 20px rgba(80,50,20,0.06)','--shadow-hover':'0 8px 30px rgba(80,50,20,0.1)' },
      dark:  { '--bg-warm':'#1E1A14','--bg-warm-alt':'#2A2418','--card-bg':'#332C1E','--text-primary':'#E8DCC8','--text-secondary':'#9A8A70','--text-tertiary':'#6A6048','--accent':'#D4A855','--accent-hover':'#C49A45','--accent-glow':'rgba(212,168,85,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    rose: {
      light: { '--bg-warm':'#F8EDE8','--bg-warm-alt':'#F0E0D8','--card-bg':'#FFFCFB','--text-primary':'#2D1B18','--text-secondary':'#7A5550','--text-tertiary':'#A88882','--border':'rgba(100,50,40,0.08)','--border-strong':'rgba(100,50,40,0.15)','--shadow':'0 4px 20px rgba(100,50,40,0.06)','--shadow-hover':'0 8px 30px rgba(100,50,40,0.1)' },
      dark:  { '--bg-warm':'#1E1818','--bg-warm-alt':'#2A2020','--card-bg':'#332828','--text-primary':'#E8D8D0','--text-secondary':'#9A7A72','--text-tertiary':'#6A5550','--accent':'#D4725E','--accent-hover':'#C46050','--accent-glow':'rgba(212,114,94,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    sage: {
      light: { '--bg-warm':'#ECEEE5','--bg-warm-alt':'#E0E3D5','--card-bg':'#FAFBF8','--text-primary':'#1E2018','--text-secondary':'#5D6050','--text-tertiary':'#8B8E80','--border':'rgba(50,60,30,0.08)','--border-strong':'rgba(50,60,30,0.15)','--shadow':'0 4px 20px rgba(50,60,30,0.06)','--shadow-hover':'0 8px 30px rgba(50,60,30,0.1)' },
      dark:  { '--bg-warm':'#181C16','--bg-warm-alt':'#222820','--card-bg':'#2A3228','--text-primary':'#D8E0D0','--text-secondary':'#889878','--text-tertiary':'#5E6A50','--accent':'#7AB85E','--accent-hover':'#6AA84E','--accent-glow':'rgba(122,184,94,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    sky: {
      light: { '--bg-warm':'#E8F0F5','--bg-warm-alt':'#D8E4ED','--card-bg':'#FAFCFE','--text-primary':'#15202B','--text-secondary':'#4A6275','--text-tertiary':'#8098A8','--border':'rgba(20,50,80,0.08)','--border-strong':'rgba(20,50,80,0.15)','--shadow':'0 4px 20px rgba(20,50,80,0.06)','--shadow-hover':'0 8px 30px rgba(20,50,80,0.1)' },
      dark:  { '--bg-warm':'#161B20','--bg-warm-alt':'#20282E','--card-bg':'#283238','--text-primary':'#D0DAE5','--text-secondary':'#7898B0','--text-tertiary':'#506878','--accent':'#4EA4F0','--accent-hover':'#3A90D8','--accent-glow':'rgba(78,164,240,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    lavender: {
      light: { '--bg-warm':'#EDE8F0','--bg-warm-alt':'#E0D8E6','--card-bg':'#FCFAFD','--text-primary':'#1E1828','--text-secondary':'#5E5470','--text-tertiary':'#8C82A0','--border':'rgba(50,30,70,0.08)','--border-strong':'rgba(50,30,70,0.15)','--shadow':'0 4px 20px rgba(50,30,70,0.06)','--shadow-hover':'0 8px 30px rgba(50,30,70,0.1)' },
      dark:  { '--bg-warm':'#1A1620','--bg-warm-alt':'#241E2A','--card-bg':'#2C2833','--text-primary':'#DAD0E5','--text-secondary':'#8A7CA0','--text-tertiary':'#5E5570','--accent':'#A080D0','--accent-hover':'#8E6EC0','--accent-glow':'rgba(160,128,208,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    slate: {
      light: { '--bg-warm':'#E8E9EC','--bg-warm-alt':'#DCDEE3','--card-bg':'#F8F9FA','--text-primary':'#1A1C20','--text-secondary':'#555960','--text-tertiary':'#8A8E95','--border':'rgba(30,30,40,0.1)','--border-strong':'rgba(30,30,40,0.18)','--shadow':'0 4px 20px rgba(30,30,40,0.08)','--shadow-hover':'0 8px 30px rgba(30,30,40,0.12)' },
      dark:  { '--bg-warm':'#1A1B1E','--bg-warm-alt':'#24262A','--card-bg':'#2A2C30','--text-primary':'#E0E0E0','--text-secondary':'#9A9A9A','--text-tertiary':'#6A6A6A','--accent':'#8AB0C8','--accent-hover':'#7A9EB8','--accent-glow':'rgba(138,176,200,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    }
  };

  const FONTS = {
    sourcehanserif: "'SourceHanSerif', 'Noto Serif SC', 'Source Han Serif SC', serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  // --- Tone / Mode 解析 ---
  let tone = get('moonfog_tone');
  let modePref = get('moonfog_mode_pref') || get('moonfog_mode');
  let mode = get('moonfog_mode');
  if (!tone && get('moonfog_theme')) {
    let old = get('moonfog_theme');
    if (old === 'night') { tone = 'slate'; modePref = 'dark'; mode = 'dark'; }
    else { tone = old; modePref = 'light'; mode = 'light'; }
    set('moonfog_tone', tone); set('moonfog_mode', mode); set('moonfog_mode_pref', modePref);
    try { localStorage.removeItem('moonfog_theme'); } catch (e) {}
  }
  const validTones = { sand:1, cream:1, rose:1, sage:1, sky:1, lavender:1, slate:1 };
  if (!validTones[tone]) tone = 'sand';
  if (modePref !== 'dark' && modePref !== 'light' && modePref !== 'system') {
    modePref = (mode === 'dark' || mode === 'light') ? mode : 'system';
  }
  if (modePref === 'dark' || modePref === 'light') { mode = modePref; }
  else if (modePref === 'system') {
    try { mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { mode = 'light'; }
  } else { mode = 'light'; }
  if (mode !== 'dark' && mode !== 'light') mode = 'light';

  root.setAttribute('data-tone', tone);
  root.setAttribute('data-mode', mode);
  root.setAttribute('data-mode-pref', modePref);
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';

  // --- CSS 变量注入 ---
  let themeVars = (THEMES[tone] && THEMES[tone][mode]) || THEMES.sand.light;
  const cssParts = [];

  // 字体
  let customSystemFont = String(get('moonfog_custom_system_font') || '')
    .replace(/[\r\n\t]/g, ' ').replace(/[;{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (customSystemFont) {
    FONTS.custom = "'" + customSystemFont.replace(/\\/g, '\\\\').replace(/'/g, "\\'") +
      "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }
  let fontKey = get('moonfog_font') || 'sourcehanserif';
  if (fontKey === 'genyomin') { fontKey = 'sourcehanserif'; try { set('moonfog_font', 'sourcehanserif'); } catch (e) {} }
  let fontFamily = FONTS.sourcehanserif;
  if (fontKey && fontKey.indexOf('sys:') === 0) {
    let sysName = String(fontKey.slice(4) || '').replace(/[\r\n\t]/g, ' ').replace(/[;{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (sysName) { fontFamily = "'" + sysName.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"; }
    else { fontKey = 'sourcehanserif'; fontFamily = FONTS.sourcehanserif; }
  } else if (fontKey === 'custom') {
    let legacyName = String(get('moonfog_custom_system_font') || '').replace(/[\r\n\t]/g, ' ').replace(/[;{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (legacyName) { fontKey = 'sys:' + legacyName; fontFamily = "'" + legacyName.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"; }
    else { fontKey = 'system'; fontFamily = FONTS.system || FONTS.sourcehanserif; }
  } else {
    if (!FONTS[fontKey]) fontKey = 'sourcehanserif';
    fontFamily = FONTS[fontKey] || FONTS.sourcehanserif;
  }
  let weight = get('moonfog_weight') || '700';
  if (!/^(400|500|600|700)$/.test(weight)) weight = '700';

  // 模糊 / 缩放
  let blur = parseInt(get('moonfog_bg_blur'), 10);
  if (!isFinite(blur)) blur = DEF_BG_BLUR;
  blur = Math.min(40, Math.max(0, blur));
  let searchBlur = parseInt(get('moonfog_search_blur'), 10);
  if (!isFinite(searchBlur)) searchBlur = DEF_SEARCH_BLUR;
  searchBlur = Math.min(40, Math.max(0, searchBlur));
  let panelBlur = parseInt(get('moonfog_panel_blur'), 10);
  if (!isFinite(panelBlur)) panelBlur = DEF_PANEL_BLUR;
  panelBlur = Math.min(40, Math.max(0, panelBlur));
  let perfMode = get('moonfog_perf_mode');
  if (!perfMode) { let legacyLow = get('moonfog_low_perf'); if (legacyLow === '1' || legacyLow === 'true') perfMode = 'low'; else perfMode = 'full'; }
  if (perfMode !== 'full' && perfMode !== 'balanced' && perfMode !== 'low') {
    if (perfMode === '1' || perfMode === 'partial') perfMode = 'balanced';
    else if (perfMode === '2' || perfMode === 'true') perfMode = 'low';
    else perfMode = 'full';
  }
  root.setAttribute('data-perf', perfMode);
  root.classList.remove('low-perf', 'perf-balanced', 'perf-low', 'perf-full');
  if (perfMode === 'low') root.classList.add('low-perf', 'perf-low');
  else if (perfMode === 'balanced') root.classList.add('perf-balanced');
  else root.classList.add('perf-full');

  let visualBlur = blur, visualSearchBlur = searchBlur, visualPanelBlur = panelBlur;
  if (perfMode === 'low') { visualBlur = 0; visualSearchBlur = 0; visualPanelBlur = 0; }
  else if (perfMode === 'balanced') { visualBlur = Math.min(6, Math.round(blur * 0.45)); }
  let scale = 1 + Math.min(0.12, visualBlur / 200);
  if (perfMode === 'low') scale = 1;

  // --- 构建 CSS ---
  cssParts.push('html[data-tone="' + tone + '"][data-mode="' + mode + '"]{color-scheme:' + (mode === 'dark' ? 'dark' : 'light') + ';');
  Object.keys(themeVars).forEach(function (k) { cssParts.push(k + ':' + themeVars[k] + ';'); });

  let greetingSize = parseInt(get('moonfog_greeting_size'), 10);
  if (!isFinite(greetingSize)) {
    try {
      let typeRolesBoot = JSON.parse(get('moonfog_type_roles') || 'null');
      if (typeRolesBoot && typeRolesBoot.greeting && typeRolesBoot.greeting.size != null) {
        greetingSize = parseInt(typeRolesBoot.greeting.size, 10);
      }
    } catch (e) {}
  }
  if (!isFinite(greetingSize)) greetingSize = 100;
  greetingSize = Math.min(140, Math.max(70, greetingSize));
  cssParts.push('--font-display:' + fontFamily + ';');
  cssParts.push('--boot-greeting-weight:' + weight + ';');
  cssParts.push('--size-greeting:' + (greetingSize / 100) + ';');

  let bgWash = parseInt(get('moonfog_bg_wash'), 10);
  if (!isFinite(bgWash)) bgWash = DEF_BG_WASH;
  bgWash = Math.min(50, Math.max(-50, bgWash));
  let washCss = 'transparent';
  if (bgWash !== 0) {
    let washA = Math.min(0.72, Math.abs(bgWash) / 50 * 0.72);
    washCss = bgWash < 0 ? ('rgba(0,0,0,' + washA.toFixed(3) + ')') : ('rgba(255,255,255,' + washA.toFixed(3) + ')');
  }
  cssParts.push('--bg-blur:' + visualBlur + 'px;--search-blur:' + visualSearchBlur + 'px;--panel-blur:' + visualPanelBlur + 'px;');
  cssParts.push('--bg-scale:' + scale + ';--bg-neutral-wash:' + washCss + ';--img-wash:' + washCss + ';');
  cssParts.push('}');

  // --- 背景模式 + 图片色板 ---
  let bgMode = get('moonfog_bg_mode') || 'solid';
  if (bgMode !== 'local' && bgMode !== 'bing' && bgMode !== 'grain' && bgMode !== 'solid') bgMode = 'solid';
  let bgUrl = '';
  if (bgMode === 'local') { bgUrl = get('moonfog_bg_local') || ''; }
  else if (bgMode === 'bing') {
    try { let bing = JSON.parse(get('moonfog_bg_bing') || 'null'); if (bing && bing.imageUrl) bgUrl = bing.imageUrl; } catch (e) { bgUrl = ''; }
  }
  if (bgMode === 'grain') root.classList.add('boot-has-grain');

  // 流光模式：问候文字强制白色（内联 style 优先级最高，确保第一帧就是白字）
  if (bgMode === 'grain') {
    cssParts.push('html.boot-has-grain .greeting-title,html.boot-has-grain .greeting-sub{color:#FFF!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important;background:none!important;}');

    // 首帧注入流光配色 CSS 变量（防止闪烁默认色）
    try {
      var grainThemeRaw = JSON.parse(get('moonfog_grain_theme') || 'null');
      var grainSettingsRaw = JSON.parse(get('moonfog_grain_settings') || 'null');
      var seedHex = (grainThemeRaw && /^#[0-9a-f]{6}$/i.test(grainThemeRaw.themeColor)) ? grainThemeRaw.themeColor : '#d8b569';
      // 内联 HSL 生成（boot 阶段无 utils.js）
      var _rgb = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(seedHex);
      if (_rgb) {
        var sr = parseInt(_rgb[1], 16) / 255, sg = parseInt(_rgb[2], 16) / 255, sb = parseInt(_rgb[3], 16) / 255;
        var sMax = Math.max(sr, sg, sb), sMin = Math.min(sr, sg, sb), sL = (sMax + sMin) / 2;
        var sH = 0, sS = 0;
        if (sMax !== sMin) {
          var sD = sMax - sMin;
          sS = sL > 0.5 ? sD / (2 - sMax - sMin) : sD / (sMax + sMin);
          if (sMax === sr) sH = ((sg - sb) / sD + (sg < sb ? 6 : 0)) / 6;
          else if (sMax === sg) sH = ((sb - sr) / sD + 2) / 6;
          else sH = ((sr - sg) / sD + 4) / 6;
        }
        sH = Math.round(sH * 360); sS = Math.round(sS * 100); sL = Math.round(sL * 100);
        function _hsl2rgb(h, s, l) {
          s /= 100; l /= 100;
          var c = (1 - Math.abs(2 * l - 1)) * s;
          var x = c * (1 - Math.abs((h / 60) % 2 - 1));
          var m = l - c / 2; var r = 0, g = 0, b = 0;
          if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
          else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
          else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
          return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
        }
        function _rgb2hex(r, g, b) { return '#' + [r, g, b].map(function (v) { var h = v.toString(16); return h.length < 2 ? '0' + h : h; }).join(''); }
        function _hslHex(h, s, l) { var rgb = _hsl2rgb(((h % 360) + 360) % 360, Math.min(100, Math.max(0, s)), Math.min(100, Math.max(0, l))); return _rgb2hex(rgb[0], rgb[1], rgb[2]); }
        var isDark = mode === 'dark';
        var back = isDark ? _hslHex(sH, Math.min(sS, 25), 8) : _hslHex(sH, Math.min(sS, 20), 95);
        var autoColors = [
          seedHex,
          _hslHex(sH + 15, Math.min(sS + 5, 100), sL + 12),
          _hslHex(sH - 10, Math.min(sS - 8, 100), sL - 10),
          _hslHex(sH + 35, Math.min(sS - 15, 100), sL + 5),
          _hslHex(sH + 180, Math.min(sS - 5, 100), sL),
          _hslHex(sH + 60, Math.min(sS - 20, 100), sL + 15),
          _hslHex(sH - 30, Math.min(sS - 10, 100), sL - 5)
        ];
        // 如果有保存的 grainSettings，用它的 colorBack（可能用户手动调过）
        var savedBack = grainSettingsRaw && grainSettingsRaw[mode] && grainSettingsRaw[mode].colorBack;
        if (/^#[0-9a-f]{6}$/i.test(savedBack)) back = savedBack;
        var colorCount = (grainSettingsRaw && grainSettingsRaw.colorCount) || 4;
        var accentRgb = _hsl2rgb(sH, Math.min(sS, 100), sL);
        var accent = seedHex;
        var accentGlow = 'rgba(' + accentRgb[0] + ',' + accentRgb[1] + ',' + accentRgb[2] + ',0.15)';
        var backRgb = _hsl2rgb(sH, Math.min(sS, 25), isDark ? 8 : 95);
        var bgWarmAlt = isDark
          ? 'rgb(' + Math.min(255, backRgb[0] + 15) + ',' + Math.min(255, backRgb[1] + 12) + ',' + Math.min(255, backRgb[2] + 10) + ')'
          : 'rgb(' + Math.max(0, backRgb[0] - 8) + ',' + Math.max(0, backRgb[1] - 8) + ',' + Math.max(0, backRgb[2] - 6) + ')';
        var cardBg = isDark
          ? 'rgba(' + Math.min(255, backRgb[0] + 25) + ',' + Math.min(255, backRgb[1] + 22) + ',' + Math.min(255, backRgb[2] + 18) + ',0.85)'
          : 'rgba(255,255,255,0.85)';
        cssParts.push('html{');
        cssParts.push('--bg-warm:' + back + '!important;--bg-warm-alt:' + bgWarmAlt + '!important;--card-bg:' + cardBg + '!important;');
        cssParts.push('--accent:' + accent + '!important;--accent-glow:' + accentGlow + '!important;');
        cssParts.push('--border:rgba(255,255,255,0.12)!important;--border-strong:rgba(255,255,255,0.2)!important;');
        cssParts.push('}');
      }
    } catch (e) {}
  }

  if (bgUrl && (bgMode === 'local' || bgMode === 'bing')) {
    root.classList.add('boot-has-image');
    let safeUrl = String(bgUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    cssParts.push('html.boot-has-image .page-bg-image{background-image:url("' + safeUrl + '");}');
    try {
      let palette = JSON.parse(get('moonfog_bg_palette') || 'null');
      if (palette && palette.text && palette.v >= 4 && palette.v <= 30) {
        cssParts.push('html.boot-has-image{');
        cssParts.push('--img-text:' + palette.text + ';--img-text-secondary:' + (palette.textSecondary || palette.text) + ';--img-text-muted:' + (palette.textMuted || palette.textSecondary || palette.text) + ';');
        cssParts.push('--img-text-glow:' + (palette.textGlow || 'transparent') + ';--img-text-shadow:none;--img-text-shadow-soft:none;');
        cssParts.push('--img-text-accent:' + (palette.textAccent || palette.accent || palette.text) + ';');
        cssParts.push('--img-chrome-text:' + (palette.chromeText || palette.text) + ';--img-chrome-text-secondary:' + (palette.chromeTextSecondary || palette.textSecondary || palette.text) + ';--img-chrome-text-muted:' + (palette.chromeTextMuted || palette.textMuted || palette.text) + ';');
        cssParts.push('--img-surface:' + (palette.surface || 'rgba(20,24,32,0.72)') + ';--img-surface-hover:' + (palette.surfaceHover || palette.surface || 'rgba(20,24,32,0.86)') + ';');
        cssParts.push('--img-chip:' + (palette.chip || 'transparent') + ';--img-border:' + (palette.border || 'rgba(255,255,255,0.34)') + ';--img-shadow:' + (palette.shadow || 'rgba(0,0,0,0.24)') + ';');
        cssParts.push('--img-credit-bg:' + (palette.creditBg || 'rgba(0,0,0,0.45)') + ';--img-credit-text:' + (palette.creditText || palette.text) + ';');
        cssParts.push('--img-accent:' + (palette.accent || palette.textAccent || palette.text) + ';--img-accent-soft:' + (palette.accentSoft || 'transparent') + ';--img-accent-2:' + (palette.accent2 || palette.accent || 'transparent') + ';--img-focus-ring:' + (palette.focusRing || palette.accentSoft || 'transparent') + ';');
        if (palette.seedHex) cssParts.push('--img-seed:' + palette.seedHex + ';');
        cssParts.push('}');
        if (palette.isDarkUi) root.classList.add('boot-img-ui-dark');
        else root.classList.add('boot-img-ui-light');
      } else {
        // 无缓存取色时：图片背景默认白字 + 压暗遮罩
        cssParts.push('html.boot-has-image{');
        cssParts.push('--img-text:#FFF;--img-text-secondary:rgba(255,255,255,0.75);--img-text-muted:rgba(255,255,255,0.5);');
        cssParts.push('--img-text-shadow:none;--img-text-shadow-soft:none;--img-text-glow:transparent;');
        cssParts.push('--img-chrome-text:#FFF;--img-chrome-text-secondary:rgba(255,255,255,0.75);--img-chrome-text-muted:rgba(255,255,255,0.5);');
        cssParts.push('--img-border:rgba(255,255,255,0.2);--img-shadow:0 4px 20px rgba(0,0,0,0.3);');
        cssParts.push('--img-surface:rgba(255,255,255,0.80);--img-surface-hover:rgba(255,255,255,0.88);');
        cssParts.push('}');
        root.classList.add('boot-img-ui-light');
      }
    } catch (e) {}
  }

  // --- 问候模式字号 ---
  let greetingMode = get('moonfog_greeting_mode') || 'greeting';
  if (greetingMode !== 'clock' && greetingMode !== 'date' && greetingMode !== 'quote' && greetingMode !== 'greeting' && greetingMode !== 'custom') greetingMode = 'greeting';
  if (greetingMode === 'quote' || greetingMode === 'custom') {
    cssParts.push('.greeting-title{font-family:var(--font-display)!important;font-weight:var(--boot-greeting-weight,600)!important;font-size:calc(clamp(1.35rem,3.2vw,1.9rem)*var(--size-greeting,1))!important;letter-spacing:0.01em!important;line-height:1.4!important;}');
  } else if (greetingMode === 'clock') {
    cssParts.push('.greeting-title{font-family:var(--font-display)!important;font-weight:var(--boot-greeting-weight,700)!important;font-size:calc(clamp(2.25rem,6vw,3.25rem)*var(--size-greeting,1))!important;letter-spacing:0.04em!important;font-variant-numeric:tabular-nums;}');
  } else {
    cssParts.push('.greeting-title{font-family:var(--font-display)!important;font-weight:var(--boot-greeting-weight,700)!important;font-size:calc(clamp(1.75rem,4vw,2.25rem)*var(--size-greeting,1))!important;}');
  }

  // 图片背景：首帧压暗遮罩（与 applyImagePalette 一致，用默认 40% 压暗）
  if (bgUrl && (bgMode === 'local' || bgMode === 'bing')) {
    cssParts.push('html.boot-has-image .page-bg-overlay{background:rgba(0,0,0,0.4)!important;}');
  }

  cssParts.push('html,body{background-color:var(--bg-warm);color:var(--text-primary);}');

  const style = document.createElement('style');
  style.id = 'moonfog-boot-theme';
  style.textContent = cssParts.join('');
  if (document.head.firstChild) { document.head.insertBefore(style, document.head.firstChild); }
  else { document.head.appendChild(style); }

  try {
    const themeMeta = document.getElementById('themeColorMeta');
    if (themeMeta) themeMeta.setAttribute('content', themeVars['--bg-warm']);
  } catch (e) {}

  // --- 导出供后续脚本使用 ---
  const bootConfig = {
    tone: tone, mode: mode, modePref: modePref,
    fontKey: fontKey, weight: weight,
    bgMode: bgMode, bgUrl: bgUrl, blur: blur,
    greetingMode: greetingMode
  };
  if (window.__MOONFOG_STATE__) {
    window.__MOONFOG_STATE__.setBootConfig(bootConfig);
  } else {
    window.__MOONFOG_BOOT__ = bootConfig;
  }

  // --- 初始化 ThemeManager：统一 surface tokens ---
  if (window.__MOONFOG_THEME_MANAGER__) {
    window.__MOONFOG_THEME_MANAGER__.apply({
      tone: tone,
      mode: mode,
      modePref: modePref,
      panelBlur: parseInt(blur, 10) || 10,
      searchBlur: parseInt(get('moonfog_search_blur'), 10) || 40,
      bgBlur: parseInt(blur, 10) || 20,
      perfMode: perfMode || 'full',
      imageBg: !!(bgUrl && (bgMode === 'local' || bgMode === 'bing')),
      grainActive: bgMode === 'grain'
    });
  }
})();
