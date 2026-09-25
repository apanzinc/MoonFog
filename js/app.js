/**
 * MoonFog
 * 温暖极简新标签页
 *
 * @author apanzinc
 */

// 根据浏览器设置标签页标题
(function() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) {
    document.title = '新建标签页';
  } else {
    document.title = '新标签页';
  }
})();

/**
 * 立刻开启动画。
 * 必须免 schedule rAF，再跑重活：rAF 在当前任务结束后、下一帧 paint 前执行。
 * 若先同步跑 applyTheme / 渲染等，会把 rAF 拖到「卡一下」之后才进场。
 */
function startBootEnter(options = {}) {
  const root = document.documentElement;
  const fromOobe = !!options.fromOobe;
  const perf = root.getAttribute('data-perf') ||
    (root.classList.contains('low-perf') ? 'low' :
      (root.classList.contains('perf-balanced') ? 'balanced' : 'full'));
  const skipEnterAnim = perf === 'low' || perf === 'balanced';
  // 内联工boot-ready：只补收尾；否则同步开跑（壁纸+文案同一帧）
  if (!root.classList.contains('boot-ready')) {
    root.classList.add('boot-ready', 'bg-swap-ready');
    // 均衡/极致：立刻结束进场态，不播 bg-enter
    if (skipEnterAnim) root.classList.add('bg-entered');
    else {
      window.setTimeout(() => {
        root.classList.add('bg-entered');
      }, fromOobe ? 520 : 950);
    }
  }
  if (skipEnterAnim) {
    document.querySelectorAll(
      '.greeting-section, .search-section, .shortcuts-section, .bing-credit, .search-box, .shortcut-btn, .shortcut-folder-trigger'
    ).forEach((el) => el.classList.add('boot-entered'));
    return;
  }
  // OOBE 收尾自己 stamp boot-entered，避免与默认上浮叠播
  if (fromOobe) return;
  markBootEntered();
}

/**
 * 页面进场动画结束后打 boot-entered
 */
function markBootEntered() {
  const targets = [
    document.querySelector('.greeting-section'),
    document.querySelector('.search-section'),
    document.querySelector('.shortcuts-section'),
    document.querySelector('.bing-credit')
  ].filter(Boolean);

  if (!targets.length) return;

  const doneMs = 1200;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    targets.forEach((el) => el.classList.add('boot-entered'));
  };

  window.setTimeout(finish, doneMs);
}

/**
 * 进场之后再挂交互 / 后台任务（不挡首帧动画）
 */
function initDeferred(boot) {
  // 主题 / 字体：boot 已上首屏；这里只做完整同步与偏好解析
  const savedTone = boot.tone || localStorage.getItem('moonfog_tone') || DEFAULT_TONE;
  const savedPref =
    boot.modePref ||
    (typeof loadModePref === 'function' ? loadModePref() : null) ||
    localStorage.getItem('moonfog_mode_pref') ||
    boot.mode ||
    localStorage.getItem('moonfog_mode') ||
    DEFAULT_MODE;
  try {
    if (typeof applyTheme === 'function') {
      applyTheme(savedTone, savedPref, { animate: false });
    }
  } catch (err) {
    console.error('[MoonFog] applyTheme failed:', err);
  }

  try {
    if (typeof applyTypeRoles === 'function') {
      applyTypeRoles(typeof loadTypeRoles === 'function' ? loadTypeRoles() : null);
    } else if (typeof applyFont === 'function') {
      const rawFont = boot.fontKey || localStorage.getItem('moonfog_font') || DEFAULT_FONT;
      const savedFont = typeof resolveFontKey === 'function' ? resolveFontKey(rawFont) : rawFont;
      const savedWeight = boot.weight || localStorage.getItem('moonfog_weight') || DEFAULT_WEIGHT;
      applyFont(savedFont);
      applyWeight(savedWeight);
    }
  } catch (err) {
    console.error('[MoonFog] applyFont/TypeRoles failed:', err);
  }

  // 一言已在 init 同步拉过；这里只补非一言问候 + 定时器
  if (currentGreetingMode !== GREETING_MODES.quote) {
    if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
  } else if (typeof initQuoteClick === 'function') {
    // 确保点击换句已绑定（init 时 settings 未齐也没关系）
  }
  setInterval(() => {
    if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
  }, 1000);

  try { if (typeof initQuoteClick === 'function') initQuoteClick(); } catch (err) {
    console.error('[MoonFog] initQuoteClick failed:', err);
  }
  try { if (typeof initSearch === 'function') initSearch(); } catch (err) {
    console.error('[MoonFog] initSearch failed:', err);
  }
  try { if (typeof renderShortcuts === 'function') renderShortcuts(); } catch (err) {
    console.error('[MoonFog] renderShortcuts failed:', err);
  }
  try { if (typeof initSettings === 'function') initSettings(); } catch (err) {
    console.error('[MoonFog] initSettings failed:', err);
  }

  // 背景校验 / 必应刷新完全后台
  Promise.resolve()
    .then(() => (typeof initBackground === 'function' ? initBackground() : null))
    .then(() => {
      if (typeof initBingCreditPop === 'function') initBingCreditPop();
    })
    .catch((err) => {
      console.error('[MoonFog] initBackground/initBingCreditPop failed:', err);
    });
}

