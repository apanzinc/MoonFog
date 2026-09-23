/**
 * 背景：纯色/ 流光渐变 / 本地图片 / 必应每日一图 * 图片模式：莫奈式取色驱动 UI，可调背景模糊 */

/**
 * 规范化背景模式 */
function normalizeBgMode(mode) {
  return mode === 'local' || mode === 'bing' || mode === 'grain' || mode === 'solid'
    ? mode
    : DEFAULT_BG_MODE;
}

/**
 * 防呆：始终从 localStorage 获取真实 bgMode，全局缓存仅作为 fallback。
 * 消除异步链路中 currentBgMode 过期导致 UI 错乱的问题。
 */
function getEffectiveBgMode() {
  try {
    const stored = localStorage.getItem(BG_MODE_KEY);
    return normalizeBgMode(stored || currentBgMode);
  } catch (_) {
    return normalizeBgMode(currentBgMode);
  }
}

/**
 * 切换独立的Grain Gradient 背景层。 */
function setGrainBackgroundActive(active) {
  const enabled = Boolean(active);
  const root = document.documentElement;
  const pageBg = document.getElementById('pageBg');
  root.classList.toggle('boot-has-grain', enabled);
  if (document.body) document.body.classList.toggle('has-grain-bg', enabled);
  if (pageBg) {
    pageBg.classList.toggle('has-grain', enabled);
    if (enabled) pageBg.classList.add('is-ready');
  }
  if (window.GrainBackground && typeof window.GrainBackground.setActive === 'function') {
    window.GrainBackground.setActive(enabled);
  }
}

/**
 * 规范化模糊：0…0
 */
function normalizeBgBlur(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BG_BLUR;
  return Math.min(40, Math.max(0, Math.round(n)));
}

/**
 * 背景中性遮罩-50……50
 * 负：偏黑（：无色纯模糊；正：偏白） */
function normalizeBgWash(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return typeof DEFAULT_BG_WASH === 'number' ? DEFAULT_BG_WASH : 0;
  }
  return Math.min(50, Math.max(-50, Math.round(n)));
}

/**
 * 中性遮置CSS：黑/白雾，不带取色色相 */
function resolveNeutralWashCss(wash) {
  const v = normalizeBgWash(wash);
  if (v === 0) return 'transparent';
  // 最大约 0.72，滑块两端压暗提亮更明是
  const a = Math.min(0.72, Math.abs(v) / 50 * 0.72);
  if (v < 0) return `rgba(0, 0, 0, ${a.toFixed(3)})`;
  return `rgba(255, 255, 255, ${a.toFixed(3)})`;
}

/**
 * 应用中性遮罩：始终由用户滑块驱动，不叠加取色色相雾
 */
function applyBgWash(value, options) {
  const silent = options && options.silent;
  currentBgWash = normalizeBgWash(value);
  if (!silent) {
    try {
      localStorage.setItem(
        typeof BG_WASH_KEY === 'string' ? BG_WASH_KEY : 'moonfog_bg_wash',
        String(currentBgWash)
      );
    } catch (_) {}
  }
  const css = resolveNeutralWashCss(currentBgWash);
  const root = document.documentElement;
  root.style.setProperty('--bg-neutral-wash', css);
  root.style.setProperty('--img-wash', css);
  // 直接内overlay（important 压过热补丁），保证滑块实时可触
  const overlay = document.getElementById('pageBgOverlay');
  if (overlay) {
    const activeMode = typeof isImageBackgroundActive === 'function' && isImageBackgroundActive();
    if (activeMode) overlay.style.setProperty('background', css, 'important');
    else overlay.style.removeProperty('background');
  }
  updateBgWashUI();
  return currentBgWash;
}

function updateBgWashAvailability(isImageMode) {
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  // 始终可调偏好；限制档仅影响实际渲染
  const enabled = true;
  const slider = document.getElementById('bgWashSlider');
  const tip = document.getElementById('bgWashTip');
  const item = document.getElementById('bgWashSetting');
  if (slider) slider.disabled = !enabled;
  if (item) item.classList.toggle('is-disabled', !enabled);
  if (tip) {
    tip.textContent = isImageMode ? '图片/流光背景生效' : '切换到图片或流光背景后生效';
  }
}

function updateBgWashUI() {
  const slider = document.getElementById('bgWashSlider');
  const label = document.getElementById('bgWashValue');
  if (slider && String(slider.value) !== String(currentBgWash)) {
    slider.value = String(currentBgWash);
  }
  if (label) {
    if (currentBgWash === 0) label.textContent = '无色';
    else if (currentBgWash < 0) label.textContent = `偏黑 ${Math.abs(currentBgWash)}`;
    else label.textContent = `偏白 ${currentBgWash}`;
  }
  if (typeof isImageBackgroundActive === 'function') {
    updateBgWashAvailability(isImageBackgroundActive());
  }
}

function normalizeSurfaceBlur(value, fallback) {
  const n = Number(value);
  const fb = Number.isFinite(Number(fallback)) ? Number(fallback) : 16;
  if (!Number.isFinite(n)) return Math.min(40, Math.max(0, Math.round(fb)));
  return Math.min(40, Math.max(0, Math.round(n)));
}

/**
 * 图片背景是否处于生效态 * 以currentBgMode为主；同时兼容boot 首屏 class，避免初始化时序把搜索毛玻璃误判成纯色 */
function isImageBackgroundActive(mode) {
  // 防呆：始终读 localStorage 真实值，不依赖可能过期的全局缓存
  const resolved = typeof mode === 'string' && mode
    ? normalizeBgMode(mode)
    : getEffectiveBgMode();
  if (resolved === 'local' || resolved === 'bing') return true;
  try {
    if (document.body && document.body.classList.contains('has-image-bg')) return true;
    if (document.documentElement && document.documentElement.classList.contains('boot-has-image')) return true;
  } catch (_) {}
  return false;
}

function syncSurfaceBlurAvailability() {
  const isImageMode = isImageBackgroundActive();
  if (typeof updateBgBlurAvailability === 'function') updateBgBlurAvailability(isImageMode);
  if (typeof updateSearchBlurAvailability === 'function') updateSearchBlurAvailability();
  if (typeof updatePanelBlurAvailability === 'function') updatePanelBlurAvailability();
}

let currentSearchBlur = DEFAULT_SEARCH_BLUR;
let currentPanelBlur = DEFAULT_PANEL_BLUR;
/** @type {'full'|'balanced'|'low'} */
let currentPerfMode =
  typeof DEFAULT_PERF_MODE === 'string' ? DEFAULT_PERF_MODE : 'full';
// 兼容旧布尔：true 表示 low
let currentLowPerf = false;

function syncChromeBlur() {
  // 统一“小控件毛玻璃”：取搜索框与设置面板的中间值，避免各处硬编码不一致
const search = resolveVisualSurfaceBlur(
    typeof currentSearchBlur === 'number' ? currentSearchBlur : DEFAULT_SEARCH_BLUR
  );
  const panel = resolveVisualSurfaceBlur(
    typeof currentPanelBlur === 'number' ? currentPanelBlur : DEFAULT_PANEL_BLUR
  );
  const chrome = Math.round((search * 0.45 + panel * 0.55));
  document.documentElement.style.setProperty('--chrome-blur', Math.min(40, Math.max(0, chrome)) + 'px');
}

function resolveVisualSurfaceBlur(value) {
  const base = normalizeSurfaceBlur(value, 0);
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  if (perf === 'low') return 0;
  return base;
}

function applySearchBlur(blurPx, options) {
  const silent = options && options.silent;
  currentSearchBlur = normalizeSurfaceBlur(blurPx, DEFAULT_SEARCH_BLUR);
  if (!silent) {
    try { localStorage.setItem(SEARCH_BLUR_KEY, String(currentSearchBlur)); } catch (_) {}
  }
  const visual = resolveVisualSurfaceBlur(currentSearchBlur);
  document.documentElement.style.setProperty('--search-blur', visual + 'px');
  if (typeof syncChromeBlur === 'function') syncChromeBlur();
  updateSearchBlurUI();
  return currentSearchBlur;
}

function applyPanelBlur(blurPx, options) {
  const silent = options && options.silent;
  currentPanelBlur = normalizeSurfaceBlur(blurPx, DEFAULT_PANEL_BLUR);
  if (!silent) {
    try { localStorage.setItem(PANEL_BLUR_KEY, String(currentPanelBlur)); } catch (_) {}
  }
  const visual = resolveVisualSurfaceBlur(currentPanelBlur);
  document.documentElement.style.setProperty('--panel-blur', visual + 'px');
  if (typeof syncChromeBlur === 'function') syncChromeBlur();
  updatePanelBlurUI();
  return currentPanelBlur;
}

/**
 * 三档性能：full | balanced | low
 * 兼容时API：applyLowPerfMode(true) →low，applyLowPerfMode(false) →full
 */
function applyPerfMode(modeOrBool, options) {
  const silent = options && options.silent;
  let mode;
  if (modeOrBool === true || modeOrBool === 1 || modeOrBool === '1') mode = 'low';
  else if (modeOrBool === false || modeOrBool === 0 || modeOrBool === '0') mode = 'full';
  else mode = typeof normalizePerfMode === 'function' ? normalizePerfMode(modeOrBool) : 'full';

  currentPerfMode = mode;
  currentLowPerf = mode === 'low';

  if (!silent) {
    try {
      localStorage.setItem(
        typeof PERF_MODE_KEY === 'string' ? PERF_MODE_KEY : 'moonfog_perf_mode',
        mode
      );
      // 兼容旧键
      localStorage.setItem(
        typeof LOW_PERF_KEY === 'string' ? LOW_PERF_KEY : 'moonfog_low_perf',
        mode === 'low' ? '1' : '0'
      );
    } catch (_) {}
  }

  const root = document.documentElement;
  root.classList.remove('low-perf', 'perf-balanced', 'perf-low', 'perf-full');
  root.setAttribute('data-perf', mode);
  if (mode === 'low') {
    root.classList.add('low-perf', 'perf-low');
    root.style.setProperty('--bg-scale', '1');
    root.style.setProperty('--bg-blur', '0px');
    // 极致：表面模糊变量也压到 0（CSS 再保险关 backdrop）
    root.style.setProperty('--search-blur', '0px');
    root.style.setProperty('--panel-blur', '0px');
    root.style.setProperty('--chrome-blur', '0px');
  } else if (mode === 'balanced') {
    root.classList.add('perf-balanced');
  } else {
    root.classList.add('perf-full');
  }
  // 按用户偏好重算表面模糊（限制档；resolve 与0（
if (typeof applySearchBlur === 'function') {
    applySearchBlur(currentSearchBlur, { silent: true });
  }
  if (typeof applyPanelBlur === 'function') {
    applyPanelBlur(currentPanelBlur, { silent: true });
  }
  // 立刻把壁纸filter 同步到当前档位（含清掉内联blur）
  if (typeof applyBgBlur === 'function') applyBgBlur(currentBgBlur);

  updateLowPerfUI();
  return mode;
}

/** @deprecated 画applyPerfMode */
function applyLowPerfMode(enabled, options) {
  return applyPerfMode(enabled ? 'low' : 'full', options);
}

function isLowPerfMode() {
  return getPerfMode() === 'low';
}

function isPerfBalanced() {
  return getPerfMode() === 'balanced';
}

function getPerfMode() {
  if (currentPerfMode === 'low' || currentPerfMode === 'balanced' || currentPerfMode === 'full') {
    return currentPerfMode;
  }
  const root = document.documentElement;
  if (root.classList.contains('low-perf') || root.classList.contains('perf-low')) return 'low';
  if (root.classList.contains('perf-balanced')) return 'balanced';
  return 'full';
}

function loadPerfMode() {
  try {
    const raw = localStorage.getItem(
      typeof PERF_MODE_KEY === 'string' ? PERF_MODE_KEY : 'moonfog_perf_mode'
    );
    if (raw != null && raw !== '') {
      return typeof normalizePerfMode === 'function' ? normalizePerfMode(raw) : 'full';
    }
    const legacy = localStorage.getItem(
      typeof LOW_PERF_KEY === 'string' ? LOW_PERF_KEY : 'moonfog_low_perf'
    );
    if (legacy === '1' || legacy === 'true') return 'low';
  } catch (_) {}
  return typeof DEFAULT_PERF_MODE === 'string' ? DEFAULT_PERF_MODE : 'full';
}

function updateSearchBlurAvailability() {
  const isImageMode = isImageBackgroundActive();
  const perf = getPerfMode();
  // 偏好始终可调；纯色限制仅提示实际不生效
  const slider = document.getElementById('searchBlurSlider');
  const tip = document.getElementById('searchBlurTip');
  const item = document.getElementById('searchBlurSetting');
  if (slider) slider.disabled = false;
  if (item) item.classList.remove('is-disabled');
  if (tip) {
    tip.textContent =
      perf === 'low'
        ? '限制档下毛玻璃已关闭'
        : (isImageMode ? '仅图片背景生效' : '切换到图片背景后生效');
  }
}

function updateSearchBlurUI() {
  const slider = document.getElementById('searchBlurSlider');
  const label = document.getElementById('searchBlurValue');
  if (slider && String(slider.value) !== String(currentSearchBlur)) slider.value = String(currentSearchBlur);
  if (label) {
    const perf = getPerfMode();
    if (perf === 'low') label.textContent = currentSearchBlur + 'px（限制关（';
    else label.textContent = currentSearchBlur + 'px';
  }
  if (typeof updateSearchBlurAvailability === 'function') updateSearchBlurAvailability();
}

function updatePanelBlurAvailability() {
  const perf = getPerfMode();
  const slider = document.getElementById('panelBlurSlider');
  const tip = document.getElementById('panelBlurTip');
  const item = document.getElementById('panelBlurSetting');
  if (slider) slider.disabled = false;
  if (item) item.classList.remove('is-disabled');
  if (tip) {
    tip.textContent =
      perf === 'low' ? '限制档下毛玻璃已关闭' : '设置面板毛玻璃';
  }
}

function updatePanelBlurUI() {
  const slider = document.getElementById('panelBlurSlider');
  const label = document.getElementById('panelBlurValue');
  if (slider && String(slider.value) !== String(currentPanelBlur)) slider.value = String(currentPanelBlur);
  if (label) {
    const perf = getPerfMode();
    if (perf === 'low') label.textContent = currentPanelBlur + 'px（限制关（';
    else label.textContent = currentPanelBlur + 'px';
  }
  if (typeof updatePanelBlurAvailability === 'function') updatePanelBlurAvailability();
}

function updateLowPerfUI() {
  const segment = document.getElementById('lowPerfSegment');
  const mode = getPerfMode();
  if (segment) {
    segment.querySelectorAll('[data-perf], [data-low-perf]').forEach((btn) => {
      let key = btn.getAttribute('data-perf');
      if (!key) {
        key = btn.getAttribute('data-low-perf') === '1' ? 'low' : 'full';
      }
      const active = key === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }
  const tip = document.getElementById('perfModeTip');
  if (tip) {
    const tips = {
      full: '全部效果开启',
      balanced: '减弱壁纸模糊，关闭动画',
      low: '关闭模糊、毛玻璃与动画'
    };
    tip.textContent = tips[mode] || tips.full;
  }
  // 数值仍显示用户设定；实际渲染以档位为准
  updateSearchBlurUI();
  updatePanelBlurUI();
  updateBgBlurUI();
}

function initDisplayEffects() {
  let search = DEFAULT_SEARCH_BLUR;
  let panel = DEFAULT_PANEL_BLUR;
  let perf = typeof loadPerfMode === 'function' ? loadPerfMode() : 'full';
  try {
    const s = localStorage.getItem(SEARCH_BLUR_KEY);
    if (s != null) search = s;
    const p = localStorage.getItem(PANEL_BLUR_KEY);
    if (p != null) panel = p;
  } catch (_) {}
  applySearchBlur(search, { silent: true });
  applyPanelBlur(panel, { silent: true });
  applyPerfMode(perf, { silent: true });
  if (typeof syncChromeBlur === 'function') syncChromeBlur();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
}


/**
 * 进场动画结束后再跑重活（取色），避免与壁纸缩放抢主线程 */
function whenBgEnterSettled(cb, waitMs) {
  const ms = Number.isFinite(waitMs) ? waitMs : 920;
  const root = document.documentElement;
  const run = () => {
    try { cb(); } catch (_) {}
  };
  if (root.classList.contains('bg-entered') || root.classList.contains('low-perf') ||
      root.classList.contains('perf-balanced') || root.classList.contains('perf-low')) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 400 });
    } else {
      setTimeout(run, 48);
    }
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 600 });
    } else {
      setTimeout(run, 32);
    }
  };
  window.setTimeout(finish, ms);
  // 已进入也可提前触发完成
  if (root.classList.contains('boot-ready')) {
    window.setTimeout(() => {
      if (root.classList.contains('bg-entered')) finish();
    }, 200);
  }
}

/**
 * 初始化背景 */
async function initBackground() {
  if (typeof initBingCreditPop === 'function') initBingCreditPop();
  if (typeof initDisplayEffects === 'function') initDisplayEffects();
  currentBgMode = normalizeBgMode(localStorage.getItem(BG_MODE_KEY));
  currentBgBlur = normalizeBgBlur(localStorage.getItem(BG_BLUR_KEY) ?? DEFAULT_BG_BLUR);
  try {
    currentBgWash = normalizeBgWash(
      localStorage.getItem(typeof BG_WASH_KEY === 'string' ? BG_WASH_KEY : 'moonfog_bg_wash')
    );
  } catch {
    currentBgWash = typeof DEFAULT_BG_WASH === 'number' ? DEFAULT_BG_WASH : 0;
  }
  try {
    localBgDataUrl = localStorage.getItem(LOCAL_BG_KEY) || '';
  } catch {
    localBgDataUrl = '';
  }
  // 先恢复seed，保证后续明暗切换可重算；boot 已写过色板则尽量复用
  let seedOk = false;
  if (currentBgMode === 'local' || currentBgMode === 'bing') {
    seedOk = !!hydrateImagePaletteSeed();
  }
  // boot 已上 blur 时，避免进场中途再内style.filter 触发重绘卡顿
  const root = document.documentElement;
  const bootAlready =
    root.classList.contains('boot-has-image') && root.classList.contains('boot-bg-decoded');
  if (!bootAlready) {
    applyBgBlur(currentBgBlur);
  } else {
    // 只同步变量，不碰图层 filter
    const visual = resolveVisualBgBlur();
    root.style.setProperty('--bg-blur', `${visual}px`);
    const scale = getPerfMode() === 'low' ? 1 : 1 + Math.min(0.12, visual / 200);
    root.style.setProperty('--bg-scale', String(scale));
  }
  applyBgWash(currentBgWash, { silent: true });
  // seed 已恢复且当前图URL 已知，标认lastPaletteUrl 让后统applyPalette 可短跑
  if (seedOk && lastPalette) {
    try {
      const bootUrl =
        (currentBgMode === 'local' && localBgDataUrl) ||
        (currentBgMode === 'bing' && (
          (currentBingMeta && currentBingMeta.imageUrl) ||
          (readBingCache() && readBingCache().imageUrl)
        )) ||
        '';
      if (bootUrl) lastPaletteUrl = bootUrl;
    } catch (_) {}
  }
  // applyBackgroundMode 内部会延后取色；本seed 时applyPaletteForUrl 会短跑
  await applyBackgroundMode(currentBgMode, { silent: true });
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
}

/**
 * 应用背景模糊（px（ */
function applyBgBlur(blurPx) {
  // 存用户设定值；实际渲染 blur 受性能档位影响
  currentBgBlur = normalizeBgBlur(blurPx);
  localStorage.setItem(BG_BLUR_KEY, String(currentBgBlur));
  const visual = resolveVisualBgBlur();
  document.documentElement.style.setProperty('--bg-blur', `${visual}px`);
  const scale =
    (typeof getPerfMode === 'function' && getPerfMode() === 'low')
      ? 1
      : 1 + Math.min(0.12, visual / 200);
  document.documentElement.style.setProperty('--bg-scale', String(scale));
  if (typeof syncBgFilterAllLayers === 'function') {
    syncBgFilterAllLayers();
  } else {
    const img = document.getElementById('pageBgImage');
    if (typeof ensureBgFilterOnNode === 'function') {
      ensureBgFilterOnNode(img);
    } else if (img) {
      img.style.filter = visual > 0 ? `blur(${visual}px)` : 'none';
      img.style.removeProperty('transform');
    }
  }
  updateBgBlurUI();
}

/**
 * 同步模糊滑块 UI
 */
function updateBgBlurAvailability(isImageMode) {
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  // 偏好始终可拖；实际渲染仍受性能档位 / 是否图片背景约束
  const slider = document.getElementById('bgBlurSlider');
  const tip = document.getElementById('bgBlurTip');
  const item = document.getElementById('bgBlurSetting');
  if (slider) slider.disabled = false;
  if (item) item.classList.remove('is-disabled');
  if (tip) {
    tip.textContent =
      perf === 'low'
        ? '限制档下壁纸不模糊'
        : perf === 'balanced'
          ? (isImageMode ? '部分档下模糊会减弱' : '切换到图片背景后生效')
        : (isImageMode ? '仅图片背景生效' : '切换到图片背景后生效');
  }
  if (typeof updateBgWashAvailability === 'function') updateBgWashAvailability(isImageMode);
}

function updateBgBlurUI() {
  const slider = document.getElementById('bgBlurSlider');
  const label = document.getElementById('bgBlurValue');
  if (slider && String(slider.value) !== String(currentBgBlur)) {
    slider.value = String(currentBgBlur);
  }
  if (label) {
    const visual = typeof resolveVisualBgBlur === 'function'
      ? resolveVisualBgBlur()
      : currentBgBlur;
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
    if (perf === 'low') label.textContent = `${currentBgBlur}px（限制关）`;
    else if (perf === 'balanced' && visual !== currentBgBlur) {
      label.textContent = `${currentBgBlur}px →${visual}px`;
    } else {
      label.textContent = `${currentBgBlur}px`;
    }
  }
  if (typeof updateBgWashUI === 'function') updateBgWashUI();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
}

/**
 * 更新设置面板中背景相关控件 */
function updateBgSettingsUI() {
  const localActions = document.getElementById('bgLocalActions');
  const grainGroup = document.getElementById('bgGrainGroup');
  const bingGroup = document.getElementById('bgBingGroup');
  const bingMeta = document.getElementById('bgBingMeta');
  const imageOptions = document.getElementById('bgImageOptions');
  const clearBtn = document.getElementById('bgLocalClear');
  const bingTitle = document.getElementById('bgBingTitle');
  const bingCopyright = document.getElementById('bgBingCopyright');
  const bingPreview = document.getElementById('bgBingPreview');
  const bingPreviewFallback = document.getElementById('bgBingPreviewFallback');
  const bingLink = document.getElementById('bgBingLink');
  // 防呆：直接从 localStorage 读真实值，不依赖可能过期的全局缓存
  const effectiveMode = getEffectiveBgMode();
  const isBing = effectiveMode === 'bing';
  const isLocal = effectiveMode === 'local';
  const isGrain = effectiveMode === 'grain';
  const isSolid = effectiveMode === 'solid';

  // 条件启用：本地图 / 模糊仅图片；必应信息单独区域；色调仅纯色（进出动画镜像）
  if (typeof setSettingsReveal === 'function') {
    setSettingsReveal(localActions, isLocal);
    setSettingsReveal(grainGroup, isGrain);
    if (imageOptions) setSettingsReveal(imageOptions, false);
    // 背景模糊控件已统一到「显示与效果」；这里同步搜索/背景模糊可用态
    if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
    setSettingsReveal(bingGroup, isBing);
    if (clearBtn) clearBtn.hidden = !(isLocal && !!localBgDataUrl);
  } else {
    if (localActions) localActions.hidden = !isLocal;
    if (grainGroup) grainGroup.hidden = !isGrain;
    if (imageOptions) imageOptions.hidden = true;
    if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
    if (clearBtn) clearBtn.hidden = !(isLocal && !!localBgDataUrl);
    if (bingGroup) bingGroup.hidden = !isBing;
  }
  if (isGrain && typeof syncGrainSettingsUI === 'function') {
    syncGrainSettingsUI();
  }
  if (bingMeta) bingMeta.hidden = false;

  // 界面明暗始终在最上方；色调仅纯色背景可用
  const toneGroup = document.getElementById('toneGroup');
  const themeGrid = document.getElementById('themeGrid');
  if (typeof setSettingsReveal === 'function') {
    setSettingsReveal(toneGroup, isSolid);
    // theme pills live inside tone group; keep in sync without double-jump if group handles it
    if (themeGrid && themeGrid.closest('#toneGroup')) {
      // no-op: group animation covers it
    } else {
      setSettingsReveal(themeGrid, isSolid);
    }
  } else {
    if (toneGroup) toneGroup.hidden = !isSolid;
    if (themeGrid) themeGrid.hidden = !isSolid;
  }

  // 必应卡片内容
  if (isBing) {
    const meta = currentBingMeta || {};
    const title = meta.title || meta.copyright || '今日壁纸';
    const copyright = meta.copyright && meta.title ? meta.copyright : (meta.copyright || '');
    const imageUrl = meta.imageUrl || meta.url || '';
    const link = meta.copyrightlink || meta.link || 'https://www.bing.com/';

    if (bingTitle) bingTitle.textContent = title;
    if (bingCopyright) {
      bingCopyright.textContent = copyright;
      bingCopyright.hidden = !copyright;
    }
    if (bingLink) {
      bingLink.href = link;
      bingLink.hidden = false;
    }
    if (typeof setBingHeroPreview === 'function') {
      // 常规同步：同图不动画；换图时画shuffle 显式 animate
      setBingHeroPreview(imageUrl, { animate: false });
    } else if (bingPreview) {
      if (imageUrl) {
        if (bingPreview.getAttribute('src') !== imageUrl) bingPreview.src = imageUrl;
        bingPreview.hidden = false;
        if (bingPreviewFallback) bingPreviewFallback.hidden = true;
        if (typeof setBingHeroPhotoState === 'function') setBingHeroPhotoState(true);
      } else {
        bingPreview.removeAttribute('src');
        bingPreview.hidden = true;
        if (bingPreviewFallback) bingPreviewFallback.hidden = false;
        if (typeof setBingHeroPhotoState === 'function') setBingHeroPhotoState(false);
      }
    }
  }

  updateBgBlurUI();
}