/**
 * 极速启动：免schedule 进场，再延后重活
 */
function init() {
  const boot = window.__MOONFOG_BOOT__ || {};

  // —…轻量关键态（尽量少同步工作）—…
  try {
    const savedName = localStorage.getItem('moonfog_username');
    if (savedName) currentUsername = savedName;
  } catch (_) {}

  if (typeof loadCustomText === 'function') {
    loadCustomText();
  } else {
    try {
      currentCustomText = (localStorage.getItem(CUSTOM_TEXT_KEY) || '').trim();
    } catch {
      currentCustomText = typeof DEFAULT_CUSTOM_TEXT !== 'undefined' ? DEFAULT_CUSTOM_TEXT : '';
    }
  }

  if (typeof loadClockOptions === 'function') {
    loadClockOptions();
  }
  if (typeof loadQuoteMaxLen === 'function') {
    loadQuoteMaxLen();
  }

  // 问候模式class（boot 多半已写好文案）
  if (typeof normalizeGreetingMode === 'function') {
    currentGreetingMode = normalizeGreetingMode(
      boot.greetingMode || localStorage.getItem('moonfog_greeting_mode')
    );
  }
  if (typeof applyGreetingMode === 'function') {
    applyGreetingMode(currentGreetingMode, false);
  }

  // 一言：同步秒开（池/boot 缓存），不放过 deferred 以免空等几十～上百 ms
  if (
    currentGreetingMode === GREETING_MODES.quote &&
    typeof prefetchDailyQuoteOnLoad === 'function'
  ) {
    try {
      prefetchDailyQuoteOnLoad();
    } catch (_) {}
  }

  // 首次欢迎：盖住主页UI；完成后内startBootEnter
  let showingOobe = false;
  try {
    if (typeof maybeShowOobe === 'function') {
      showingOobe = !!maybeShowOobe();
    }
  } catch (err) {
    // OOBE 初始化失败：跳过，直接进入
  }

  if (!showingOobe) {
    startBootEnter();
  }

  // 隐藏启动覆盖层（延迟等待 grain canvas 渲染，再渐隐）
  var bootCover = document.getElementById('bootCover');
  if (bootCover && bootCover.classList.contains('is-active')) {
    var coverDelay = (typeof currentBgMode !== 'undefined' && currentBgMode === 'grain') ? 300 : 0;
    setTimeout(function () {
      bootCover.classList.add('is-leaving');
      setTimeout(function () { bootCover.remove(); }, 500);
    }, coverDelay);
  }

  // 重活延后：先让进國/ OOBE paint
  const runDeferred = () => {
    try {
      initDeferred(boot);
    } catch (err) {
      console.error('[MoonFog] Deferred initialization failed:', err);
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(runDeferred, { timeout: 120 });
  } else {
    window.setTimeout(runDeferred, 48);
  }
}

// 启动：DOM 已可交互时尽早进
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