/** 设置页必应预览交叉淡免*/
let bingPreviewSwapToken = 0;

function setBingHeroPreview(imageUrl, options = {}) {
  const hero = document.querySelector('#bgBingMeta .bg-bing-hero');
  const a = document.getElementById('bgBingPreview');
  const b = document.getElementById('bgBingPreviewB');
  const fallback = document.getElementById('bgBingPreviewFallback');
  const layers = [a, b].filter(Boolean);
  if (!layers.length) return Promise.resolve(false);

  if (!imageUrl) {
    layers.forEach((el) => {
      el.removeAttribute('src');
      el.hidden = true;
      el.classList.remove('is-active');
    });
    if (fallback) fallback.hidden = false;
    if (typeof setBingHeroPhotoState === 'function') setBingHeroPhotoState(false);
    if (hero) hero.classList.remove('is-swapping');
    return Promise.resolve(false);
  }

  const active =
    layers.find((el) => el.classList.contains('is-active') && el.getAttribute('src')) ||
    layers.find((el) => el.getAttribute('src')) ||
    null;
  const currentSrc = active ? active.getAttribute('src') || '' : '';
  if (currentSrc === imageUrl) {
    if (active) {
      active.hidden = false;
      active.classList.add('is-active');
    }
    if (fallback) fallback.hidden = true;
    if (typeof setBingHeroPhotoState === 'function') setBingHeroPhotoState(true);
    return Promise.resolve(true);
  }

  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  const animate =
    options.animate !== false && perf === 'full';
  const next = active ? (layers.find((el) => el !== active) || layers[0]) : layers[0];
  const token = ++bingPreviewSwapToken;

  return new Promise((resolve) => {
    const finish = (ok) => {
      if (token !== bingPreviewSwapToken) {
        resolve(false);
        return;
      }
      if (!ok) {
        resolve(false);
        return;
      }
      next.hidden = false;
      if (hero && animate) hero.classList.add('is-swapping');

      requestAnimationFrame(() => {
        if (token !== bingPreviewSwapToken) {
          resolve(false);
          return;
        }
        requestAnimationFrame(() => {
          if (token !== bingPreviewSwapToken) {
            resolve(false);
            return;
          }
          next.classList.add('is-active');
          layers.forEach((el) => {
            if (el === next) return;
            el.classList.remove('is-active');
            window.setTimeout(() => {
              if (el.classList.contains('is-active')) return;
              if (token !== bingPreviewSwapToken) return;
              el.removeAttribute('src');
              el.hidden = true;
            }, 780);
          });
          if (fallback) fallback.hidden = true;
          if (typeof setBingHeroPhotoState === 'function') setBingHeroPhotoState(true);
          window.setTimeout(() => {
            if (hero) hero.classList.remove('is-swapping');
          }, 320);
          resolve(true);
        });
      });
    };

    next.classList.remove('is-active');
    next.hidden = true;
    next.onload = () => finish(true);
    next.onerror = () => finish(false);
    next.src = imageUrl;
    if (next.complete && next.naturalWidth > 0) {
      finish(true);
    }
  });
}

function resolveVisualBgBlur() {
  const base = normalizeBgBlur(currentBgBlur);
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  if (perf === 'low') return 0;
  // 均衡：壁纸模糊减半，最复6px，仍有一点景深
  if (perf === 'balanced') return Math.min(6, Math.round(base * 0.45));
  return base;
}

function ensureBgFilterOnNode(img) {
  if (!img) return;
  const blur = resolveVisualBgBlur();
  const scale =
    (typeof getPerfMode === 'function' && getPerfMode() === 'low')
      ? 1
      : 1 + Math.min(0.12, blur / 200);
  // 极致：必须清掉内联filter，否则CSS filter:none 盖不过style=""
  if (blur <= 0) {
    img.style.filter = 'none';
  } else {
    img.style.filter = `blur(${blur}px)`;
  }
  img.style.removeProperty('transform');
  if (img.style.transition === 'none' || img.style.transition === 'none 0s ease 0s') {
    img.style.removeProperty('transition');
  }
  document.documentElement.style.setProperty('--bg-scale', String(scale));
  document.documentElement.style.setProperty('--bg-blur', `${blur}px`);
}

/** 背景换图序号：过期异步回调丢式*/
let bgImageSwapToken = 0;
/** 当前展示的背景URL */
let currentBgImageUrl = '';

/**
 * 预加载图片，解码后再显示
 */
function preloadBackgroundUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const probe = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(!!ok);
    };
    probe.onload = () => {
      if (probe.decode) {
        probe.decode().then(() => finish(true)).catch(() => finish(true));
      } else {
        finish(true);
      }
    };
    probe.onerror = () => finish(false);
    probe.src = url;
    if (probe.complete && probe.naturalWidth > 0) {
      if (probe.decode) {
        probe.decode().then(() => finish(true)).catch(() => finish(true));
      } else {
        requestAnimationFrame(() => requestAnimationFrame(() => finish(true)));
      }
    }
  });
}

function getBgImageLayers() {
  const a = document.getElementById('pageBgImage');
  const b = document.getElementById('pageBgImageB');
  return [a, b].filter(Boolean);
}

function readLayerUrl(el) {
  if (!el) return '';
  const raw = el.style.backgroundImage || '';
  if (!raw || raw === 'none') return '';
  return raw.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
}

function syncBgFilterAllLayers() {
  getBgImageLayers().forEach((el) => {
    if (typeof ensureBgFilterOnNode === 'function') ensureBgFilterOnNode(el);
  });
}

/**
 * 设置图片背景层（双层交叉淡入（ * 正确时序（ * 1) 有旧图：旧图保持显示 →新图解码 →交叉淡入
 * 2) 无旧图：解码后淡免 * 3) 同图：只同步模糊
 * @returns {Promise<boolean>} 新图是否已开始展示（可安全取色）
 */
function setPageBackgroundImage(url, active = !!url) {
  const pageBg = document.getElementById('pageBg');
  const layers = getBgImageLayers();
  const primary = layers[0] || document.getElementById('pageBgImage');
  const show = !!(active && url);
  const token = ++bgImageSwapToken;

  // 用视触blur（含性能档位），避免 full/low 不一致
  const visual = typeof resolveVisualBgBlur === 'function'
    ? resolveVisualBgBlur()
    : normalizeBgBlur(currentBgBlur);
  document.documentElement.style.setProperty('--bg-blur', `${visual}px`);
  const scale =
    (typeof getPerfMode === 'function' && getPerfMode() === 'low')
      ? 1
      : 1 + Math.min(0.12, visual / 200);
  document.documentElement.style.setProperty('--bg-scale', String(scale));
  syncBgFilterAllLayers();

  if (!show) {
    currentBgImageUrl = '';
    layers.forEach((el) => {
      el.style.backgroundImage = '';
      el.style.opacity = '';
      el.classList.remove('is-ready', 'is-active');
    });
    if (pageBg) pageBg.classList.remove('has-image', 'is-ready');
    document.body.classList.remove('has-image-bg');
    document.documentElement.classList.remove('boot-has-image', 'boot-bg-decoded');
    if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
    return Promise.resolve(false);
  }

  document.body.classList.add('has-image-bg');
  document.documentElement.classList.add('boot-has-image');
  if (pageBg) pageBg.classList.add('has-image');
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();

  const activeLayerNow =
    layers.find((el) => el.classList.contains('is-active') && readLayerUrl(el)) ||
    layers.find((el) => readLayerUrl(el)) ||
    null;
  const shownUrl = currentBgImageUrl || (activeLayerNow ? readLayerUrl(activeLayerNow) : '');

  // 换图前清接boot 内联，恢复CSS 过渡
  layers.forEach((el) => {
    el.style.removeProperty('transition');
    el.style.removeProperty('transform');
    if (!el.classList.contains('is-active')) {
      el.style.removeProperty('opacity');
    }
  });

  // 同一张图：不二次动画
  if (shownUrl === url) {
    currentBgImageUrl = url;
    const activeLayer = activeLayerNow || primary;
    if (activeLayer) {
      ensureBgFilterOnNode(activeLayer);
      activeLayer.classList.add('is-ready', 'is-active');
      activeLayer.style.removeProperty('opacity');
    }
    if (pageBg) pageBg.classList.add('is-ready');
    document.documentElement.classList.add('boot-bg-decoded');
    document.documentElement.classList.add('bg-swap-ready');
    return Promise.resolve(true);
  }

  const activeLayer = activeLayerNow;
  const hasVisibleOld = !!(
    activeLayer &&
    readLayerUrl(activeLayer) &&
    (activeLayer.classList.contains('is-active') || Number(getComputedStyle(activeLayer).opacity) > 0.05)
  );

  let nextLayer = primary;
  if (hasVisibleOld && layers.length > 1) {
    nextLayer = layers.find((el) => el !== activeLayer) || primary;
  }

  // 均衡/极致：硬切，不交叉淡免
  const perf = typeof getPerfMode === 'function' ? getPerfMode() : 'full';
  const hardCut = perf === 'low' || perf === 'balanced';

  // 先解码，再挂 background-image，避免未解码就开动画卡一帧
  nextLayer.classList.remove('is-ready', 'is-active');
  if (!hardCut) {
    nextLayer.style.opacity = '0';
    nextLayer.style.removeProperty('transition');
    nextLayer.style.removeProperty('transform');
    document.documentElement.classList.add('bg-swap-ready');
  }

  return preloadBackgroundUrl(url).then((ok) => {
    if (token !== bgImageSwapToken) return false;
    if (currentBgMode !== 'local' && currentBgMode !== 'bing') return false;
    if (!ok) return false;

    ensureBgFilterOnNode(nextLayer);
    nextLayer.style.backgroundImage = `url("${url}")`;
    nextLayer.style.removeProperty('transform');
    nextLayer.style.removeProperty('transition');
    currentBgImageUrl = url;

    if (hardCut) {
      layers.forEach((el) => {
        if (el === nextLayer) {
          el.style.removeProperty('opacity');
          el.classList.add('is-ready', 'is-active');
        } else {
          el.classList.remove('is-active', 'is-ready');
          el.style.backgroundImage = '';
          el.style.removeProperty('opacity');
        }
      });
      if (pageBg) pageBg.classList.add('is-ready');
      document.documentElement.classList.add('boot-bg-decoded', 'bg-swap-ready', 'bg-entered');
      return true;
    }

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (token !== bgImageSwapToken) {
          resolve(false);
          return;
        }
        requestAnimationFrame(() => {
          if (token !== bgImageSwapToken) {
            resolve(false);
            return;
          }

          nextLayer.style.removeProperty('opacity');
          nextLayer.classList.add('is-ready', 'is-active');
          document.documentElement.classList.add('bg-entered');

          layers.forEach((el) => {
            if (el === nextLayer) return;
            el.classList.remove('is-active');
            el.style.removeProperty('opacity');
            const cleanup = () => {
              if (el.classList.contains('is-active')) return;
              if (token !== bgImageSwapToken) return;
              el.style.backgroundImage = '';
              el.classList.remove('is-ready');
              el.style.removeProperty('opacity');
            };
            const onEnd = (e) => {
              if (e.propertyName && e.propertyName !== 'opacity') return;
              el.removeEventListener('transitionend', onEnd);
              cleanup();
            };
            el.addEventListener('transitionend', onEnd);
            window.setTimeout(cleanup, 900);
          });

          if (pageBg) pageBg.classList.add('is-ready');
          document.documentElement.classList.add('boot-bg-decoded', 'bg-swap-ready');
          resolve(true);
        });
      });
    });
  });
}

/**
 * 展示/隐藏必应署名
 */
/**
 * 把必底title / copyright 整理成展示文桰 * copyright 常见：地炉标题 (© 作
 */
/**
 * 必应沉浸卡：有图时打 has-photo，保证白字叠在图上（不靠 :has 选择器）
 */
function setBingHeroPhotoState(hasPhoto) {
  const hero = document.querySelector('#bgBingMeta .bg-bing-hero');
  if (!hero) return;
  hero.classList.toggle('has-photo', !!hasPhoto);
}
function formatBingDisplay(meta) {
  const rawTitle = String((meta && meta.title) || '').trim();
  const rawCopy = String((meta && meta.copyright) || '').trim();
  let title = rawTitle;
  let credit = rawCopy;

  if (!title && rawCopy) {
    // 括号前作为标题
    title = rawCopy.split('(')[0].trim() || '必应每日一图';
  }
  if (rawCopy) {
    const m = rawCopy.match(/\(([^)]+)\)\s*$/);
    if (m) credit = m[1].trim();
    else if (title && rawCopy.startsWith(title)) {
      credit = rawCopy.slice(title.length).replace(/^[·\-\s]+/, '').trim();
    }
  }
  if (credit && title && credit === title) credit = '';
  return {
    title: title || '必应每日一图',
    credit: credit || ''
  };
}
function setBingCredit(text, meta) {
  const wrap = document.getElementById('bingCreditWrap');
  const credit = document.getElementById('bingCredit');
  const creditText = document.getElementById('bingCreditText');
  if (!credit || !creditText) return;

  if (text) {
    creditText.textContent = text;
    credit.hidden = false;
    if (wrap) wrap.hidden = false;
  } else {
    creditText.textContent = '';
    credit.hidden = true;
    if (wrap) {
      wrap.hidden = true;
      wrap.classList.remove('is-open');
    }
    closeBingCreditPop(true);
  }

  syncBingCreditPop(meta || currentBingMeta || null);
}

/**
 * 同步左下角弹出卡片内容（与设置页必应卡同一套数据）
 */
function syncBingCreditPop(meta) {
  const preview = document.getElementById('bingCreditPreview');
  const titleEl = document.getElementById('bingCreditTitle');
  const copyEl = document.getElementById('bingCreditCopyright');
  const linkEl = document.getElementById('bingCreditLink');
  const hero = document.getElementById('bingCreditHero');
  if (!preview && !titleEl) return;

  if (!meta) {
    if (titleEl) titleEl.textContent = '必应每日一图';
    if (copyEl) {
      copyEl.textContent = '';
      copyEl.hidden = true;
    }
    if (preview) {
      preview.removeAttribute('src');
      preview.hidden = true;
      preview.classList.remove('is-active');
    }
    if (hero) hero.classList.remove('has-photo');
    if (linkEl) linkEl.href = 'https://www.bing.com/';
    return;
  }

  const parsed = typeof formatBingDisplay === 'function'
    ? formatBingDisplay(meta)
    : { title: meta.title || '必应每日一图', credit: meta.copyright || '' };

  if (titleEl) titleEl.textContent = parsed.title;
  if (copyEl) {
    copyEl.textContent = parsed.credit || '';
    copyEl.hidden = !parsed.credit;
  }
  const imageUrl = meta.imageUrl || meta.url || '';
  if (linkEl) linkEl.href = meta.copyrightlink || imageUrl || 'https://www.bing.com/';

  const hasPhoto = !!imageUrl;
  if (preview) {
    if (hasPhoto) {
      preview.hidden = false;
      // 单层预览也要 is-active，否则CSS 默认 opacity:0 看不见
      preview.classList.add('is-active');
      if (preview.getAttribute('src') !== imageUrl) preview.src = imageUrl;
      preview.alt = parsed.title || '必应每日一图';
    } else {
      preview.removeAttribute('src');
      preview.hidden = true;
      preview.classList.remove('is-active');
    }
  }
  if (hero) hero.classList.toggle('has-photo', hasPhoto);
}

function isBingCreditPopOpen() {
  const wrap = document.getElementById('bingCreditWrap');
  return !!(wrap && wrap.classList.contains('is-open'));
}

function openBingCreditPop() {
  const wrap = document.getElementById('bingCreditWrap');
  const credit = document.getElementById('bingCredit');
  const pop = document.getElementById('bingCreditPop');
  const closeBtn = document.getElementById('bingCreditClose');
  if (!wrap || wrap.hidden || !pop) return;
  wrap.classList.add('is-open');
  pop.hidden = false;
  if (closeBtn) closeBtn.hidden = false;
  if (credit) credit.setAttribute('aria-expanded', 'true');
  syncBingCreditPop(currentBingMeta);
}

function closeBingCreditPop(force) {
  const wrap = document.getElementById('bingCreditWrap');
  const credit = document.getElementById('bingCredit');
  const pop = document.getElementById('bingCreditPop');
  const closeBtn = document.getElementById('bingCreditClose');
  if (!wrap) return;
  wrap.classList.remove('is-open');
  if (credit) credit.setAttribute('aria-expanded', 'false');
  if (closeBtn) closeBtn.hidden = true;
  // 保留 hidden=false 以便 CSS hover 仍可显示；仅无内容时整块 wrap hidden
  if (pop && force) pop.hidden = true;
  else if (pop) pop.hidden = false;
}

function initBingCreditPop() {
  const wrap = document.getElementById('bingCreditWrap');
  const credit = document.getElementById('bingCredit');
  const pop = document.getElementById('bingCreditPop');
  const closeBtn = document.getElementById('bingCreditClose');
  if (!wrap || !credit || !pop || credit.dataset.bound) return;
  credit.dataset.bound = '1';

  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  // 桌面：悬停预览；点击固定打开（显示关闭按钮）
  // 触屏：点击切换
  credit.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBingCreditPopOpen()) closeBingCreditPop();
    else openBingCreditPop();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeBingCreditPop();
      credit.focus();
    });
  }

  if (canHover) {
    wrap.addEventListener('mouseenter', () => {
      pop.hidden = false;
      syncBingCreditPop(currentBingMeta);
    });
  }

  document.addEventListener('mousedown', (e) => {
    if (!isBingCreditPopOpen()) return;
    if (wrap.contains(e.target)) return;
    closeBingCreditPop();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isBingCreditPopOpen()) {
      closeBingCreditPop();
      credit.focus();
    }
  });
}

/**
 * 清除图片取色 CSS 变量，回到主题token
 * 同时清掉快捷标签上的内联对比度样式，避免切回纯色浅色后仍像「灰胶囊。 */
function clearImagePalette() {
  const root = document.documentElement;
  const keys = [
    '--img-text',
    '--img-text-secondary',
    '--img-text-muted',
    '--img-text-glow',
    '--img-text-shadow',
    '--img-text-shadow-soft',
    '--img-text-accent',
    '--img-chrome-text',
    '--img-chrome-text-secondary',
    '--img-chrome-text-muted',
    '--img-surface',
    '--img-surface-hover',
    '--img-chip',
    '--img-border',
    '--img-shadow',
    '--img-credit-bg',
    '--img-credit-text',
    '--img-wash',
    '--bg-neutral-wash',
    '--img-accent',
    '--img-accent-soft',
    '--img-accent-2',
    '--img-focus-ring',
    '--img-seed'
  ];
  keys.forEach((k) => root.style.removeProperty(k));
  lastPaletteUrl = '';
  lastPalette = null;
  lastDominant = null;
  document.body.classList.remove('img-ui-dark', 'img-ui-light', 'img-scene-dark', 'img-scene-light');
  try {
    localStorage.removeItem('moonfog_bg_palette');
  } catch (_) {}
  // 内联 !important 必须显式清掉，否则纯色浅色模式标签仍被锁成图片色
  if (typeof applyShortcutContrastInline === 'function') {
    applyShortcutContrastInline(null);
  }
  const patch = document.getElementById('moonfog-img-contrast');
  if (patch) patch.remove();
  const overlay = document.getElementById('pageBgOverlay');
  if (overlay) overlay.style.removeProperty('background');
  // 同步 ThemeManager：清除图片状态，防止纯色模式下 imageBg 残留为 true
  if (window.__MOONFOG_THEME_MANAGER__) {
    window.__MOONFOG_THEME_MANAGER__.clearImagePalette();
  }
  // 恢复用户模糊色调（纯色模式遮罩透明）
  if (typeof applyBgWash === 'function') {
    applyBgWash(
      typeof currentBgWash === 'number'
        ? currentBgWash
        : (typeof DEFAULT_BG_WASH === 'number' ? DEFAULT_BG_WASH : 0),
      { silent: true }
    );
  }
}

/**
 * RGB →HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * HSL →RGB
 */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hk) * 255),
    b: Math.round(hue2rgb(p, q, hk - 1 / 3) * 255)
  };
}

function rgba(r, g, b, a) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * 当前界面明暗（用户选择（ */
function getUiMode() {
  return document.documentElement.getAttribute('data-mode')
    || localStorage.getItem('moonfog_mode')
    || DEFAULT_MODE;
}

/**
 * 相对亮度（sRGB（…），HSL.L 更贴近人眼对 */
function relativeLuminance(r, g, b) {
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** 两色色相差（0…80（*/
function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 分位数（arr 已排序，p 与0…（ */
function percentileSorted(sorted, p) {
  if (!sorted.length) return 50;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

/**
 * 与CSS background-size:cover + center 一致的取样绘制
 * 旧逻辑 drawImage 硬拉伸成方图，识别的是「变形图」不是屏幕上的壁纸 */
function drawImageAsCover(ctx, img, cw, ch) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(cw / iw, ch / ih);
  const sw = cw / scale;
  const sh = ch / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

/**
 * 取样画布尺寸：贴近视口宽高比（默认16:9（ */
function getPaletteSampleSize() {
  let vw = 16;
  let vh = 9;
  try {
    if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
      vw = window.innerWidth;
      vh = window.innerHeight;
    }
  } catch (_) {}
  const maxW = 96;
  const w = maxW;
  const h = Math.max(40, Math.min(96, Math.round(maxW * (vh / vw))));
  return { w, h };
}

/**
 * Material You seed 打分（量化后选源色）
 * 参考：人口 × 色度，中签tone 优先；近极端明暗降权
 */
function scoreSeedCandidate(color, population) {
  const s = Math.max(0, color.s || 0);
  const l = Math.max(0, color.l || 0);
  // 色度：过灰几乎不seed；过艳略
  const chromaScore = s < 5 ? 0.08 : s < 12 ? 0.4 : s < 65 ? 1 : 0.75;
  // tone 12…8 可用（5…5 最低
  let toneScore = 1;
  if (l < 8 || l > 92) toneScore = 0.05;
  else if (l < 15 || l > 85) toneScore = 0.25;
  else if (l < 22 || l > 78) toneScore = 0.55;
  // 人口：sqrt 缓和，但不像 log 压得过狠
  const popScore = Math.sqrt(Math.max(0.001, population));
  return popScore * chromaScore * toneScore;
}

/**
 * 件bucket 挑source →primary / secondary / tertiary
 * Android：先提源色，再外推主/第三关键色 */
function pickMonetColors(buckets) {
  const scored = buckets
    .map((item) => {
      const r = Math.round(item.r / item.w);
      const g = Math.round(item.g / item.w);
      const b = Math.round(item.b / item.w);
      const hsl = rgbToHsl(r, g, b);
      const score = scoreSeedCandidate(hsl, item.w);
      return { r, g, b, h: hsl.h, s: hsl.s, l: hsl.l, w: item.w, score };
    })
    .sort((a, b) => b.score - a.score);

  // Material 默认 seed（无法提取时（
  const fallback = {
    primary: { r: 103, g: 80, b: 164, h: 256, s: 34, l: 48 },
    secondary: { r: 98, g: 91, b: 113, h: 256, s: 10, l: 40 },
    accent: { r: 125, g: 82, b: 96, h: 340, s: 21, l: 40 }
  };

  if (!scored.length) return fallback;

  const colorful = scored.filter((c) => c.s >= 8);
  const pool = colorful.length ? colorful : scored;
  const primary = pool[0];

  // secondary：与 primary 色相分离的次要色，否则primary+30° 低饱和
  let secondary =
    pool.find((c) => c !== primary && hueDistance(c.h, primary.h) >= 22 && c.s >= 6) ||
    scored.find((c) => c !== primary && hueDistance(c.h, primary.h) >= 16) ||
    null;
  if (!secondary) {
    const h2 = (primary.h + 30) % 360;
    const s2 = Math.min(26, Math.max(8, primary.s * 0.5));
    const l2 = Math.min(56, Math.max(34, primary.l));
    const rgb2 = hslToRgb(h2, s2, l2);
    secondary = { ...rgb2, h: h2, s: s2, l: l2, w: 1, score: 0 };
  }

  // tertiary：更分离；否则primary+60°
  let accent =
    pool.find(
      (c) =>
        c !== primary &&
        c !== secondary &&
        hueDistance(c.h, primary.h) >= 36 &&
        c.s >= Math.max(8, primary.s * 0.35)
    ) || null;
  if (!accent) {
    const h3 = (primary.h + 60) % 360;
    const s3 = Math.min(40, Math.max(12, primary.s * 0.65 + 4));
    const l3 = Math.min(54, Math.max(36, primary.l));
    const rgb3 = hslToRgb(h3, s3, l3);
    accent = { ...rgb3, h: h3, s: s3, l: l3, w: 1, score: 0 };
  }

  return { primary, secondary, accent };
}

/**
 * 问候主文案國cover 视口上的 ROI（与布局大致一致）
 * content: 垂直居中 + 左对齐；标题在中部偏上左 */
function getGreetingTextRoi(sw, sh) {
  return {
    x0: Math.floor(sw * 0.06),
    x1: Math.floor(sw * 0.62),
    y0: Math.floor(sh * 0.34),
    y1: Math.floor(sh * 0.52)
  };
}

/**
 * 简单盒模糊：模拟CSS blur 后文字底下的「平均底色。 * radius 为像素半径（取样画布坐标（ */
function boxBlurLuma(luma, w, h, radius) {
  if (radius <= 0) return luma;
  const r = Math.min(radius, 8);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  // 水平
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        sum += luma[y * w + xx];
        n++;
      }
      tmp[y * w + x] = sum / n;
    }
  }
  // 垂直
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        sum += tmp[yy * w + x];
        n++;
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/**
 * 件cover 取样图判断文字区明暗
 *
 * 关键点（旧逻辑）：
 * 1. 整图硬拉成方图≈cover 实际显示
 * 2. WCAG 纯黑/白平衡点纸L=0.18，中暗壁纸会错误选黑存 * 3. 中位数在半亮半暗图上会偏向某一 *
 * 正确做法（ * - 國cover 视口上取问倝ROI
 * - 用模糊后的平均相对亮度（贴近肉眼 + CSS blur（ * - 感知阈值：L < 0.45 →深场景白字；L > 0.52 →浅场景黑字；中间偏深
 */
function detectScenePolarity(data, sw, sh) {
  const { x0, x1, y0, y1 } = getGreetingTextRoi(sw, sh);
  const luma = new Float32Array(sw * sh);
  for (let i = 0, p = 0; p < sw * sh; p++, i += 4) {
    if (data[i + 3] < 128) {
      luma[p] = 0.5;
      continue;
    }
    luma[p] = relativeLuminance(data[i], data[i + 1], data[i + 2]);
  }

  // 取样分辨率下 blur≈px 对应页面 12px 模糊的大致效果
  const blurred = boxBlurLuma(luma, sw, sh, 2);

  // 模拟 rgba(0,0,0,0.4) 遮罩效果，让检测结果与实际显示一致
  const OVERLAY_FACTOR = 0.6; // 1 - 0.4

  let sum = 0;
  let n = 0;
  let darkVotes = 0;
  let lightVotes = 0;
  const samples = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const L = blurred[y * sw + x] * OVERLAY_FACTOR;
      sum += L;
      n++;
      samples.push(L);
      // 感知：偏暗像素投白字
      if (L < 0.45) darkVotes++;
      else if (L > 0.52) lightVotes++;
    }
  }

  // ROI 异常时回退全图
  if (n < 8) {
    sum = 0;
    n = 0;
    darkVotes = 0;
    lightVotes = 0;
    samples.length = 0;
    for (let p = 0; p < sw * sh; p++) {
      const L = blurred[p] * OVERLAY_FACTOR;
      sum += L;
      n++;
      samples.push(L);
      if (L < 0.45) darkVotes++;
      else if (L > 0.52) lightVotes++;
    }
  }

  const meanL = n ? sum / n : 0.5;
  samples.sort((a, b) => a - b);
  const medL = percentileSorted(samples.map((v) => v * 100), 0.5) / 100;
  // 平均与中位混合，抗极端高免
  const sceneL01 = meanL * 0.65 + medL * 0.35;
  const sceneL = sceneL01 * 100;

  let sceneDark;
  if (darkVotes > lightVotes * 1.15) sceneDark = true;
  else if (lightVotes > darkVotes * 1.15) sceneDark = false;
  else sceneDark = sceneL01 < 0.48;

  return {
    sceneL,
    sceneDark,
    sceneMeta: {
      meanL: Math.round(meanL * 1000) / 1000,
      medL: Math.round(medL * 1000) / 1000,
      darkVotes,
      lightVotes,
      roi: { x0, x1, y0, y1, sw, sh }
    }
  };
}

/**
 * 从图片URL 取样
 * Android Dynamic Color 流程（ * 1) cover 视口上量区→源色 / 主辅第三色 * 2) 问候区感知亮度 →裸露文字黙 * 3) seed + 用户浅深 →tonal 角色色 */
async function extractPaletteFromImage(url, mode) {
  if (!url) return null;
  const uiMode = mode || getUiMode();
  const { w: sw, h: sh } = getPaletteSampleSize();

  try {
    const img = await loadImageForPalette(url);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // 关键：必页cover，禁歉stretch
    drawImageAsCover(ctx, img, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);

    const buckets = new Map();
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        if (data[i + 3] < 200) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const hsl = rgbToHsl(r, g, b);
        // seed 量化：丢掉近白近黙
        if (hsl.l < 5 || hsl.l > 95) continue;
        // 人口为主，色度轻微加权（贴近 Monet quantizer（
        const weight = 1 + Math.min(1.8, hsl.s / 40);
        const qr = r >> 4;
        const qg = g >> 4;
        const qb = b >> 4;
        const key = (qr << 8) | (qg << 4) | qb;
        const prev = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0 };
        prev.r += r * weight;
        prev.g += g * weight;
        prev.b += b * weight;
        prev.w += weight;
        buckets.set(key, prev);
      }
    }

    const polarity = detectScenePolarity(data, sw, sh);

    // Material You: 用 MCU 量化器提取种子色（HCT）
    let seedHct = null;
    let colors;
    if (window.MoonFogColor) {
      try {
        seedHct = window.MoonFogColor.extractSeedFromPixelData(data, sw, sh);
      } catch (err) {
        console.warn('[MoonFog] MCU seed extraction failed, fallback to pickMonetColors:', err);
      }
    }
    if (!seedHct) {
      // fallback: 旧 pickMonetColors
      colors = pickMonetColors([...buckets.values()]);
    }

    lastDominant = {
      url,
      r: colors ? colors.primary.r : (seedHct ? ((seedHct.toInt() >> 16) & 0xff) : 103),
      g: colors ? colors.primary.g : (seedHct ? ((seedHct.toInt() >> 8) & 0xff) : 80),
      b: colors ? colors.primary.b : (seedHct ? (seedHct.toInt() & 0xff) : 164),
      primary: colors ? colors.primary : null,
      secondary: colors ? colors.secondary : null,
      accent: colors ? colors.accent : null,
      seedHct: seedHct || null,
      sceneL: polarity.sceneL,
      sceneDark: polarity.sceneDark,
      sceneMeta: polarity.sceneMeta
    };
    const palette = buildPaletteFromDominant(lastDominant, uiMode);
    console.log('[MoonFog] extractPalette OK, seedHct:', !!seedHct, 'palette keys:', palette ? Object.keys(palette).slice(0,8) : 'null');
    lastPaletteUrl = url;
    lastPalette = palette;
    return palette;
  } catch (err) {
    lastDominant = {
      url,
      r: 103,
      g: 80,
      b: 164,
      primary: { r: 103, g: 80, b: 164, h: 256, s: 34, l: 48 },
      secondary: { r: 98, g: 91, b: 113, h: 256, s: 10, l: 40 },
      accent: { r: 125, g: 82, b: 96, h: 340, s: 21, l: 40 },
      sceneL: 42,
      sceneDark: true
    };
    const fallback = buildPaletteFromDominant(lastDominant, uiMode);
    lastPaletteUrl = url;
    lastPalette = fallback;
    return fallback;
  }
}

/**
 * 加载图片用于取样。 * 远程图优免fetch→blob（扩host_permissions 可绕过CORS taint），
 * 失败再回退 crossOrigin Image。 */
async function loadImageForPalette(url) {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return loadImageElement(url, false);
  }

  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImageElement(objectUrl, false);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  } catch (err) {
    return loadImageElement(url, true);
  }
}

/**
 * 创建 Image 元素
 */
function loadImageElement(url, useCors) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (useCors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

/**
 * 规范区seed 输入（兼容旧 r,g,b 与新 dominant 对象（ */
function ensureColorHsl(color) {
  if (!color) return { r: 120, g: 130, b: 145, ...rgbToHsl(120, 130, 145) };
  if (color.h != null && color.s != null && color.l != null) return color;
  return { ...color, ...rgbToHsl(color.r, color.g, color.b) };
}

function normalizeSeedInput(input, sceneLArg) {
  if (input && typeof input === 'object' && ('primary' in input || 'r' in input)) {
    const primary = ensureColorHsl(
      input.primary || { r: input.r, g: input.g, b: input.b }
    );
    const secondary = ensureColorHsl(input.secondary || primary);
    const accent = ensureColorHsl(input.accent || secondary || primary);
    const out = {
      r: primary.r,
      g: primary.g,
      b: primary.b,
      primary,
      secondary,
      accent,
      sceneL: Number.isFinite(input.sceneL) ? input.sceneL : sceneLArg
    };
    if (typeof input.sceneDark === 'boolean') out.sceneDark = input.sceneDark;
    return out;
  }
  return {
    r: 103, g: 80, b: 164,
    primary: { r: 103, g: 80, b: 164, ...rgbToHsl(103, 80, 164) },
    secondary: { r: 98, g: 91, b: 113, ...rgbToHsl(98, 91, 113) },
    accent: { r: 125, g: 82, b: 96, ...rgbToHsl(125, 82, 96) },
    sceneL: 48,
    sceneDark: true
  };
}

/**
 * Material You / Monet tonal roles（TONAL_SPOT（ * 用seed 色相 + 用户浅深生成accent / neutral / surface
 * 参Android 动态配色：system_accent1/2/3 + neutral 色阶
 */
function buildMonetRoles(seed, userDark) {
  const p = ensureColorHsl(seed.primary || seed);
  const s = ensureColorHsl(seed.secondary || p);
  const a = ensureColorHsl(seed.accent || s);

  const h1 = p.h;
  // secondary / tertiary 國primary 附近微移，保TONAL_SPOT 和谐
  const h2 = ((s.s >= 8 ? s.h : h1 + 18) % 360 + 360) % 360;
  const h3 = ((a.s >= 8 ? a.h : h1 + 48) % 360 + 360) % 360;

  // 色度映射：壁纸色度压缩到可用区间，避免荧免脏灰
  const srcChroma = Math.max(p.s || 0, 8);
  const chroma = Math.min(48, Math.max(16, srcChroma * 0.55 + 12));
  const chromaSoft = Math.min(28, chroma * 0.58);
  const chromaNeutral = Math.min(12, chroma * 0.22 + 4);
  const chromaPop = Math.min(52, chroma * 1.05 + 4);

  const tone = (h, c, t) => hslToRgb(h, c, t);

  if (userDark) {
    return {
      accent1: tone(h1, chromaPop, 80),
      accent1Container: tone(h1, chroma, 30),
      accent2: tone(h2, chromaSoft, 78),
      accent2Container: tone(h2, chromaSoft, 26),
      accent3: tone(h3, chroma, 80),
      neutral1: tone(h1, chromaNeutral, 12),
      neutral2: tone(h1, chromaNeutral + 2, 18),
      surface: tone(h1, chromaNeutral + 1, 14),
      surfaceHigh: tone(h1, chromaNeutral + 2, 20),
      surfaceBright: tone(h1, chromaNeutral + 3, 26),
      onSurface: tone(h1, Math.min(8, chromaNeutral), 92),
      onSurfaceVariant: tone(h1, Math.min(10, chromaNeutral + 1), 78),
      outline: tone(h1, Math.min(14, chromaSoft * 0.5), 48),
      wash: tone(h1, Math.min(22, chromaSoft), 8),
      seedHex: rgbToHex(p.r, p.g, p.b)
    };
  }

  return {
    accent1: tone(h1, chromaPop, 40),
    accent1Container: tone(h1, chromaSoft, 92),
    accent2: tone(h2, chromaSoft, 42),
    accent2Container: tone(h2, Math.min(22, chromaSoft), 94),
    accent3: tone(h3, chroma, 40),
    neutral1: tone(h1, chromaNeutral, 98),
    neutral2: tone(h1, chromaNeutral + 1, 94),
    surface: tone(h1, chromaNeutral + 1, 97),
    surfaceHigh: tone(h1, chromaNeutral + 2, 94),
    surfaceBright: tone(h1, chromaNeutral + 2, 99),
    onSurface: tone(h1, Math.min(14, chromaNeutral + 2), 14),
    onSurfaceVariant: tone(h1, Math.min(12, chromaNeutral + 1), 32),
    outline: tone(h1, Math.min(12, chromaSoft * 0.4), 52),
    wash: tone(h1, Math.min(18, chromaSoft), 96),
    seedHex: rgbToHex(p.r, p.g, p.b)
  };
}

/**
 * 场景是否偏暗 →裸露文字用浅色 * 优先用采样时皠sceneDark；否则用感知阈值（sceneL 与0…00 相对亮度×100（ * 注意：不能用 WCAG 黑白平衡点（≈8），那会把中暗壁纸误判成浅场景 */
function isSceneDarkForText(sceneL, sceneDarkHint) {
  if (typeof sceneDarkHint === 'boolean') return sceneDarkHint;
  const scene = Number.isFinite(sceneL) ? sceneL : 48;
  return scene < 48;
}

/**
 * 由壁纸seed 生成 UI 色板
 * - 裸露文字：跟壁纸对比度（深图白字 / 浅图黑字（ * - 控件表面/字：跟用户浅深mode（不跟壁纸polarity 串）
 * - 色相：来自壁纸seed（TONAL_SPOT（ */
function buildPaletteFromDominant(input, modeOrScene, maybeMode) {
  let seed;
  let userMode = 'light';
  if (input && typeof input === 'object') {
    seed = normalizeSeedInput(input);
    if (typeof input.sceneDark === 'boolean') seed.sceneDark = input.sceneDark;
    userMode = modeOrScene || getUiMode();
  } else {
    seed = normalizeSeedInput({
      r: input,
      g: modeOrScene,
      b: maybeMode,
      sceneL: 48
    });
    userMode = getUiMode();
  }
  if (userMode !== 'dark' && userMode !== 'light') {
    userMode = getUiMode() === 'dark' ? 'dark' : 'light';
  }

  const scene = Number.isFinite(seed.sceneL) ? seed.sceneL : 50;
  const sceneDark = isSceneDarkForText(scene, seed.sceneDark);
  const userDark = userMode === 'dark';
  const midTone = scene >= 38 && scene <= 62;

  // Material You: 有 HCT 种子时走 MCU 配色路径
  if (input && input.seedHct && window.MoonFogColor) {
    try {
      return window.MoonFogColor.buildPaletteNew(
        input.seedHct, userDark, sceneDark, scene
      );
    } catch (err) {
      console.warn('[MoonFog] MCU buildPaletteNew failed, fallback to HSL buildMonetRoles:', err);
    }
  }

  // 职责分离（
  // - 裸露问候字 / 全屏 wash →跟壁纸场景
  // - 搜索桰/ 标签 / 设置面板表面与字色→跟用户浅深（明暗切换必须生效（
  const roles = buildMonetRoles(seed, userDark);

  const washAlpha = sceneDark
    ? (midTone ? 0.34 : 0.28)
    : (midTone ? 0.2 : 0.14);
  const washRgb = sceneDark
    ? { r: 0, g: 0, b: 0 }
    : { r: 255, g: 255, b: 255 };

  const mix = (base, tint, t) => ({
    r: Math.round(base.r * (1 - t) + tint.r * t),
    g: Math.round(base.g * (1 - t) + tint.g * t),
    b: Math.round(base.b * (1 - t) + tint.b * t)
  });

  const seedH =
    seed.primary && seed.primary.h != null
      ? seed.primary.h
      : rgbToHsl(
          (seed.primary && seed.primary.r) || 120,
          (seed.primary && seed.primary.g) || 130,
          (seed.primary && seed.primary.b) || 145
        ).h;

  // 裸露问候字：跟壁纸场景
  const bareText = sceneDark
    ? hslToRgb(seedH, 14, 97)
    : hslToRgb(seedH, 12, 14);
  const bareSecondary = sceneDark
    ? hslToRgb(seedH, 10, 90)
    : hslToRgb(seedH, 10, 28);
  const bareMuted = sceneDark
    ? hslToRgb(seedH, 8, 80)
    : hslToRgb(seedH, 8, 42);

  // 控件存/ 表面：跟用户浅深
  const chromeText = roles.onSurface;
  const chromeSecondary = roles.onSurfaceVariant;
  const chromeMuted = userDark
    ? roles.onSurfaceVariant
    : mix(roles.onSurfaceVariant, roles.outline, 0.35);

  const surface = mix(roles.surface, roles.accent2Container || roles.neutral2, 0.12);
  const surfaceHover = mix(roles.surfaceHigh, roles.accent1Container || roles.neutral2, 0.16);
  const chip = mix(roles.surfaceBright || roles.surfaceHigh, roles.neutral1, userDark ? 0.2 : 0.28);
  const creditBg = mix(roles.neutral1, roles.neutral2, 0.15);

  const surfaceAlpha = userDark ? (midTone ? 0.72 : 0.64) : (midTone ? 0.88 : 0.82);
  const chipAlpha = userDark ? 0.5 : (midTone ? 0.82 : 0.76);
  const borderAlpha = userDark ? 0.36 : 0.22;

  return {
    isDarkUi: userDark,
    sceneDark,
    sceneL: scene,
    themeStyle: 'TONAL_SPOT',
    seedHex: roles.seedHex,
    text: rgba(bareText.r, bareText.g, bareText.b, 0.92),
    textSecondary: rgba(bareSecondary.r, bareSecondary.g, bareSecondary.b, 0.84),
    textMuted: rgba(bareMuted.r, bareMuted.g, bareMuted.b, 0.72),
    textAccent: rgba(roles.accent1.r, roles.accent1.g, roles.accent1.b, 0.92),
    textShadow: 'none',
    textShadowSoft: 'none',
    textGlow: 'transparent',
    chromeText: rgba(chromeText.r, chromeText.g, chromeText.b, 0.96),
    chromeTextSecondary: rgba(chromeSecondary.r, chromeSecondary.g, chromeSecondary.b, 0.88),
    chromeTextMuted: rgba(chromeMuted.r, chromeMuted.g, chromeMuted.b, userDark ? 0.72 : 0.7),
    surface: rgba(surface.r, surface.g, surface.b, surfaceAlpha),
    surfaceHover: rgba(surfaceHover.r, surfaceHover.g, surfaceHover.b, userDark ? 0.78 : 0.94),
    chip: rgba(chip.r, chip.g, chip.b, chipAlpha),
    border: rgba(roles.outline.r, roles.outline.g, roles.outline.b, borderAlpha),
    shadow: userDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
    creditBg: rgba(creditBg.r, creditBg.g, creditBg.b, userDark ? 0.55 : 0.78),
    creditText: rgba(bareText.r, bareText.g, bareText.b, 0.9),
    wash: rgba(washRgb.r, washRgb.g, washRgb.b, washAlpha),
    accent: rgba(roles.accent1.r, roles.accent1.g, roles.accent1.b, 0.95),
    accentSoft: rgba(roles.accent1.r, roles.accent1.g, roles.accent1.b, userDark ? 0.18 : 0.12),
    accent2: rgba(roles.accent2.r, roles.accent2.g, roles.accent2.b, 0.9),
    focusRing: rgba(roles.accent1.r, roles.accent1.g, roles.accent1.b, userDark ? 0.4 : 0.3),
    bgWarm: rgba(surface.r, surface.g, surface.b, userDark ? 0.88 : 0.92),
    cardBg: rgba(surfaceHover.r, surfaceHover.g, surfaceHover.b, userDark ? 0.85 : 0.88)
  };
}

/**
 * 持久化图片UI 取色 + seed，供 boot-config 首帧秒恢复；
 * seed 用于明暗切换时无 lastDominant 也能立刻重算
 */
// v30：控件设置跟用户浅深；问候字跟壁纸场景
const IMAGE_PALETTE_VERSION = 32;

function persistImagePalette(palette, seed) {
  try {
    if (!palette) {
      localStorage.removeItem('moonfog_bg_palette');
      return;
    }
    const s = seed || lastDominant || null;
    localStorage.setItem('moonfog_bg_palette', JSON.stringify({
      v: IMAGE_PALETTE_VERSION,
      url: lastPaletteUrl || getCurrentImageBgUrl() || '',
      themeStyle: palette.themeStyle || 'TONAL_SPOT',
      seedHex: palette.seedHex,
      text: palette.text,
      textSecondary: palette.textSecondary,
      textMuted: palette.textMuted,
      textAccent: palette.textAccent,
      textShadow: 'none',
      textShadowSoft: 'none',
      textGlow: 'transparent',
      chromeText: palette.chromeText,
      chromeTextSecondary: palette.chromeTextSecondary,
      chromeTextMuted: palette.chromeTextMuted,
      surface: palette.surface,
      surfaceHover: palette.surfaceHover,
      chip: palette.chip,
      border: palette.border,
      shadow: palette.shadow,
      creditBg: palette.creditBg,
      creditText: palette.creditText,
      wash: palette.wash,
      accent: palette.accent,
      accentSoft: palette.accentSoft,
      accent2: palette.accent2,
      focusRing: palette.focusRing,
      bgWarm: palette.bgWarm,
      cardBg: palette.cardBg,
      isDarkUi: !!palette.isDarkUi,
      sceneDark: !!palette.sceneDark,
      sceneL: palette.sceneL,
      at: Date.now(),
      // seed：重载后仍可按用户浅/深重算色束
      seed: s
        ? {
            r: s.r,
            g: s.g,
            b: s.b,
            sceneL: s.sceneL,
            sceneDark: typeof s.sceneDark === 'boolean' ? s.sceneDark : !!palette.sceneDark,
            primary: s.primary || null,
            secondary: s.secondary || null,
            accent: s.accent || s.tertiary || null
          }
        : null,
      // MCU seedHct：序列化为 {h, c, t} 供重载后重建 HCT 对象
      seedHct: s && s.seedHct ? { h: s.seedHct.hue, c: s.seedHct.chroma, t: s.seedHct.tone } : null
    }));
  } catch (_) {}
}

/**
 * 从缓存恢复lastDominant / lastPalette，保证图片模式下可按场景亮度重算
 */
function hydrateImagePaletteSeed() {
  try {
    const raw = localStorage.getItem('moonfog_bg_palette');
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (!cached) return false;
    // v11 前的 scene 极态色板算法已换，只恢复 seed 色相；scene 优先用新字段
    if (cached.seed && (Number.isFinite(cached.seed.r) || cached.seed.primary)) {
      const s = cached.seed;
      lastDominant = normalizeSeedInput({
        r: s.r,
        g: s.g,
        b: s.b,
        sceneL: Number.isFinite(s.sceneL) ? s.sceneL : 42,
        sceneDark: typeof s.sceneDark === 'boolean'
          ? s.sceneDark
          : (typeof cached.sceneDark === 'boolean' ? cached.sceneDark : undefined),
        primary: s.primary,
        secondary: s.secondary,
        accent: s.accent || s.tertiary
      });
      // 重建 MCU seedHct（序列化时保存了 {h, c, t}）
      if (cached.seedHct && lastDominant && window.MoonFogColor && window.MoonFogColor.Hct) {
        try {
          lastDominant.seedHct = window.MoonFogColor.Hct.from(cached.seedHct.h, cached.seedHct.c, cached.seedHct.t);
        } catch (_) {}
      }
      if (cached.v < IMAGE_PALETTE_VERSION) {
        // 旧算注sceneL 不可信：去掉 polarity 提示，等重采标        delete lastDominant.sceneDark;
      }
    } else if (cached.seedHex && /^#?[0-9a-fA-F]{6}$/.test(String(cached.seedHex))) {
      const hex = String(cached.seedHex).replace('#', '');
      lastDominant = normalizeSeedInput({
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        sceneL: Number.isFinite(cached.sceneL) ? cached.sceneL : 42,
        sceneDark: typeof cached.sceneDark === 'boolean' ? cached.sceneDark : undefined
      });
      if (cached.v < IMAGE_PALETTE_VERSION) delete lastDominant.sceneDark;
    }
    if (lastDominant) {
      lastPalette = buildPaletteFromDominant(lastDominant, getUiMode());
      if (document.body) applyImagePalette(lastPalette);
    } else if (cached.text && cached.v >= IMAGE_PALETTE_VERSION) {
      lastPalette = cached;
    }
    // 记下缓存对应 url，避免进场后再强则canvas 重采标
    if (cached.url && (lastDominant || lastPalette)) {
      lastPaletteUrl = String(cached.url);
    }
    return !!(lastDominant || lastPalette);
  } catch (_) {
    return false;
  }
}

/**
 * 当前图片背景 URL（本國/ 必应（ */
function getCurrentImageBgUrl() {
  if (currentBgMode === 'local') return localBgDataUrl || '';
  if (currentBgMode === 'bing') {
    if (currentBingMeta && currentBingMeta.imageUrl) return currentBingMeta.imageUrl;
    try {
      const cached = readBingCache();
      return (cached && cached.imageUrl) || '';
    } catch (_) {
      return '';
    }
  }
  return '';
}

/**
 * 图片对比度热补丁样式：确保快捷入口等控件吃到场景字色
 * （不改布局，只补颜色阴影/表面；每次放则head 末尾保证压过 @import（ */
function ensureImageContrastStyle() {
  let style = document.getElementById('moonfog-img-contrast');
  if (!style) {
    style = document.createElement('style');
    style.id = 'moonfog-img-contrast';
  }
  // 只覆盖颜色相关属性，不新增渐句结构/特效
  style.textContent = `
html body.has-image-bg .greeting-title {
  color: var(--img-text) !important;
  -webkit-text-fill-color: currentColor;
  text-shadow: none !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  padding: 0 !important;
  margin: 0 !important;
}
html body.has-image-bg .greeting-title.is-quote-loading {
  color: var(--img-text, var(--text-primary)) !important;
  -webkit-text-fill-color: currentColor !important;
  opacity: 0.82;
}
html body.has-image-bg .greeting-sub {
  color: var(--img-text-secondary) !important;
  text-shadow: none !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  padding: 0 !important;
}
html body.has-image-bg .greeting-section {
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  padding: 0 !important;
}
/* 图片模式毛玻璃统一：搜紈/ 标签 / 设置钮同一奂token */
html body.has-image-bg .search-box,
html.boot-has-image .search-box,
html body.has-image-bg .shortcut-btn,
html body.has-image-bg .shortcut-folder-trigger,
html body.has-image-bg .settings-btn {
  background: color-mix(
    in srgb,
    var(--img-surface, var(--card-bg)) var(--glass-fill, 42%),
    transparent
  ) !important;
  border-color: color-mix(
    in srgb,
    var(--img-chrome-text, #fff) var(--glass-border, 28%),
    transparent
  ) !important;
  box-shadow: var(--glass-shadow, 0 8px 24px rgba(0, 0, 0, 0.16)) !important;
  text-shadow: none !important;
  backdrop-filter: blur(var(--search-blur, 16px)) saturate(var(--glass-saturate, 1.35)) !important;
  -webkit-backdrop-filter: blur(var(--search-blur, 16px)) saturate(var(--glass-saturate, 1.35)) !important;
}
/* 完全限制：盖过上面的 blur/半透明 !important，强制纯色底 */
html.low-perf body.has-image-bg .search-box,
html.low-perf.boot-has-image .search-box,
html.low-perf body.has-image-bg .shortcut-btn,
html.low-perf body.has-image-bg .shortcut-folder-trigger,
html.low-perf body.has-image-bg .shortcut-expanded,
html.low-perf body.has-image-bg .settings-btn,
html.low-perf body.has-image-bg .settings-panel,
html.perf-low body.has-image-bg .search-box,
html.perf-low body.has-image-bg .shortcut-btn,
html.perf-low body.has-image-bg .shortcut-folder-trigger,
html.perf-low body.has-image-bg .settings-btn,
html.perf-low body.has-image-bg .settings-panel {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* 用主题纯色token，不用带 alpha 皠--img-surface */
  background: var(--card-bg) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
}
html[data-mode="light"].low-perf body.has-image-bg .search-box,
html[data-mode="light"].low-perf body.has-image-bg .shortcut-btn,
html[data-mode="light"].low-perf body.has-image-bg .shortcut-folder-trigger,
html[data-mode="light"].low-perf body.has-image-bg .settings-btn,
html[data-mode="light"].low-perf body.has-image-bg .settings-panel,
html[data-mode="light"].perf-low body.has-image-bg .search-box,
html[data-mode="light"].perf-low body.has-image-bg .shortcut-btn,
html[data-mode="light"].perf-low body.has-image-bg .settings-btn,
html[data-mode="light"].perf-low body.has-image-bg .settings-panel {
  background: #f5f0e8 !important;
}
html[data-mode="dark"].low-perf body.has-image-bg .search-box,
html[data-mode="dark"].low-perf body.has-image-bg .shortcut-btn,
html[data-mode="dark"].low-perf body.has-image-bg .shortcut-folder-trigger,
html[data-mode="dark"].low-perf body.has-image-bg .settings-btn,
html[data-mode="dark"].low-perf body.has-image-bg .settings-panel,
html[data-mode="dark"].perf-low body.has-image-bg .search-box,
html[data-mode="dark"].perf-low body.has-image-bg .shortcut-btn,
html[data-mode="dark"].perf-low body.has-image-bg .settings-btn,
html[data-mode="dark"].perf-low body.has-image-bg .settings-panel {
  background: #2a2824 !important;
}
html body.has-image-bg.img-scene-dark {
  --glass-fill: 38%;
  --glass-fill-hover: 48%;
  --glass-border: 22%;
}
html body.has-image-bg.img-scene-light {
  --glass-fill: 48%;
  --glass-fill-hover: 58%;
  --glass-border: 20%;
}
html body.has-image-bg .search-box:focus-within,
html body.has-image-bg .shortcut-btn:hover,
html body.has-image-bg .shortcut-folder-trigger:hover,
html body.has-image-bg .shortcut-folder.open .shortcut-folder-trigger,
html body.has-image-bg .settings-btn:hover,
html body.has-image-bg.settings-open .settings-btn {
  background: color-mix(
    in srgb,
    var(--img-surface-hover, var(--img-surface, var(--card-bg))) var(--glass-fill-hover, 52%),
    transparent
  ) !important;
  border-color: color-mix(
    in srgb,
    var(--img-chrome-text, #fff) var(--glass-border-hover, 34%),
    transparent
  ) !important;
}
/* 完全限制：hover 也保持纯色，别再混透明 */
html.low-perf body.has-image-bg .search-box:focus-within,
html.low-perf body.has-image-bg .shortcut-btn:hover,
html.low-perf body.has-image-bg .shortcut-folder-trigger:hover,
html.low-perf body.has-image-bg .shortcut-folder.open .shortcut-folder-trigger,
html.low-perf body.has-image-bg .settings-btn:hover,
html.low-perf body.has-image-bg.settings-open .settings-btn,
html.perf-low body.has-image-bg .search-box:focus-within,
html.perf-low body.has-image-bg .shortcut-btn:hover,
html.perf-low body.has-image-bg .settings-btn:hover {
  background: inherit !important;
}
html[data-mode="light"].low-perf body.has-image-bg .search-box:focus-within,
html[data-mode="light"].low-perf body.has-image-bg .shortcut-btn:hover,
html[data-mode="light"].low-perf body.has-image-bg .settings-btn:hover,
html[data-mode="light"].perf-low body.has-image-bg .search-box:focus-within,
html[data-mode="light"].perf-low body.has-image-bg .shortcut-btn:hover {
  background: #ebe4d8 !important;
}
html[data-mode="dark"].low-perf body.has-image-bg .search-box:focus-within,
html[data-mode="dark"].low-perf body.has-image-bg .shortcut-btn:hover,
html[data-mode="dark"].low-perf body.has-image-bg .settings-btn:hover,
html[data-mode="dark"].perf-low body.has-image-bg .search-box:focus-within,
html[data-mode="dark"].perf-low body.has-image-bg .shortcut-btn:hover {
  background: #35322c !important;
}
html body.has-image-bg .search-input,
html body.has-image-bg .shortcut-btn,
html body.has-image-bg .shortcut-folder-trigger,
html body.has-image-bg .settings-btn {
  color: var(--img-chrome-text, var(--img-text)) !important;
}
html body.has-image-bg .search-input::placeholder {
  color: var(--img-chrome-text-muted, var(--img-text-muted)) !important;
}
html body.has-image-bg .search-btn {
  color: var(--img-chrome-text-secondary, var(--img-text-secondary)) !important;
}
html body.has-image-bg .search-btn:hover {
  color: var(--img-chrome-text, var(--img-text)) !important;
}
html body.has-image-bg .shortcut-btn .shortcut-label,
html body.has-image-bg .shortcut-folder-trigger .shortcut-label,
html body.has-image-bg .shortcut-btn .shortcut-icon,
html body.has-image-bg .shortcut-folder-trigger .shortcut-icon,
html body.has-image-bg .shortcut-btn .shortcut-fallback-icon,
html body.has-image-bg .shortcut-folder-trigger .shortcut-fallback-icon {
  color: inherit !important;
}
html body.has-image-bg .bing-credit {
  color: var(--img-credit-text) !important;
}
html body.has-image-bg .page-bg-overlay {
  background: var(--bg-neutral-wash, var(--img-wash, transparent)) !important;
}
`.trim();
  // 始终挂到 head 末尾，压过异歉@import 样式
  document.head.appendChild(style);
  return style;
}

/**
 * 图片背景下：不写死内联颜色（内联会打新CSS 过渡（ * 统一CSS 变量 + 样式表驱动，保证深浅切换流畅、控件位置不句 */
function applyShortcutContrastInline(palette) {
  const nodes = document.querySelectorAll(
    '.shortcut-btn, .shortcut-folder-trigger, .settings-btn'
  );
  // 始终清掉历史内联色，颜色只走 CSS 变量，保证明暗切换可过渡
  nodes.forEach((el) => {
    ['color', 'background', 'background-color', 'border-color', 'text-shadow'].forEach((prop) => {
      el.style.removeProperty(prop);
    });
    el.querySelectorAll('.shortcut-label, .shortcut-fallback-icon, .shortcut-icon').forEach((child) => {
      child.style.removeProperty('color');
    });
  });
  void palette;
}

/**
 * 把取色结果写则CSS 变量（Monet roles →UI tokens（ * 图片壁纸：始终压暐+ 白色文字；深色模式仅捧UI 底色为黑色 */
function applyImagePalette(palette) {
  // 防呆：防止 applyImagePalette → syncModeWithWallpaperScene → applyTheme → refreshImagePaletteForMode → applyImagePalette 无限递归
  if (applyImagePalette._running) return;
  applyImagePalette._running = true;
  try {
  if (!palette) {
    clearImagePalette();
    persistImagePalette(null);
    applyShortcutContrastInline(null);
    const patch = document.getElementById('moonfog-img-contrast');
    if (patch) patch.remove();
    // 同步 ThemeManager
    if (window.__MOONFOG_THEME_MANAGER__) {
      window.__MOONFOG_THEME_MANAGER__.clearImagePalette();
    }
    return;
  }
  ensureImageContrastStyle();
  // 修复：async取色完成后模式可能已变，确保 isDarkUi 匹配当前模式
  if (palette && palette.isDarkUi !== undefined && lastDominant && typeof getUiMode === 'function') {
    const currentDark = getUiMode() === 'dark';
    if (palette.isDarkUi !== currentDark) {
      palette = buildPaletteFromDominant(lastDominant, currentDark ? 'dark' : 'light');
      lastPalette = palette;
    }
  }
  // 同步 ThemeManager
  if (window.__MOONFOG_THEME_MANAGER__) {
    window.__MOONFOG_THEME_MANAGER__.setImagePalette(palette);
  }
  const root = document.documentElement;
  const isDark = root.getAttribute('data-mode') === 'dark';
  const uiDark = getUiMode() === 'dark';

  // 图片壁纸有40%压暗遮罩，问候文字固定白色
  root.style.setProperty('--img-text', '#FFFFFF');
  root.style.setProperty('--img-text-secondary', 'rgba(255,255,255,0.75)');
  root.style.setProperty('--img-text-muted', 'rgba(255,255,255,0.5)');
  root.style.setProperty('--img-text-accent', palette.textAccent || palette.accent || '#FFFFFF');
  root.style.setProperty('--img-text-shadow', 'none');
  root.style.setProperty('--img-text-shadow-soft', 'none');
  root.style.setProperty('--img-text-glow', 'transparent');

  // 控件字色：跟 UI 模式
  const chromeTextLight = uiDark;
  root.style.setProperty('--img-chrome-text', chromeTextLight ? '#FFFFFF' : '#1A1A1A');
  root.style.setProperty('--img-chrome-text-secondary', chromeTextLight ? 'rgba(255,255,255,0.75)' : 'rgba(26,26,26,0.65)');
  root.style.setProperty('--img-chrome-text-muted', chromeTextLight ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,26,0.45)');

  // 控件表面：跟 UI 模式
  root.style.setProperty('--img-surface', chromeTextLight ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.85)');
  root.style.setProperty('--img-surface-hover', chromeTextLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.90)');
  root.style.setProperty('--img-chip', palette.chip || 'transparent');
  root.style.setProperty('--img-border', chromeTextLight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)');
  root.style.setProperty('--img-shadow', chromeTextLight ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.08)');
  root.style.setProperty('--img-credit-bg', chromeTextLight ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.35)');
  root.style.setProperty('--img-credit-text', chromeTextLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.8)');

  // 全屏遮罩：统一 40% 压暗，不随浅深模式变化
  const overlay = document.getElementById('pageBgOverlay');
  const overlayColor = 'rgba(0,0,0,0.4)';
  root.style.setProperty('--img-wash', overlayColor);
  root.style.setProperty('--bg-neutral-wash', overlayColor);
  if (overlay) overlay.style.setProperty('background', overlayColor, 'important');

  root.style.setProperty('--img-accent', palette.accent || palette.textAccent || '#FFFFFF');
  root.style.setProperty('--img-accent-soft', palette.accentSoft || 'transparent');
  root.style.setProperty('--img-accent-2', palette.accent2 || palette.accent || 'transparent');
  root.style.setProperty('--img-focus-ring', palette.focusRing || palette.accentSoft || 'transparent');
  if (palette.seedHex) root.style.setProperty('--img-seed', palette.seedHex);

  // 场景极性：跟壁纸实际明暗
  const sceneIsDark = palette.sceneDark !== false;
  document.body.classList.toggle('img-scene-dark', sceneIsDark);
  document.body.classList.toggle('img-scene-light', !sceneIsDark);

  document.body.classList.toggle('img-ui-dark', uiDark);
  document.body.classList.toggle('img-ui-light', !uiDark);
  palette.isDarkUi = uiDark;
  applyShortcutContrastInline(palette);
  persistImagePalette(palette, lastDominant);
  } finally {
    applyImagePalette._running = false;
  }
}

/**
 * 图片背景色板刷新（ * - 裸露文字跟壁纸场景 * - 控件表面/字色跟用户浅深mode
 */
function refreshImagePaletteForMode(mode) {
  // 防呆：从 localStorage 读真实 bgMode，避免异步延迟导致的缓存过期
  const effective = getEffectiveBgMode();
  if (effective === 'solid') return;
  if (
    !document.body.classList.contains('has-image-bg') &&
    effective !== 'local' &&
    effective !== 'bing'
  ) {
    return;
  }
  if (!lastDominant) {
    hydrateImagePaletteSeed();
  }
  if (!lastDominant) return;
  const palette = buildPaletteFromDominant(lastDominant, mode || getUiMode());
  lastPalette = palette;
  applyImagePalette(palette);
}

/**
 * 对当前背景图取样并应用（按壁纸亮度自动黑/白字（ */
async function applyPaletteForUrl(url) {
  if (!url) {
    clearImagePalette();
    lastDominant = null;
    lastPaletteUrl = '';
    document.body.classList.remove('img-ui-dark', 'img-ui-light', 'img-scene-dark', 'img-scene-light');
    return;
  }
  console.log('[MoonFog] applyPaletteForUrl:', url.substring(0, 60), 'lastDominant:', !!lastDominant, 'lastPalette:', !!lastPalette);
  // 同图已取色：只按当前明暗重算，避免进场中再跑 canvas
  if (
    lastDominant &&
    lastPalette &&
    (lastPaletteUrl === url || (lastDominant.url && lastDominant.url === url))
  ) {
    lastPaletteUrl = url;
    const rebuilt = buildPaletteFromDominant(lastDominant, getUiMode());
    applyImagePalette(rebuilt);
    return;
  }
  const palette = await extractPaletteFromImage(url, getUiMode());
  if (lastDominant) lastDominant.url = url;
  lastPaletteUrl = url;
  applyImagePalette(palette);
}

/**
 * 应用背景模式
 */
let _bgModeApplyLock = null;
async function applyBackgroundMode(mode, options = {}) {
  const nextMode = normalizeBgMode(mode);
  // 防呆：防止并发调用导致中间状态被覆盖（200ms 内相同模式跳过）
  const lockKey = nextMode + ':' + (options.persist ? 'p' : 'n');
  if (_bgModeApplyLock === lockKey && !options.force) return null;
  _bgModeApplyLock = lockKey;
  setTimeout(() => { if (_bgModeApplyLock === lockKey) _bgModeApplyLock = null; }, 300);

  currentBgMode = nextMode;
  // OOBE 中默认实时切背景预览，不写盘
  const oobeLive =
    typeof document !== 'undefined' &&
    document.body &&
    document.body.classList.contains('oobe-active');
  // OOBE 使用自己的预览画布；完成落盘时才启动主页画布，避免重复WebGL 渲染。
  setGrainBackgroundActive(
    nextMode === 'grain' && (!oobeLive || options.persist === true)
  );
  const persist =
    options.persist === true ||
    (options.persist !== false && !oobeLive);
  if (persist) {
    try {
      localStorage.setItem(BG_MODE_KEY, nextMode);
    } catch (_) {}
  }

  if (nextMode === 'solid' || nextMode === 'grain') {
    setPageBackgroundImage('', false);
    setBingCredit('');
    currentBingMeta = null;
    clearImagePalette();
    lastDominant = null;
    // 纯色和Grain 没有可取样壁纸场景：「跟随壁纸」→ 改跟系统。
    try {
      const pref =
        typeof getModePref === 'function'
          ? getModePref()
          : document.documentElement.getAttribute('data-mode-pref');
      if (typeof updateModeToggleUI === 'function') {
        updateModeToggleUI(
          pref,
          document.documentElement.getAttribute('data-mode')
        );
      }
    } catch (_) {}
    updateBgSettingsUI();
    if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
    // 流光渐变：应用调色板则UI（非流光时也会清琨inline 样式（
    if (typeof applyGrainPalette === 'function') {
      applyGrainPalette();
    }
    return;
  }

  if (nextMode === 'local') {
    setBingCredit('');
    currentBingMeta = null;
    if (localBgDataUrl) {
      // 先等图就绪；取色延后，不挡交叉淡免
      const ok = await setPageBackgroundImage(localBgDataUrl, true);
      if (ok) {
        whenBgEnterSettled(() => applyPaletteForUrl(localBgDataUrl), 700);
      }
    } else {
      await setPageBackgroundImage('', false);
      clearImagePalette();
      lastDominant = null;
      if (!options.silent) {
        const tip = document.getElementById('bgLocalTip');
        if (tip) tip.textContent = '请先选择一张本地图片';
      }
    }
    updateBgSettingsUI();
    if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
    // 切到图片背景：恢复「壁纸」明暗选项
    if (typeof updateModeToggleUI === 'function') {
      try {
        updateModeToggleUI(
          typeof getModePref === 'function' ? getModePref() : null,
          document.documentElement.getAttribute('data-mode')
        );
      } catch (_) {}
    }
    return;
  }

  // bing：缓存日图可秒开；跨日先保留旧图，新图解码后交叉淡入再取色
  updateBgSettingsUI();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
  if (typeof updateModeToggleUI === 'function') {
    try {
      updateModeToggleUI(
        typeof getModePref === 'function' ? getModePref() : null,
        document.documentElement.getAttribute('data-mode')
      );
    } catch (_) {}
  }
  try {
    const meta = await loadBingDailyImage();
    currentBingMeta = meta;
    const ok = await setPageBackgroundImage(meta.imageUrl, true);
    setBingCredit(meta.copyright || meta.title || 'Bing 每日一图', meta);
    if (ok) {
      whenBgEnterSettled(() => applyPaletteForUrl(meta.imageUrl), 700);
    }
  } catch (err) {
    const cached = readBingCache();
    if (cached && cached.imageUrl) {
      currentBingMeta = cached;
      const ok = await setPageBackgroundImage(cached.imageUrl, true);
      setBingCredit(cached.copyright || cached.title || 'Bing 每日一图（缓存（', cached);
      if (ok) {
        whenBgEnterSettled(() => applyPaletteForUrl(cached.imageUrl), 700);
      }
    } else {
      await setPageBackgroundImage('', false);
      setBingCredit('');
      currentBingMeta = null;
      clearImagePalette();
      lastDominant = null;
      if (!options.silent) {
        const title = document.getElementById('bgBingTitle');
        if (title) title.textContent = '今日壁纸加载失败，请稍后重试';
      }
    }
  }
  updateBgSettingsUI();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
  // 通知其他模块（如关于横幅）背景模式已变更
  window.dispatchEvent(new CustomEvent('bg-mode-change', { detail: { mode: nextMode } }));
}

/**
 * 读取必应缓存
 */
function readBingCache() {
  try {
    const raw = localStorage.getItem(BING_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 写入必应缓存
 */
function writeBingCache(data) {
  try {
    localStorage.setItem(BING_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage 写入失败（隐私模式/ 配额），静默
  }
}

function readBingPool() {
  try {
    const raw = localStorage.getItem(
      typeof BING_POOL_KEY === 'string' ? BING_POOL_KEY : 'moonfog_bg_bing_pool'
    );
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBingPool(pool) {
  try {
    localStorage.setItem(
      typeof BING_POOL_KEY === 'string' ? BING_POOL_KEY : 'moonfog_bg_bing_pool',
      JSON.stringify(pool)
    );
  } catch (e) {
    // localStorage 写入失败，静默
  }
}

function normalizeBingImageMeta(image, base, dayKey, idx) {
  if (!image || !image.url) return null;
  const imageUrl = image.url.startsWith('http') ? image.url : `${base}${image.url}`;
  const title = (image.title || '').trim();
  const copyright = (image.copyright || '').trim();
  let copyrightlink = String(image.copyrightlink || '').trim();
  if (copyrightlink && !/^https?:\/\//i.test(copyrightlink)) {
    copyrightlink = copyrightlink.startsWith('/')
      ? `${base}${copyrightlink}`
      : `${base}/${copyrightlink}`;
  }
  const startdate = String(image.startdate || image.fullstartdate || '').slice(0, 8);
  return {
    dayKey: dayKey || startdate || getDayKey(),
    idx: Number.isFinite(idx) ? idx : 0,
    imageUrl,
    title: title || copyright.split('(')[0].trim() || '必应每日一图',
    copyright,
    copyrightlink,
    startdate
  };
}

/**
 * 拉取近几日必应壁纸池（今时+ 往前若干天（ */
async function fetchBingImagePool(force) {
  const dayKey = getDayKey();
  const n = typeof BING_POOL_SIZE === 'number' ? BING_POOL_SIZE : 8;
  const cachedPool = readBingPool();
  if (
    !force &&
    cachedPool &&
    cachedPool.dayKey === dayKey &&
    Array.isArray(cachedPool.items) &&
    cachedPool.items.length >= 2
  ) {
    return cachedPool;
  }

  const endpoints = [
    `https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${n}&mkt=zh-CN&uhd=1&uhdwidth=1920&uhdheight=1080`,
    `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${n}&mkt=zh-CN`
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const images = data && data.images;
      if (!images || !images.length) throw new Error('Invalid Bing pool');
      const base = endpoint.includes('cn.bing.com') ? 'https://cn.bing.com' : 'https://www.bing.com';
      const items = [];
      const seen = new Set();
      images.forEach((image, i) => {
        const meta = normalizeBingImageMeta(image, base, dayKey, i);
        if (!meta || !meta.imageUrl || seen.has(meta.imageUrl)) return;
        seen.add(meta.imageUrl);
        items.push(meta);
      });
      if (!items.length) throw new Error('Empty Bing pool');
      const pool = {
        dayKey,
        at: Date.now(),
        items,
        // 当前展示在池中的下标（今日默认0（
        cursor: 0
      };
      // 若用户当天已选过非今日图，尽量保
      if (cachedPool && cachedPool.dayKey === dayKey && cachedPool.cursor != null) {
        const prevUrl =
          currentBingMeta && currentBingMeta.imageUrl
            ? currentBingMeta.imageUrl
            : (cachedPool.items &&
                cachedPool.items[cachedPool.cursor] &&
                cachedPool.items[cachedPool.cursor].imageUrl);
        if (prevUrl) {
          const idx = items.findIndex((it) => it.imageUrl === prevUrl);
          if (idx >= 0) pool.cursor = idx;
        }
      }
      writeBingPool(pool);
      // 同步今日主缓存为池中当前页
      const current = items[pool.cursor] || items[0];
      writeBingCache({
        dayKey,
        imageUrl: current.imageUrl,
        title: current.title,
        copyright: current.copyright,
        copyrightlink: current.copyrightlink,
        idx: current.idx
      });
      return pool;
    } catch (err) {
      lastError = err;
    }
  }
  // 池拉取失败：若有旧池仍可画
  if (cachedPool && Array.isArray(cachedPool.items) && cachedPool.items.length) {
    return cachedPool;
  }
  throw lastError || new Error('Failed to load Bing pool');
}

/**
 * 拉取必应每日一图（按自然日缓存；同时维护多日池（ */
async function loadBingDailyImage() {
  const dayKey = getDayKey();
  const cached = readBingCache();
  // 同日缓存：后台刷新池，前台直接用
  if (cached && cached.dayKey === dayKey && cached.imageUrl) {
    fetchBingImagePool(false).catch(() => {});
    return cached;
  }

  const pool = await fetchBingImagePool(true);
  const item = (pool.items && pool.items[pool.cursor]) || pool.items[0];
  if (!item) throw new Error('No Bing image');
  const meta = {
    dayKey,
    imageUrl: item.imageUrl,
    title: item.title,
    copyright: item.copyright,
    copyrightlink: item.copyrightlink,
    idx: item.idx
  };
  writeBingCache(meta);
  return meta;
}

/** 换一张进行中 */
let bingShuffleBusy = false;

/**
 * 换一张必应壁纸（近几日池内随机，带交叉淡入）
 */
async function shuffleBingWallpaper() {
  if (bingShuffleBusy) return null;
  if (currentBgMode !== 'bing') return null;
  bingShuffleBusy = true;
  const btn = document.getElementById('bgBingShuffle');
  const label = document.getElementById('bgBingShuffleLabel');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('is-loading');
  }
  if (label) label.textContent = '切换中…';

  try {
    let pool;
    try {
      pool = await fetchBingImagePool(false);
    } catch {
      pool = await fetchBingImagePool(true);
    }
    const items = (pool && pool.items) || [];
    if (items.length < 2) {
      pool = await fetchBingImagePool(true);
    }
    const list = (pool && pool.items) || [];
    if (!list.length) throw new Error('暂无更多壁纸');

    const currentUrl =
      (currentBingMeta && currentBingMeta.imageUrl) ||
      (currentBgImageUrl || '');
    let candidates = list.filter((it) => it.imageUrl !== currentUrl);
    if (!candidates.length) candidates = list.slice();
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const cursor = list.findIndex((it) => it.imageUrl === pick.imageUrl);

    const dayKey = getDayKey();
    const meta = {
      dayKey,
      imageUrl: pick.imageUrl,
      title: pick.title,
      copyright: pick.copyright,
      copyrightlink: pick.copyrightlink,
      idx: pick.idx != null ? pick.idx : Math.max(0, cursor)
    };

    writeBingPool({
      dayKey: pool.dayKey || dayKey,
      at: Date.now(),
      items: list,
      cursor: cursor >= 0 ? cursor : 0
    });
    writeBingCache(meta);

    currentBingMeta = meta;
    // 整页壁纸交叉淡入 + 设置页预览同步动画（并行（
    const [ok] = await Promise.all([
      setPageBackgroundImage(meta.imageUrl, true),
      typeof setBingHeroPreview === 'function'
        ? setBingHeroPreview(meta.imageUrl, { animate: true })
        : Promise.resolve(true)
    ]);
    setBingCredit(meta.copyright || meta.title || 'Bing 每日一图', meta);
    // 取色延后到交叉淡入后再跑，避免换图卡一与
    if (ok) {
      whenBgEnterSettled(() => applyPaletteForUrl(meta.imageUrl), 780);
    }
    updateBgSettingsUI();
    if (label) label.textContent = '换一式';
    return meta;
  } catch (err) {
    if (label) label.textContent = '换一式';
    return null;
  } finally {
    bingShuffleBusy = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }
}

/**
 * 压缩本地图片与dataURL，避免localStorage 溢出
 */
function compressImageFile(file, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > LOCAL_BG_MAX_BYTES && q > 0.45) {
          q -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        if (dataUrl.length > LOCAL_BG_MAX_BYTES) {
          reject(new Error('图片过大，请换一张更小的图片'));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片解析失败'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 保存本地背景图 */
function saveLocalBackground(dataUrl, options = {}) {
  localBgDataUrl = dataUrl;
  lastPaletteUrl = '';
  lastPalette = null;
  lastDominant = null;
  // OOBE 中可先放内存做预览；落盘需 persist:true 或非 OOBE
  const oobeLive =
    typeof document !== 'undefined' &&
    document.body &&
    document.body.classList.contains('oobe-active');
  const persist =
    options.persist === true ||
    (options.persist !== false && !oobeLive);
  if (!persist) return;
  try {
    localStorage.setItem(LOCAL_BG_KEY, dataUrl);
  } catch (_) {}
}

/**
 * 清除本地背景图 */
function clearLocalBackground() {
  localStorage.removeItem(LOCAL_BG_KEY);
  localBgDataUrl = '';
  lastPaletteUrl = '';
  lastPalette = null;
  lastDominant = null;
}
