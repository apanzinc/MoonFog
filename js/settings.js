/**
 * MoonFog - 设置面板
 */

const SETTINGS_PAGE_TITLES = {
  greeting: '问候区',
  appearance: '背景与主题',
  type: '文字',
  search: '搜索',
  shortcuts: '收藏夹',
  display: '显示与效果',
  data: '数据备份与导出',
  about: '关于',
  personalization: '个性化',
  preset: '套装',
};

// 三级导航：个性化子页面 → 详情页映射
const PERSONALIZATION_CHILDREN = ['preset', 'appearance', 'greeting', 'type', 'display'];

/** 当前设置页：'root' | pageId */
let currentSettingsPage = 'root';
let settingsNavToken = 0;
let settingsNavCleanup = null;
let settingsNavHistory = [];

let _settingsPanelCache = null;
function getSettingsPanel() {
  if (!_settingsPanelCache) _settingsPanelCache = document.getElementById('settingsPanel');
  return _settingsPanelCache;
}

function getSettingsPageTitle(pageId) {
  return SETTINGS_PAGE_TITLES[pageId] || '设置';
}

function isSettingsOpen() {
  const panel = getSettingsPanel();
  return !!(panel && panel.classList.contains('active'));
}

/** 返回动画时仍展示上一二级页内容，避免内容先被 hidden 闪没 */
let lastSettingsPageId = '';

function syncSettingsPageContent(pageView, isRoot, pageId) {
  if (!pageView) return;
  // 返回一级时：动画中保留当前二级内容；结束后再清
  if (isRoot) return;
  lastSettingsPageId = pageId || '';
  pageView.querySelectorAll('.settings-page').forEach((page) => {
    page.hidden = page.dataset.page !== pageId;
  });
}

function finishSettingsViewVisibility(panel, rootView, pageView, isRoot) {
  if (!panel || !rootView || !pageView) return;
  panel.classList.remove('settings-animating');
  rootView.hidden = false;
  pageView.hidden = isRoot;
  rootView.setAttribute('aria-hidden', isRoot ? 'false' : 'true');
  pageView.setAttribute('aria-hidden', isRoot ? 'true' : 'false');
  rootView.style.pointerEvents = isRoot ? '' : 'none';
  pageView.style.pointerEvents = isRoot ? 'none' : '';
  if (isRoot) {
    pageView.removeAttribute('data-page-depth');
    pageView.removeAttribute('data-slide');
    pageView.querySelectorAll('.settings-page').forEach((page) => {
      page.hidden = true;
    });
  }
}

/**
 * 切换设置视图：支持三级导航
 * 一级 root → 二级 personalization → 三级 detail page
 */
function navigateSettings(pageId, options = {}) {
  const panel = getSettingsPanel();
  const rootView = document.getElementById('settingsViewRoot');
  const pageView = document.getElementById('settingsViewPage');
  const titleEl = document.getElementById('settingsPanelTitle');
  const backBtn = document.getElementById('settingsBackBtn');
  if (!panel || !rootView || !pageView) return;

  const goingBack = options.back === true;
  const fromPeek =
    isRootPageId(pageId) &&
    panel.classList.contains('settings-back-peek') &&
    (panel.dataset.view || 'root') === 'page';
  if (!fromPeek) {
    clearSettingsBackPeek();
    panel.classList.remove('settings-back-from-peek');
  }

  if (typeof settingsNavCleanup === 'function') {
    settingsNavCleanup();
    settingsNavCleanup = null;
  }

  // 导航历史管理
  if (goingBack) {
    // 返回：弹出历史
    settingsNavHistory.pop();
  } else if (pageId && pageId !== 'root' && currentSettingsPage !== 'root') {
    // 从二级→三级 或 三级→三级：推入历史
    settingsNavHistory.push(currentSettingsPage);
  } else if (pageId === 'root' || !pageId) {
    // 回一级：清空历史
    settingsNavHistory = [];
  }

  const isRoot = !pageId || pageId === 'root';
  const nextView = isRoot ? 'root' : 'page';
  const prevView = panel.dataset.view || 'root';
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animate = options.animate !== false && !reduceMotion && prevView !== nextView;
  const token = ++settingsNavToken;

  currentSettingsPage = isRoot ? 'root' : pageId;

  // 进入二级：切换内容；返回：保留内容直到动画结束
  if (typeof closeMfColorPicker === 'function') closeMfColorPicker();
  syncSettingsPageContent(pageView, isRoot, pageId);

  // 三级导航：设置深度和滑动方向
  const isPersonalization = pageId === 'personalization';
  const isLevel3 = PERSONALIZATION_CHILDREN.includes(pageId);
  if (!isRoot) {
    pageView.setAttribute('data-page-depth', isLevel3 ? '3' : '2');
    if (isLevel3) {
      pageView.setAttribute('data-slide', 'left');
    } else if (goingBack && isPersonalization) {
      pageView.setAttribute('data-slide', 'right');
    } else {
      pageView.removeAttribute('data-slide');
    }
    // 动画结束后清除 data-slide
    if (pageView.getAttribute('data-slide')) {
      const activePage = pageView.querySelector(`.settings-page[data-page="${pageId}"]`);
      if (activePage) {
        const cleanupSlide = () => {
          if (token !== settingsNavToken) return;
          pageView.removeAttribute('data-slide');
          activePage.removeEventListener('animationend', cleanupSlide);
        };
        activePage.addEventListener('animationend', cleanupSlide);
        // 兜底：无动画时立即清除
        setTimeout(cleanupSlide, 350);
      }
    }
  } else {
    pageView.removeAttribute('data-page-depth');
    pageView.removeAttribute('data-slide');
  }
  if (isRoot && lastSettingsPageId) {
    pageView.querySelectorAll('.settings-page').forEach((page) => {
      page.hidden = page.dataset.page !== lastSettingsPageId;
    });
  }

  const headerEl = panel.querySelector('.settings-header');
  const backLabel = document.getElementById('settingsBackLabel');
  if (headerEl) headerEl.dataset.level = isRoot ? 'root' : 'page';
  if (titleEl) {
    if (isRoot) titleEl.textContent = '设置';
    else titleEl.textContent = getSettingsPageTitle(pageId);
  }
  if (backLabel) {
    // 三级页面显示父级名称，二级显示"设置"
    const parentPage = settingsNavHistory.length > 0 ? settingsNavHistory[settingsNavHistory.length - 1] : null;
    backLabel.textContent = parentPage ? getSettingsPageTitle(parentPage) : '设置';
  }
  if (backBtn) {
    backBtn.setAttribute('aria-label', '返回设置');
    if (backBtn._backAnimRaf) {
      cancelAnimationFrame(backBtn._backAnimRaf);
      backBtn._backAnimRaf = null;
    }
    if (isRoot) {
      // 退出：去掉 is-shown 并过渡到收起
      backBtn.classList.remove('is-shown');
      backBtn.setAttribute('aria-hidden', 'true');
      backBtn.setAttribute('tabindex', '-1');
      backBtn.hidden = false;
    } else {
      // 进入：先锁收起态再�is-shown，保�transition 能跑
      backBtn.hidden = false;
      backBtn.setAttribute('aria-hidden', 'false');
      backBtn.setAttribute('tabindex', '0');
      if (reduceMotion || !animate) {
        backBtn.classList.add('is-shown');
      } else if (!backBtn.classList.contains('is-shown')) {
        backBtn.classList.remove('is-shown');
        void backBtn.offsetWidth;
        backBtn._backAnimRaf = requestAnimationFrame(() => {
          backBtn._backAnimRaf = requestAnimationFrame(() => {
            backBtn._backAnimRaf = null;
            if (currentSettingsPage === 'root') return;
            backBtn.classList.add('is-shown');
          });
        });
      } else {
        backBtn.classList.add('is-shown');
      }
    }
  }

  if (!isRoot && pageId === 'greeting') {
    if (typeof updateCustomTextCount === 'function') updateCustomTextCount();
    if (typeof updateGreetingSettingsVisibility === 'function') updateGreetingSettingsVisibility();
    if (typeof updateGreetingPreview === 'function') updateGreetingPreview();
  }

  if (!isRoot) pageView.scrollTop = 0;
  else rootView.scrollTop = 0;
  if (typeof initOverlayScrollbars === 'function') {
    initOverlayScrollbars(panel);
    if (pageView && pageView._mfScrollbar) pageView._mfScrollbar.update();
    if (rootView && rootView._mfScrollbar) rootView._mfScrollbar.update();
  }

  if (!animate) {
    panel.classList.add('settings-no-anim');
    panel.classList.remove('settings-animating');
    panel.classList.remove('settings-back-peek', 'settings-back-from-peek');
    rootView.hidden = false;
    pageView.hidden = false;
    panel.dataset.view = nextView;
    void panel.offsetWidth;
    finishSettingsViewVisibility(panel, rootView, pageView, isRoot);
    panel.classList.remove('settings-no-anim');
  } else {
    // 两层都显示：root 垫底，page 从右滑入/滑出
    panel.classList.add('settings-animating');
    rootView.hidden = false;
    pageView.hidden = false;
    rootView.setAttribute('aria-hidden', isRoot ? 'false' : 'true');
    pageView.setAttribute('aria-hidden', isRoot ? 'true' : 'false');
    rootView.style.pointerEvents = 'none';
    pageView.style.pointerEvents = 'none';

    if (fromPeek && isRoot) {
      // 1) 冻结度20%（不依赖 data-view度      panel.classList.add('settings-back-from-peek');
      panel.classList.remove('settings-back-peek');
      pageView.style.transition = 'none';
      pageView.style.transform = 'translate3d(20%, 0, 0)';
      rootView.style.transition = 'none';
      rootView.style.opacity = '0.42';
      void pageView.offsetWidth;
      // 2) 下一帧放开，从 20% 过渡度100%
      requestAnimationFrame(() => {
        if (token !== settingsNavToken) return;
        panel.classList.remove('settings-back-from-peek');
        pageView.style.transition = '';
        pageView.style.transform = '';
        rootView.style.transition = '';
        rootView.style.opacity = '';
        panel.dataset.view = 'root';
      });
    } else {
      panel.classList.add('settings-no-anim');
      // 落到起始态（无过渡）
      panel.dataset.view = prevView;
      void pageView.offsetWidth;
      panel.classList.remove('settings-no-anim');
      requestAnimationFrame(() => {
        if (token !== settingsNavToken) return;
        requestAnimationFrame(() => {
          if (token !== settingsNavToken) return;
          panel.dataset.view = nextView;
        });
      });
    }

    let settled = false;
    const onDone = () => {
      if (settled || token !== settingsNavToken) return;
      settled = true;
      panel.classList.remove('settings-back-peek', 'settings-back-from-peek');
      pageView.style.transition = '';
      pageView.style.transform = '';
      rootView.style.transition = '';
      rootView.style.opacity = '';
      pageView.removeAttribute('data-slide');
      finishSettingsViewVisibility(panel, rootView, pageView, isRoot);
      settingsNavCleanup = null;
    };

    const onTransitionEnd = (e) => {
      if (e.target !== pageView) return;
      if (e.propertyName !== 'transform') return;
      pageView.removeEventListener('transitionend', onTransitionEnd);
      clearTimeout(fallbackTimer);
      onDone();
    };

    pageView.addEventListener('transitionend', onTransitionEnd);
    const fallbackTimer = setTimeout(onDone, 380);

    settingsNavCleanup = () => {
      pageView.removeEventListener('transitionend', onTransitionEnd);
      clearTimeout(fallbackTimer);
    };
  }

  if (!isRoot) {
    requestAnimationFrame(() => {
      if (token !== settingsNavToken) return;
      const activePage = pageView.querySelector(`.settings-page[data-page="${pageId}"]`);
      const focusable = activePage && activePage.querySelector(
        'button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus({ preventScroll: true });
      else if (backBtn) backBtn.focus({ preventScroll: true });
    });
  }
}
function isRootPageId(pageId) {
  return !pageId || pageId === 'root';
}

/**
 * 返回键悬停预览：二级仍占 80%，左侧露度20% 一级列度 */
function setSettingsBackPeek(enabled) {
  const panel = getSettingsPanel();
  if (!panel) return;
  const reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !enabled) {
    panel.classList.remove('settings-back-peek');
    return;
  }
  // 仅二级页、非导航动画时
  if ((panel.dataset.view || 'root') !== 'page') {
    panel.classList.remove('settings-back-peek');
    return;
  }
  if (
    panel.classList.contains('settings-animating') ||
    panel.classList.contains('settings-no-anim') ||
    panel.classList.contains('settings-back-from-peek')
  ) {
    return;
  }
  // 确保一级层可绘制（opacity 动画可见）
  const rootView = document.getElementById('settingsViewRoot');
  if (rootView) {
    rootView.hidden = false;
    rootView.setAttribute('aria-hidden', 'true');
  }
  panel.classList.add('settings-back-peek');
}

function clearSettingsBackPeek() {
  const panel = getSettingsPanel();
  if (panel) panel.classList.remove('settings-back-peek');
}

function isSettingsBackPeeking() {
  const panel = getSettingsPanel();
  return !!(panel && panel.classList.contains('settings-back-peek'));
}

function bindSettingsNavigation() {
  const panel = getSettingsPanel();
  const backBtn = document.getElementById('settingsBackBtn');
  if (!panel) return;

  panel.querySelectorAll('[data-settings-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearSettingsBackPeek();
      const pageId = btn.getAttribute('data-settings-page');
      if (pageId) navigateSettings(pageId);
    });
  });

  if (backBtn) {
    // pointerdown 先锁定 peek，避免 click 前的 leave 把预览清除
    backBtn.addEventListener('pointerdown', () => {
      if (!backBtn.classList.contains('is-shown')) return;
      if ((panel.dataset.view || 'root') !== 'page') return;
      if (isSettingsBackPeeking()) {
        panel.dataset.backCommit = '1';
      }
    });

    backBtn.addEventListener('click', (e) => {
      if (!backBtn.classList.contains('is-shown')) return;
      e.preventDefault();
      if (panel.dataset.backCommit === '1' && !isSettingsBackPeeking()) {
        setSettingsBackPeek(true);
      }
      // 有历史则回到上一页，否则回一级
      const prevPage = settingsNavHistory.length > 0 ? settingsNavHistory[settingsNavHistory.length - 1] : 'root';
      navigateSettings(prevPage, { back: true });
      delete panel.dataset.backCommit;
    });

    // 悬停预览：二级右度20%；移开回弹（点击返回时不回弹）
    backBtn.addEventListener('pointerenter', () => {
      if (!backBtn.classList.contains('is-shown')) return;
      if ((panel.dataset.view || 'root') !== 'page') return;
      if (panel.classList.contains('settings-animating')) return;
      setSettingsBackPeek(true);
    });
    backBtn.addEventListener('pointerleave', () => {
      // 即将点击返回 / 已在动画中：不要�peek
      if (panel.dataset.backCommit === '1') return;
      if (panel.classList.contains('settings-animating')) return;
      if (panel.classList.contains('settings-back-from-peek')) return;
      clearSettingsBackPeek();
    });
    backBtn.addEventListener('blur', () => {
      if (panel.dataset.backCommit === '1') return;
      if (panel.classList.contains('settings-animating')) return;
      clearSettingsBackPeek();
    });
  }
}

/**
 * 按父选项统一刷新条件启用项（隐藏 = 不可用，不清除已存值）
 */
function refreshSettingsAvailability() {
  syncTypeRoleSettingsUI();
  updateUsernameSettingVisibility();
  updateBgSettingsUI();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
  else if (typeof updateSearchBlurAvailability === 'function') updateSearchBlurAvailability();
}

/**
 * 同步「文字」分区：各区域字体选中�+ 粗细滑块
 */
/** Built-in fonts */
const BUILTIN_FONT_OPTIONS = [
  { value: 'sourcehanserif', label: '\u601d\u6e90\u5b8b\u4f53', family: "'SourceHanSerif', 'Noto Serif SC', 'Source Han Serif SC', serif" },
  { value: 'system', label: '\u7cfb\u7edf\u9ed8\u8ba4', family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
];

const FALLBACK_SYSTEM_FONTS = [
  'Microsoft YaHei UI', 'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong',
  'Segoe UI', 'Arial', 'Tahoma', 'Verdana', 'Times New Roman', 'Georgia',
  'Courier New', 'Consolas', 'PingFang SC', 'Hiragino Sans GB', 'Songti SC',
  'Heiti SC', 'Noto Sans SC', 'Noto Serif SC'
];

let cachedSystemFontList = null;
let systemFontListPromise = null;

function listSystemFonts() {
  if (cachedSystemFontList) return Promise.resolve(cachedSystemFontList);
  if (systemFontListPromise) return systemFontListPromise;
  systemFontListPromise = new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.fontSettings && chrome.fontSettings.getFontList) {
        chrome.fontSettings.getFontList((fonts) => {
          const names = (fonts || [])
            .map((f) => (f && (f.displayName || f.fontId)) || '')
            .map((n) => (typeof normalizeSystemFontName === 'function' ? normalizeSystemFontName(n) : String(n).trim()))
            .filter(Boolean);
          const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
          cachedSystemFontList = uniq.length ? uniq : FALLBACK_SYSTEM_FONTS.slice();
          resolve(cachedSystemFontList);
        });
        return;
      }
    } catch (_) {}
    cachedSystemFontList = FALLBACK_SYSTEM_FONTS.slice();
    resolve(cachedSystemFontList);
  });
  return systemFontListPromise;
}

function buildFontSelectOptions(selectEl, selectedValue, systemFonts) {
  if (!selectEl) return;
  const selected = typeof resolveFontKey === 'function' ? resolveFontKey(selectedValue) : selectedValue;
  const frag = document.createDocumentFragment();

  const builtinGroup = document.createElement('optgroup');
  builtinGroup.label = '\u5185\u7f6e\u5b57\u4f53';
  BUILTIN_FONT_OPTIONS.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.family) option.style.fontFamily = opt.family;
    if (opt.value === selected) option.selected = true;
    builtinGroup.appendChild(option);
  });
  frag.appendChild(builtinGroup);

  const sysGroup = document.createElement('optgroup');
  sysGroup.label = '\u7cfb\u7edf\u5b57\u4f53';
  const list = Array.isArray(systemFonts) ? systemFonts : FALLBACK_SYSTEM_FONTS;
  let hasSelectedSys = false;
  list.forEach((name) => {
    const value = 'sys:' + name;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = name;
    option.style.fontFamily = typeof makeSystemFontFamily === 'function' ? makeSystemFontFamily(name) : name;
    if (value === selected) {
      option.selected = true;
      hasSelectedSys = true;
    }
    sysGroup.appendChild(option);
  });
  if (typeof selected === 'string' && selected.indexOf('sys:') === 0 && !hasSelectedSys) {
    const name = selected.slice(4);
    const option = document.createElement('option');
    option.value = selected;
    option.textContent = name;
    option.selected = true;
    option.style.fontFamily = typeof makeSystemFontFamily === 'function' ? makeSystemFontFamily(name) : name;
    sysGroup.insertBefore(option, sysGroup.firstChild);
  }
  frag.appendChild(sysGroup);

  selectEl.innerHTML = '';
  selectEl.appendChild(frag);
  selectEl.value = selected;
  try {
    selectEl.style.fontFamily = typeof getFontFamily === 'function' ? getFontFamily(selected) : '';
  } catch (_) {}
}

function populateAllFontSelects(roles) {
  const roleMap = roles || (typeof loadTypeRoles === 'function' ? loadTypeRoles() : DEFAULT_TYPE_ROLES);
  return listSystemFonts().then((fonts) => {
    document.querySelectorAll('.type-font-select').forEach((selectEl) => {
      const roleKey = selectEl.dataset.role;
      const role = roleMap[roleKey] || DEFAULT_TYPE_ROLES[roleKey] || {};
      buildFontSelectOptions(selectEl, role.font || 'system', fonts);
    });
    return fonts;
  });
}

function syncTypeRoleSettingsUI() {
  const roles = typeof loadTypeRoles === 'function' ? loadTypeRoles() : DEFAULT_TYPE_ROLES;
  populateAllFontSelects(roles);

  TYPE_ROLE_KEYS.forEach((roleKey) => {
    const role = roles[roleKey] || DEFAULT_TYPE_ROLES[roleKey];
    const fontKey = resolveFontKey(role.font);
    const weight = normalizeWeight(role.weight, (DEFAULT_TYPE_ROLES[roleKey] || {}).weight || '400');
    const size = typeof normalizeTypeSize === 'function'
      ? normalizeTypeSize(role.size, (DEFAULT_TYPE_ROLES[roleKey] || {}).size || 100)
      : 100;

    const selectEl = document.querySelector('.type-font-select[data-role="' + roleKey + '"]');
    if (selectEl && selectEl.options.length) {
      selectEl.value = fontKey;
      try { selectEl.style.fontFamily = typeof getFontFamily === 'function' ? getFontFamily(fontKey) : ''; } catch (_) {}
    }

    const sizeSlider = document.querySelector('.type-size-slider[data-role="' + roleKey + '"]');
    const sizeValueEl = document.querySelector('.type-size-value[data-role="' + roleKey + '"]');
    if (sizeSlider) {
      sizeSlider.value = String(size);
      if (sizeValueEl) sizeValueEl.textContent = size + '%';
    }

    const slider = document.querySelector('.type-weight-slider[data-role="' + roleKey + '"]');
    const weightWrap = document.querySelector('.type-weight[data-role="' + roleKey + '"]');
    const valueEl = document.querySelector('.type-weight-value[data-role="' + roleKey + '"]');
    if (slider) {
      if (weightWrap) {
        const canWeight = typeof fontSupportsWeight === 'function' ? fontSupportsWeight(fontKey) : true;
        if (typeof setSettingsReveal === 'function') setSettingsReveal(weightWrap, canWeight);
        else weightWrap.hidden = !canWeight;
      }
      const sliderVal = weight === '450' ? '500' : weight;
      slider.value = /^(400|500|600|700)$/.test(sliderVal) ? sliderVal : '400';
      if (valueEl) updateWeightLabel(weight === '450' ? '500' : weight, valueEl);
    }
  });
}

/**
 * 打开设置时，�localStorage / 运行时状态同步到面板控件
 */
function syncSettingsPanel() {
  const usernameInput = document.getElementById('usernameInput');
  if (usernameInput) {
    usernameInput.value = currentUsername === DEFAULT_USERNAME ? '' : currentUsername;
  }

  const customTextInput = document.getElementById('customTextInput');
  if (customTextInput) {
    customTextInput.value = currentCustomText || '';
  }
  try { if (typeof updateCustomTextCount === 'function') {
    updateCustomTextCount(customTextInput ? customTextInput.value : currentCustomText);
  } } catch (_) {}
  try { if (typeof updateGreetingSettingsVisibility === 'function') {
    updateGreetingSettingsVisibility();
  } } catch (_) {}
  try { if (typeof updateClockOptionsUI === 'function') {
    updateClockOptionsUI();
  } } catch (_) {}
  try { if (typeof loadQuoteMaxLen === 'function') loadQuoteMaxLen(); } catch (_) {}
  try { if (typeof updateQuoteMaxLenUI === 'function') updateQuoteMaxLenUI(); } catch (_) {}
  try { if (typeof updateGreetingPreview === 'function') {
    updateGreetingPreview();
  } } catch (_) {}

  try { renderCustomEngines(); } catch (_) {}
  initCardSelection('greetingModeGrid', 'moonfog_greeting_mode', DEFAULT_GREETING_MODE);
  initCardSelection('bgModeGrid', BG_MODE_KEY, DEFAULT_BG_MODE);
  try { if (typeof syncGrainSettingsUI === 'function') syncGrainSettingsUI(); } catch (_) {}
  initCardSelection('themeGrid', 'moonfog_tone', DEFAULT_TONE);
  initCardSelection('engineGrid', 'moonfog_engine', DEFAULT_ENGINE);

  try { refreshSettingsAvailability(); } catch (_) {}
  try { if (typeof updateModeToggleUI === 'function') {
    const pref = typeof loadModePref === 'function'
      ? loadModePref()
      : (document.documentElement.getAttribute('data-mode-pref') || localStorage.getItem('moonfog_mode') || DEFAULT_MODE);
    const resolved =
      document.documentElement.getAttribute('data-mode') ||
      localStorage.getItem('moonfog_mode') ||
      DEFAULT_MODE;
    updateModeToggleUI(pref, resolved);
  } } catch (_) {}
  try { updateBgBlurUI(); } catch (_) {}
  try { if (typeof updateBgWashUI === 'function') updateBgWashUI(); } catch (_) {}
  try { if (typeof updateSearchBlurUI === 'function') updateSearchBlurUI(); } catch (_) {}
  try { if (typeof updatePanelBlurUI === 'function') updatePanelBlurUI(); } catch (_) {}
  try { if (typeof updateLowPerfUI === 'function') updateLowPerfUI(); } catch (_) {}
  try { if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability(); } catch (_) {}
  try { renderShortcutList(); } catch (_) {}
  try { updateAboutBannerBg(); } catch (_) {}
  try { updateSettingsBannerBg(); } catch (_) {}
}

/** 打开设置面板 */
function openSettings() {
  hideShortcutContextMenu();
  syncSettingsPanel();
  updateAboutBannerBg();
  updateSettingsBannerBg();

  const panel = getSettingsPanel();
  if (!panel) return;

  panel.classList.add('active');
  panel.setAttribute('aria-hidden', 'false');
  panel.removeAttribute('inert');
  document.body.classList.add('settings-open');
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
  // 焦点陷阱：Tab 不外溢到背景
  if (typeof trapFocus === 'function') trapFocus(panel);
  // 打开时内部回到一级（无内部动画）；整块面板从右侧滑入
  navigateSettings('root', { animate: false });
  requestAnimationFrame(() => {
    const firstNav = document.querySelector('.settings-nav-item');
    if (firstNav) firstNav.focus();
    else {
      const closeBtn = document.getElementById('closeBtn');
      if (closeBtn) closeBtn.focus();
    }
  });
}

/** 关闭设置面板 */
function closeSettings() {
  const panel = getSettingsPanel();
  if (!panel) return;
  if (typeof closeMfColorPicker === 'function') closeMfColorPicker();
  if (typeof releaseFocusTrap === 'function') releaseFocusTrap(panel);
  panel.classList.remove('active');
  panel.setAttribute('aria-hidden', 'true');
  panel.setAttribute('inert', '');
  document.body.classList.remove('settings-open');
  // 关闭时内部复位到一级；整块面板原路滑回右侧（设置按钮方向）
  navigateSettings('root', { animate: false });
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.setAttribute('aria-expanded', 'false');
    if (panel.contains(document.activeElement)) {
      settingsBtn.focus();
    }
  }
}

function bindSettingsChrome() {
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeBtn');
  const panel = getSettingsPanel();

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (isSettingsOpen()) closeSettings();
      else openSettings();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeSettings());
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isSettingsOpen()) return;
    const shortcutModal = document.getElementById('shortcutModal');
    if (shortcutModal && shortcutModal.classList.contains('active')) return;
    const engineModal = document.getElementById('engineModal');
    if (engineModal && engineModal.classList.contains('active')) return;
    closeSettings();
  });

  document.addEventListener('mousedown', (e) => {
    if (!isSettingsOpen() || !panel) return;
    if (panel.contains(e.target)) return;
    if (settingsBtn && settingsBtn.contains(e.target)) return;
    const colorPopover = document.getElementById('mfColorPopover');
    if (colorPopover && colorPopover.contains(e.target)) return;
    const shortcutModal = document.getElementById('shortcutModal');
    if (shortcutModal && shortcutModal.contains(e.target)) return;
    const engineModal = document.getElementById('engineModal');
    if (engineModal && engineModal.contains(e.target)) return;
    closeSettings();
  });
}

function bindUsernameSetting() {
  const usernameInput = document.getElementById('usernameInput');
  if (!usernameInput) return;

  usernameInput.addEventListener('input', () => {
    const name = usernameInput.value.trim();
    currentUsername = name || DEFAULT_USERNAME;
    if (name) localStorage.setItem('moonfog_username', name);
    else localStorage.removeItem('moonfog_username');
    if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
    else if (typeof updateGreetingPreview === 'function') updateGreetingPreview();
  });
}

function bindCustomTextSetting() {
  const customTextInput = document.getElementById('customTextInput');
  if (!customTextInput) return;

  customTextInput.addEventListener('input', () => {
    if (typeof updateCustomTextCount === 'function') {
      updateCustomTextCount(customTextInput.value);
    }
    const text = typeof normalizeCustomText === 'function'
      ? normalizeCustomText(customTextInput.value)
      : String(customTextInput.value || '').trim();
    currentCustomText = text;
    if (text) localStorage.setItem(CUSTOM_TEXT_KEY, text);
    else localStorage.removeItem(CUSTOM_TEXT_KEY);
    if (currentGreetingMode === GREETING_MODES.custom) {
      if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
      else if (typeof updateGreetingPreview === 'function') updateGreetingPreview();
    } else if (typeof updateGreetingPreview === 'function') {
      updateGreetingPreview();
    }
  });
}

function bindGreetingModeSetting() {
  initCardClick('greetingModeGrid', 'moonfog_greeting_mode', (value) => {
    localStorage.setItem('moonfog_greeting_mode', value);
    applyGreetingMode(value, true);
  });
}

function bindClockOptionsSetting() {
  const hourSeg = document.getElementById('clockHour12Segment');
  if (hourSeg && hourSeg.dataset.bound !== '1') {
    hourSeg.dataset.bound = '1';
    hourSeg.querySelectorAll('[data-clock-hour12]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hour12 = btn.getAttribute('data-clock-hour12') === '1';
        if (typeof saveClockHour12 === 'function') saveClockHour12(hour12);
        if (typeof applyClockOptionsChange === 'function') applyClockOptionsChange();
        else {
          if (typeof updateClockOptionsUI === 'function') updateClockOptionsUI();
          if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
        }
      });
    });
  }

  const dateSeg = document.getElementById('clockShowDateSegment');
  if (dateSeg && dateSeg.dataset.bound !== '1') {
    dateSeg.dataset.bound = '1';
    dateSeg.querySelectorAll('[data-clock-show-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const show = btn.getAttribute('data-clock-show-date') === '1';
        if (typeof saveClockShowDate === 'function') saveClockShowDate(show);
        if (typeof applyClockOptionsChange === 'function') applyClockOptionsChange();
        else {
          if (typeof updateClockOptionsUI === 'function') updateClockOptionsUI();
          if (typeof updateGreetingDisplay === 'function') updateGreetingDisplay();
        }
      });
    });
  }
}

function bindQuoteOptionsSetting() {
  const slider = document.getElementById('quoteMaxLenSlider');
  if (slider && slider.dataset.bound !== '1') {
    slider.dataset.bound = '1';
    const apply = () => {
      const maxLen = typeof saveQuoteMaxLen === 'function'
        ? saveQuoteMaxLen(slider.value)
        : Number(slider.value) || 32;
      if (typeof updateQuoteMaxLenUI === 'function') updateQuoteMaxLenUI();
      // 当前句超限则立刻换下一句
      if (
        typeof currentGreetingMode !== 'undefined' &&
        typeof GREETING_MODES !== 'undefined' &&
        currentGreetingMode === GREETING_MODES.quote &&
        typeof cachedDailyQuote !== 'undefined' &&
        cachedDailyQuote &&
        typeof isQuoteAcceptable === 'function' &&
        !isQuoteAcceptable(cachedDailyQuote, { maxLen, avoidRecent: false })
      ) {
        if (typeof switchDailyQuote === 'function') switchDailyQuote();
      }
    };
    slider.addEventListener('input', () => {
      if (typeof updateQuoteMaxLenUI === 'function') {
        // 仅更新标签预�        const label = document.getElementById('quoteMaxLenValue');
        if (label) label.textContent = String(slider.value) + ' �';
      }
    });
    slider.addEventListener('change', apply);
  }
}

const GRAIN_SHAPE_LABELS = {
  corners: '四角',
  wave: '波浪',
  dots: '点阵',
  truchet: '嵌片',
  ripple: '涟漪',
  blob: '团块',
  sphere: '球体'
};

const GRAIN_COLOR_PRESETS = [
  '#f6f1ea', '#f4e6be', '#e8cf92', '#d8b569',
  '#17140f', '#3b3122', '#66502d', '#a47b39',
  '#f8ede8', '#eceee5', '#e8f0f5', '#ede8f0',
  '#e8e9ec', '#c45c4a', '#4a7c6f', '#5b6b8c'
];

const grainColorState = {
  back: '#f6f1ea',
  colors: ['#f4e6be', '#e8cf92', '#d8b569', '#f4e6be', '#a47b39', '#e8cf92', '#d8b569'],
  colorCount: 4
};

const mfColorPicker = {
  open: false,
  slot: null,
  anchor: null,
  h: 0,
  s: 0,
  v: 100,
  hex: '#000000',
  dragging: false
};

function getGrainPaletteMode() {
  return document.documentElement.getAttribute('data-mode') === 'dark' ? 'dark' : 'light';
}

function getGrainSlotColor(slot) {
  if (slot === 'back') return grainColorState.back;
  const index = Number(slot);
  if (Number.isInteger(index) && grainColorState.colors[index]) {
    return grainColorState.colors[index];
  }
  return '#888888';
}

function setGrainSlotColor(slot, hex) {
  const color = normalizeHexColor(hex, getGrainSlotColor(slot));
  if (slot === 'back') {
    grainColorState.back = color;
  } else {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 0 || index > 6) return color;
    grainColorState.colors[index] = color;
  }
  return color;
}

function paintGrainSwatches() {
  document.querySelectorAll('[data-grain-fill]').forEach((el) => {
    const slot = el.getAttribute('data-grain-fill');
    el.style.backgroundColor = getGrainSlotColor(slot);
  });
  document.querySelectorAll('.grain-swatch[data-grain-slot]').forEach((btn) => {
    const slot = btn.getAttribute('data-grain-slot');
    const open = mfColorPicker.open && mfColorPicker.slot === slot;
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function commitGrainPalette() {
  if (!window.GrainBackground || typeof window.GrainBackground.updateSettings !== 'function') {
    return;
  }
  window.GrainBackground.updateSettings({
    mode: getGrainPaletteMode(),
    colorBack: grainColorState.back,
    colors: grainColorState.colors.slice(),
    colorCount: grainColorState.colorCount
  });
}

function ensureMfColorPresets() {
  const host = document.getElementById('mfColorPresets');
  if (!host || host.dataset.ready === '1') return;
  host.dataset.ready = '1';
  host.innerHTML = '';
  GRAIN_COLOR_PRESETS.forEach((hex) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mf-color-preset';
    btn.style.backgroundColor = hex;
    btn.dataset.hex = hex;
    btn.setAttribute('aria-label', hex);
    btn.title = hex;
    host.appendChild(btn);
  });
}

function paintMfColorPickerUI() {
  const sv = document.getElementById('mfColorSv');
  const cursor = document.getElementById('mfColorSvCursor');
  const hue = document.getElementById('mfColorHue');
  const preview = document.getElementById('mfColorPreview');
  const hexInput = document.getElementById('mfColorHex');
  const hex = hsvToHex(mfColorPicker.h, mfColorPicker.s, mfColorPicker.v);
  mfColorPicker.hex = hex;

  if (sv) {
    sv.style.background =
      'linear-gradient(to top, #000, transparent),' +
      'linear-gradient(to right, #fff, transparent),' +
      'hsl(' + Math.round(mfColorPicker.h) + ' 100% 50%)';
  }
  if (cursor) {
    cursor.style.left = clamp01(mfColorPicker.s / 100) * 100 + '%';
    cursor.style.top = (1 - clamp01(mfColorPicker.v / 100)) * 100 + '%';
    cursor.style.backgroundColor = hex;
  }
  if (hue && document.activeElement !== hue) {
    hue.value = String(Math.round(mfColorPicker.h));
  }
  if (preview) preview.style.backgroundColor = hex;
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = hex.toUpperCase();
  }
  document.querySelectorAll('.mf-color-preset').forEach((btn) => {
    const active = normalizeHexColor(btn.dataset.hex, '') === hex;
    btn.classList.toggle('is-active', active);
  });
}

function positionMfColorPopover(anchor) {
  const pop = document.getElementById('mfColorPopover');
  if (!pop || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const width = pop.offsetWidth || 228;
  const height = pop.offsetHeight || 280;
  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.bottom + gap;
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12);
  if (top + height > window.innerHeight - 12) {
    top = Math.max(12, rect.top - height - gap);
  }
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
}

function closeMfColorPicker() {
  if (!mfColorPicker.open) return;
  mfColorPicker.open = false;
  mfColorPicker.slot = null;
  mfColorPicker.anchor = null;
  mfColorPicker.dragging = false;
  const pop = document.getElementById('mfColorPopover');
  if (pop) pop.hidden = true;
  paintGrainSwatches();
}

function applyMfColorLive() {
  const hex = hsvToHex(mfColorPicker.h, mfColorPicker.s, mfColorPicker.v);
  mfColorPicker.hex = hex;
  if (mfColorPicker.slot != null) {
    setGrainSlotColor(mfColorPicker.slot, hex);
    paintGrainSwatches();
    commitGrainPalette();
  }
  paintMfColorPickerUI();
}

function setMfColorFromHex(hex, options = {}) {
  const next = normalizeHexColor(hex, mfColorPicker.hex);
  const rgb = hexToRgb(next);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  mfColorPicker.h = hsv.h;
  mfColorPicker.s = hsv.s;
  mfColorPicker.v = hsv.v;
  mfColorPicker.hex = next;
  if (options.commit !== false) applyMfColorLive();
  else paintMfColorPickerUI();
}

function setMfColorFromSvEvent(event) {
  const sv = document.getElementById('mfColorSv');
  if (!sv) return;
  const rect = sv.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = clamp01((event.clientX - rect.left) / rect.width);
  const y = clamp01((event.clientY - rect.top) / rect.height);
  mfColorPicker.s = x * 100;
  mfColorPicker.v = (1 - y) * 100;
  applyMfColorLive();
}

function openMfColorPicker(slot, anchor) {
  const pop = document.getElementById('mfColorPopover');
  if (!pop || !anchor) return;
  ensureMfColorPresets();
  if (mfColorPicker.open && mfColorPicker.slot === slot) {
    closeMfColorPicker();
    return;
  }
  mfColorPicker.open = true;
  mfColorPicker.slot = slot;
  mfColorPicker.anchor = anchor;
  setMfColorFromHex(getGrainSlotColor(slot), { commit: false });
  pop.hidden = false;
  paintGrainSwatches();
  positionMfColorPopover(anchor);
  paintMfColorPickerUI();
  const hexInput = document.getElementById('mfColorHex');
  if (hexInput) {
    requestAnimationFrame(() => {
      try { hexInput.focus({ preventScroll: true }); } catch (_) {}
    });
  }
}

function ensureGrainSwatches() {
  const list = document.getElementById('grainColorList');
  if (!list) return;
  const count = Math.min(Math.max(Number(grainColorState.colorCount) || 4, 2), 7);
  list.dataset.ready = '1';
  const slots = [{ slot: 'back', label: '背景' }];
  for (let i = 0; i < count; i++) {
    slots.push({ slot: String(i), label: `�${i + 1}` });
  }
  list.innerHTML = '';
  slots.forEach(({ slot, label }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grain-swatch';
    btn.setAttribute('data-grain-slot', slot);
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', 'false');
    const fill = document.createElement('span');
    fill.className = 'grain-swatch-fill';
    fill.setAttribute('data-grain-fill', slot);
    const text = document.createElement('span');
    text.className = 'grain-swatch-label';
    text.textContent = label;
    btn.appendChild(fill);
    btn.appendChild(text);
    list.appendChild(btn);
  });
}

function bindMfColorPicker() {
  if (window.__moonfogColorPickerBound) return;
  window.__moonfogColorPickerBound = true;

  ensureGrainSwatches();

  const pop = document.getElementById('mfColorPopover');
  const sv = document.getElementById('mfColorSv');
  const hue = document.getElementById('mfColorHue');
  const hexInput = document.getElementById('mfColorHex');
  const presets = document.getElementById('mfColorPresets');
  const list = document.getElementById('grainColorList');
  if (!pop) return;

  ensureMfColorPresets();

  if (list) {
    list.addEventListener('click', (event) => {
      const btn = event.target.closest('.grain-swatch[data-grain-slot]');
      if (!btn || !list.contains(btn)) return;
      event.preventDefault();
      openMfColorPicker(btn.getAttribute('data-grain-slot'), btn);
    });
  }

  if (sv) {
    sv.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      mfColorPicker.dragging = true;
      try { sv.setPointerCapture(event.pointerId); } catch (_) {}
      setMfColorFromSvEvent(event);
    });
    sv.addEventListener('pointermove', (event) => {
      if (!mfColorPicker.dragging) return;
      setMfColorFromSvEvent(event);
    });
    const endDrag = (event) => {
      if (!mfColorPicker.dragging) return;
      mfColorPicker.dragging = false;
      try { sv.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    sv.addEventListener('pointerup', endDrag);
    sv.addEventListener('pointercancel', endDrag);
  }

  if (hue) {
    hue.addEventListener('input', () => {
      mfColorPicker.h = Number(hue.value) || 0;
      applyMfColorLive();
    });
  }

  if (hexInput) {
    hexInput.addEventListener('input', () => {
      const raw = hexInput.value.trim();
      if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)) return;
      setMfColorFromHex(raw);
    });
    hexInput.addEventListener('change', () => {
      setMfColorFromHex(hexInput.value);
      hexInput.value = mfColorPicker.hex.toUpperCase();
    });
    hexInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        setMfColorFromHex(hexInput.value);
        hexInput.blur();
      }
    });
  }

  if (presets) {
    presets.addEventListener('click', (event) => {
      const btn = event.target.closest('.mf-color-preset');
      if (!btn || !presets.contains(btn)) return;
      setMfColorFromHex(btn.dataset.hex || btn.style.backgroundColor);
    });
  }

  document.addEventListener('mousedown', (event) => {
    if (!mfColorPicker.open) return;
    if (pop.contains(event.target)) return;
    if (event.target.closest && event.target.closest('.grain-swatch[data-grain-slot]')) return;
    closeMfColorPicker();
  });

  document.addEventListener('keydown', (event) => {
    if (!mfColorPicker.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMfColorPicker();
    }
  }, true);

  window.addEventListener('resize', () => {
    if (mfColorPicker.open && mfColorPicker.anchor) {
      positionMfColorPopover(mfColorPicker.anchor);
    }
  });

  const pageView = document.getElementById('settingsViewPage');
  if (pageView) {
    pageView.addEventListener('scroll', () => {
      if (mfColorPicker.open && mfColorPicker.anchor) {
        positionMfColorPopover(mfColorPicker.anchor);
      }
    }, { passive: true });
  }
}

function syncGrainSettingsUI(settings) {
  if (!window.GrainBackground || typeof window.GrainBackground.getSettings !== 'function') {
    return;
  }
  const config = settings || window.GrainBackground.getSettings();
  const mode = getGrainPaletteMode();
  const palette = config && config[mode];
  if (!palette) return;

  const modeLabel = document.getElementById('grainPaletteMode');
  const speed = document.getElementById('grainSpeedSlider');
  const noise = document.getElementById('grainNoiseSlider');
  const softness = document.getElementById('grainSoftnessSlider');
  const intensity = document.getElementById('grainIntensitySlider');
  const offsetX = document.getElementById('grainOffsetXSlider');
  const offsetY = document.getElementById('grainOffsetYSlider');
  const speedValue = document.getElementById('grainSpeedValue');
  const noiseValue = document.getElementById('grainNoiseValue');
  const softnessValue = document.getElementById('grainSoftnessValue');
  const intensityValue = document.getElementById('grainIntensityValue');
  const offsetXValue = document.getElementById('grainOffsetXValue');
  const offsetYValue = document.getElementById('grainOffsetYValue');
  const offsetMeta = document.getElementById('grainOffsetMeta');
  const shapeValue = document.getElementById('grainShapeValue');
  const shape = config.shape || 'corners';
  const ox = Number(config.offsetX) || 0;
  const oy = Number(config.offsetY) || 0;

  grainColorState.back = normalizeHexColor(palette.colorBack, grainColorState.back);
  grainColorState.colors = [0, 1, 2, 3, 4, 5, 6].map((index) =>
    normalizeHexColor(
      Array.isArray(palette.colors) ? palette.colors[index] : null,
      grainColorState.colors[index]
    )
  );
  const newCount = Math.min(Math.max(Number(config.colorCount) || 4, 2), 7);
  if (newCount !== grainColorState.colorCount) {
    grainColorState.colorCount = newCount;
    ensureGrainSwatches();
    syncGrainColorCountSegment();
  }
  paintGrainSwatches();
  if (mfColorPicker.open && mfColorPicker.slot != null) {
    setMfColorFromHex(getGrainSlotColor(mfColorPicker.slot), { commit: false });
  }

  if (modeLabel) modeLabel.textContent = mode === 'dark' ? '深色模式' : '浅色模式';
  document.querySelectorAll('[data-grain-shape]').forEach((btn) => {
    const active = btn.getAttribute('data-grain-shape') === shape;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  if (shapeValue) shapeValue.textContent = GRAIN_SHAPE_LABELS[shape] || shape;
  if (speed) speed.value = String(config.speed);
  if (noise) noise.value = String(config.noise);
  if (softness) softness.value = String(config.softness ?? 100);
  if (intensity) intensity.value = String(config.intensity ?? 100);
  if (offsetX) offsetX.value = String(ox);
  if (offsetY) offsetY.value = String(oy);
  if (speedValue) speedValue.textContent = `${config.speed}%`;
  if (noiseValue) noiseValue.textContent = `${config.noise}%`;
  if (softnessValue) softnessValue.textContent = `${config.softness ?? 100}%`;
  if (intensityValue) intensityValue.textContent = `${config.intensity ?? 100}%`;
  if (offsetXValue) {
    offsetXValue.textContent = ox === 0 ? '度' : ox > 0 ? `度${ox}` : `度${Math.abs(ox)}`;
  }
  if (offsetYValue) {
    offsetYValue.textContent = oy === 0 ? '度' : oy > 0 ? `度${oy}` : `度${Math.abs(oy)}`;
  }
  if (offsetMeta) {
    if (ox === 0 && oy === 0) offsetMeta.textContent = '居中';
    else {
      const parts = [];
      if (ox) parts.push(ox > 0 ? `度{ox}` : `度{Math.abs(ox)}`);
      if (oy) parts.push(oy > 0 ? `度{oy}` : `度{Math.abs(oy)}`);
      offsetMeta.textContent = parts.join(' · ');
    }
  }
}

function syncGrainColorCountSegment() {
  const seg = document.getElementById('grainColorCountSegment');
  if (!seg) return;
  seg.querySelectorAll('[data-color-count]').forEach((btn) => {
    const value = Number(btn.getAttribute('data-color-count'));
    const checked = value === grainColorState.colorCount;
    btn.setAttribute('aria-checked', checked ? 'true' : 'false');
    btn.classList.toggle('is-active', checked);
  });
}

function setGrainColorCount(count) {
  const next = Math.min(Math.max(Number(count) || 4, 2), 7);
  if (next === grainColorState.colorCount) return;
  grainColorState.colorCount = next;
  ensureGrainSwatches();
  syncGrainColorCountSegment();
  paintGrainSwatches();
  commitGrainPalette();
}

function bindGrainSettings() {
  const speedSlider = document.getElementById('grainSpeedSlider');
  const noiseSlider = document.getElementById('grainNoiseSlider');
  const softnessSlider = document.getElementById('grainSoftnessSlider');
  const intensitySlider = document.getElementById('grainIntensitySlider');
  const offsetXSlider = document.getElementById('grainOffsetXSlider');
  const offsetYSlider = document.getElementById('grainOffsetYSlider');
  const shapeGrid = document.getElementById('grainShapeGrid');
  const reset = document.getElementById('grainResetBtn');
  const colorCountSeg = document.getElementById('grainColorCountSegment');

  const updateGrainSettings = (patch) => {
    if (window.GrainBackground && typeof window.GrainBackground.updateSettings === 'function') {
      window.GrainBackground.updateSettings(patch);
    }
  };

  const bindGrainSlider = (el, key) => {
    if (!el || el.dataset.boundGrain === '1') return;
    el.dataset.boundGrain = '1';
    el.addEventListener('input', () => {
      updateGrainSettings({ [key]: el.value });
    });
  };

  bindMfColorPicker();
  syncGrainColorCountSegment();

  if (colorCountSeg && colorCountSeg.dataset.boundGrain !== '1') {
    colorCountSeg.dataset.boundGrain = '1';
    colorCountSeg.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-color-count]');
      if (!btn || !colorCountSeg.contains(btn)) return;
      setGrainColorCount(btn.getAttribute('data-color-count'));
    });
  }

  if (shapeGrid && shapeGrid.dataset.boundGrain !== '1') {
    shapeGrid.dataset.boundGrain = '1';
    shapeGrid.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-grain-shape]');
      if (!btn || !shapeGrid.contains(btn)) return;
      const shape = btn.getAttribute('data-grain-shape');
      if (!shape) return;
      updateGrainSettings({ shape });
    });
  }

  bindGrainSlider(speedSlider, 'speed');
  bindGrainSlider(noiseSlider, 'noise');
  bindGrainSlider(softnessSlider, 'softness');
  bindGrainSlider(intensitySlider, 'intensity');
  bindGrainSlider(offsetXSlider, 'offsetX');
  bindGrainSlider(offsetYSlider, 'offsetY');

  if (reset && reset.dataset.boundGrain !== '1') {
    reset.dataset.boundGrain = '1';
    reset.addEventListener('click', () => {
      closeMfColorPicker();
      if (window.GrainBackground && typeof window.GrainBackground.resetSettings === 'function') {
        syncGrainSettingsUI(window.GrainBackground.resetSettings());
      }
    });
  }
  if (!window.__moonfogGrainSettingsBound) {
    window.__moonfogGrainSettingsBound = true;
    window.addEventListener('grain-settings-change', (event) => {
      syncGrainSettingsUI(event.detail);
    });
  }
  syncGrainSettingsUI();
}

function bindBackgroundSetting() {
  initCardClick('bgModeGrid', BG_MODE_KEY, (value) => {
    applyBackgroundMode(value);
  });

  const bgLocalPick = document.getElementById('bgLocalPick');
  const bgLocalInput = document.getElementById('bgLocalInput');
  const bgLocalClear = document.getElementById('bgLocalClear');
  const bgLocalTip = document.getElementById('bgLocalTip');
  bindGrainSettings();
  // 背景模糊滑块统一题bindDisplaySetting 绑定，避免双�input

  if (bgLocalPick && bgLocalInput) {
    bgLocalPick.addEventListener('click', () => bgLocalInput.click());
    bgLocalInput.addEventListener('change', async () => {
      const file = bgLocalInput.files && bgLocalInput.files[0];
      bgLocalInput.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        if (bgLocalTip) bgLocalTip.textContent = '请选择图片文件';
        return;
      }
      try {
        if (bgLocalTip) bgLocalTip.textContent = '正在处理图片�';
        const dataUrl = await compressImageFile(file);
        saveLocalBackground(dataUrl);
        if (bgLocalTip) bgLocalTip.textContent = '已应用本地图片（仅保存在本机�';
        await applyBackgroundMode('local');
        initCardSelection('bgModeGrid', BG_MODE_KEY, DEFAULT_BG_MODE);
      } catch (err) {
        if (bgLocalTip) bgLocalTip.textContent = err.message || '图片处理失败';
      }
    });
  }

  if (bgLocalClear) {
    bgLocalClear.addEventListener('click', async () => {
      // 破坏性操作：先确�      if (!window.confirm('确定要清除已上传的本地背景图片吗？此操作不可撤销题')) return;
      clearLocalBackground();
      if (bgLocalTip) bgLocalTip.textContent = '已清除本地图�';
      await applyBackgroundMode('local');
    });
  }

  const bgBingShuffle = document.getElementById('bgBingShuffle');
  if (bgBingShuffle && !bgBingShuffle.dataset.bound) {
    bgBingShuffle.dataset.bound = '1';
    bgBingShuffle.addEventListener('click', async () => {
      if (typeof shuffleBingWallpaper === 'function') {
        await shuffleBingWallpaper();
      }
    });
  }
}


function bindDisplaySetting() {
  const bgSlider = document.getElementById('bgBlurSlider');
  const washSlider = document.getElementById('bgWashSlider');
  const searchSlider = document.getElementById('searchBlurSlider');
  const panelSlider = document.getElementById('panelBlurSlider');
  const lowSeg = document.getElementById('lowPerfSegment');

  if (bgSlider && !bgSlider.dataset.boundDisplay) {
    bgSlider.dataset.boundDisplay = '1';
    bgSlider.addEventListener('input', () => {
      if (typeof applyBgBlur === 'function') applyBgBlur(bgSlider.value);
    });
  }

  if (washSlider && !washSlider.dataset.boundDisplay) {
    washSlider.dataset.boundDisplay = '1';
    washSlider.addEventListener('input', () => {
      if (typeof applyBgWash === 'function') applyBgWash(washSlider.value);
    });
  }

  if (searchSlider && !searchSlider.dataset.bound) {
    searchSlider.dataset.bound = '1';
    searchSlider.addEventListener('input', () => {
      if (typeof applySearchBlur === 'function') applySearchBlur(searchSlider.value);
    });
  }
  if (panelSlider && !panelSlider.dataset.bound) {
    panelSlider.dataset.bound = '1';
    panelSlider.addEventListener('input', () => {
      if (typeof applyPanelBlur === 'function') applyPanelBlur(panelSlider.value);
    });
  }
  if (lowSeg && !lowSeg.dataset.bound) {
    lowSeg.dataset.bound = '1';
    lowSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-perf], [data-low-perf]');
      if (!btn || !lowSeg.contains(btn)) return;
      let mode = btn.getAttribute('data-perf');
      if (!mode) {
        mode = btn.getAttribute('data-low-perf') === '1' ? 'low' : 'full';
      }
      if (typeof applyPerfMode === 'function') applyPerfMode(mode);
      else if (typeof applyLowPerfMode === 'function') applyLowPerfMode(mode === 'low');
    });
  }
}

/** 自定义色调暂未开放：占位色块 + 提示 */
function bindThemeSetting() {
  // 若仍停留在已下线�custom，回退默认色调
  try {
    if (localStorage.getItem('moonfog_tone') === 'custom') {
      localStorage.setItem('moonfog_tone', DEFAULT_TONE || 'sand');
    }
  } catch (_) {}

  initCardClick('themeGrid', 'moonfog_tone', (value) => {
    if (value === 'custom') return; // 自定义暂未开放
    const pref = typeof loadModePref === 'function'
      ? loadModePref()
      : (document.documentElement.getAttribute('data-mode-pref') || localStorage.getItem('moonfog_mode') || DEFAULT_MODE);
    applyTheme(value, pref, { animate: true });
  });

  const customBtn = document.getElementById('toneCustomBtn');
  if (customBtn) {
    // 不用 disabled（会�click 监听失效）；保留 aria-disabled + is-disabled 表达「未开放�    customBtn.setAttribute('aria-disabled', 'true');
    customBtn.classList.add('is-disabled');
    customBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tip = document.getElementById('toneSettingTip');
      if (tip) {
        tip.textContent = '自定义暂未开�';
        tip.classList.add('is-notice');
        clearTimeout(customBtn._tipTimer);
        customBtn._tipTimer = setTimeout(() => {
          tip.textContent = '仅纯色背景生题';
          tip.classList.remove('is-notice');
        }, 1800);
      }
    });
  }

  const applyMode = (newMode) => {
    let tone = localStorage.getItem('moonfog_tone') || DEFAULT_TONE;
    if (tone === 'custom') tone = DEFAULT_TONE || 'sand';
    let pref = typeof normalizeModePref === 'function'
      ? normalizeModePref(newMode)
      : (newMode || 'light');
    // 当前背景没有可取样场景时，「壁纸」模式改为系统�    const unsupportedBg =
      (typeof isImageBackgroundActive === 'function' && !isImageBackgroundActive());
    if (pref === 'wallpaper' && unsupportedBg) {
      pref = 'system';
      const tip = document.getElementById('modeSettingTip');
      if (tip) tip.textContent = '当前背景无壁纸场景，已改为跟随系题';
    }
    applyTheme(tone, pref, { animate: true });
  };

  // 分段明暗：浅�/ 深色 / 系统 / 壁纸
  const modeSegment = document.getElementById('modeSegment');
  if (modeSegment) {
    modeSegment.querySelectorAll('.mode-segment-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyMode(btn.getAttribute('data-mode'));
      });
    });
  }

  // 兼容旧按钮：�light/dark 间切换固定偏�  const modeToggle = document.getElementById('modeToggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      const currentMode =
        document.documentElement.getAttribute('data-mode') ||
        localStorage.getItem('moonfog_mode') ||
        DEFAULT_MODE;
      applyMode(currentMode === 'light' ? 'dark' : 'light');
    });
  }
}

/**
 * 绑定各文字区域的字体 / 粗细控件
 */
function bindFontSetting() {
  document.querySelectorAll('.type-font-select').forEach((selectEl) => {
    if (selectEl.dataset.bound) return;
    selectEl.dataset.bound = '1';
    selectEl.addEventListener('change', () => {
      const roleKey = selectEl.dataset.role;
      if (!roleKey) return;
      const fontKey = resolveFontKey(selectEl.value);
      applyTypeRole(roleKey, { font: fontKey });
      try { selectEl.style.fontFamily = typeof getFontFamily === 'function' ? getFontFamily(fontKey) : ''; } catch (_) {}
      const weightWrap = document.querySelector('.type-weight[data-role="' + roleKey + '"]');
      if (weightWrap) {
        const canWeight = typeof fontSupportsWeight === 'function' ? fontSupportsWeight(fontKey) : true;
        if (typeof setSettingsReveal === 'function') setSettingsReveal(weightWrap, canWeight);
        else weightWrap.hidden = !canWeight;
      }
    });
  });

  populateAllFontSelects();

  document.querySelectorAll('.type-weight-slider').forEach((slider) => {
    const roleKey = slider.dataset.role;
    if (!roleKey) return;
    const valueEl = document.querySelector('.type-weight-value[data-role="' + roleKey + '"]');
    slider.addEventListener('input', () => {
      const weight = slider.value;
      if (valueEl) updateWeightLabel(weight, valueEl);
      applyTypeRole(roleKey, { weight });
    });
    slider.addEventListener('change', () => {
      applyTypeRole(roleKey, { weight: slider.value });
    });
  });

  document.querySelectorAll('.type-size-slider').forEach((slider) => {
    if (slider.dataset.bound) return;
    slider.dataset.bound = '1';
    const roleKey = slider.dataset.role;
    if (!roleKey) return;
    const valueEl = document.querySelector('.type-size-value[data-role="' + roleKey + '"]');
    const applySize = () => {
      const size = typeof normalizeTypeSize === 'function'
        ? normalizeTypeSize(slider.value, 100)
        : Number(slider.value) || 100;
      if (valueEl) valueEl.textContent = size + '%';
      applyTypeRole(roleKey, { size });
    };
    slider.addEventListener('input', applySize);
    slider.addEventListener('change', applySize);
  });
}

/** 重置时保留的缓存键（壁纸 / 一言）；欢迎标记会清掉以便再引导 */
const DATA_RESET_KEEP = {
  moonfog_bg_bing: 1,
  moonfog_bg_bing_pool: 1,
  moonfog_bg_palette: 1,
  moonfog_quote_pool: 1,
  moonfog_quote_recent: 1,
  moonfog_daily_quote: 1
};

function collectMoonFogData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('moonfog_') === 0) {
        data[k] = localStorage.getItem(k);
      }
    }
  } catch (_) {}
  return data;
}

function exportMoonFogData() {
  const tip = document.getElementById('importDataTip');
  try {
    const payload = {
      app: 'MoonFog',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: collectMoonFogData()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'moonfog-backup-' + day + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (tip) {
      tip.hidden = false;
      tip.textContent = '已导出备份文�';
    }
    return true;
  } catch (err) {
    if (tip) {
      tip.hidden = false;
      tip.textContent = '导出失败';
    }
    return false;
  }
}

function importMoonFogData(file) {
  const tip = document.getElementById('importDataTip');
  if (!file) return Promise.resolve(false);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      if (tip) {
        tip.hidden = false;
        tip.textContent = '读取文件失败';
      }
      resolve(false);
    };
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const bag =
          parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object'
            ? parsed.data
            : parsed;
        if (!bag || typeof bag !== 'object') {
          if (tip) {
            tip.hidden = false;
            tip.textContent = '文件格式不正�';
          }
          resolve(false);
          return;
        }
        let count = 0;
        Object.keys(bag).forEach((k) => {
          if (!k || k.indexOf('moonfog_') !== 0) return;
          const v = bag[k];
          if (v == null) return;
          try {
            localStorage.setItem(k, String(v));
            count += 1;
          } catch (_) {}
        });
        if (tip) {
          tip.hidden = false;
          tip.textContent = count ? '已导出' + count + ' 项，正在刷新' : '没有可导入的数据';
        }
        if (count) {
          window.setTimeout(() => {
            try {
              window.location.reload();
            } catch (_) {
              window.location.href = window.location.href;
            }
          }, 220);
        }
        resolve(count > 0);
      } catch (err) {
        if (tip) {
          tip.hidden = false;
          tip.textContent = 'JSON 解析失败';
        }
        resolve(false);
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * 清除偏好并刷新（保留壁纸/一言缓存；欢迎标记强制清除）
 */
function resetAllSettingsToDefaults() {
  const tip = document.getElementById('resetDefaultsTip');
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('moonfog_') === 0 && !DATA_RESET_KEEP[k]) keys.push(k);
    }
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
    });
    // 强制清欢迎完成标记（不依赖 keep 列表）
    try {
      localStorage.removeItem(
        typeof OOBE_DONE_KEY === 'string' ? OOBE_DONE_KEY : 'moonfog_oobe_done'
      );
    } catch (_) {}
  } catch (err) {
    if (tip) tip.textContent = '清除失败，请手动刷新后重�';
    return false;
  }
  if (tip) tip.textContent = '已重置，正在刷新�';
  window.setTimeout(() => {
    try {
      window.location.reload();
    } catch (_) {
      window.location.href = window.location.href;
    }
  }, 180);
  return true;
}

function bindDataSettings() {
  const exportBtn = document.getElementById('exportDataBtn');
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = '1';
    exportBtn.addEventListener('click', () => exportMoonFogData());
  }

  const importBtn = document.getElementById('importDataBtn');
  const importInput = document.getElementById('importDataInput');
  if (importBtn && importInput && !importBtn.dataset.bound) {
    importBtn.dataset.bound = '1';
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      importInput.value = '';
      if (file) importMoonFogData(file);
    });
  }

  const btn = document.getElementById('resetDefaultsBtn');
  const tip = document.getElementById('resetDefaultsTip');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  let confirmTimer = 0;
  const label = btn.querySelector('span:last-child') || btn;
  const defaultTip = '';

  const resetConfirmState = () => {
    btn.classList.remove('is-confirm');
    if (label) label.textContent = '重置设置';
    btn.setAttribute('aria-label', '重置设置');
    if (tip) tip.textContent = defaultTip;
    if (confirmTimer) {
      window.clearTimeout(confirmTimer);
      confirmTimer = 0;
    }
  };

  btn.addEventListener('click', () => {
    if (!btn.classList.contains('is-confirm')) {
      btn.classList.add('is-confirm');
      if (label) label.textContent = '再点一次确�';
      btn.setAttribute('aria-label', '再点一次确认重�');
      if (tip) tip.textContent = '再点一次将清空偏好并刷新，进入欢迎引导';
      confirmTimer = window.setTimeout(resetConfirmState, 4000);
      return;
    }
    resetConfirmState();
    resetAllSettingsToDefaults();
  });
}

function initSettings() {
  if (typeof initOverlayScrollbars === 'function') initOverlayScrollbars(document);
  bindSettingsChrome();
  bindSettingsNavigation();
  bindUsernameSetting();
  bindCustomTextSetting();
  bindGreetingModeSetting();
  bindClockOptionsSetting();
  bindQuoteOptionsSetting();
  bindBackgroundSetting();
  bindDisplaySetting();
  bindThemeSetting();
  bindFontSetting();
  bindDataSettings();
  initEngineSettings();
  initShortcutSettings();
  if (typeof bindImportBookmarksUI === 'function') bindImportBookmarksUI();
  if (typeof initDisplayEffects === 'function') initDisplayEffects();
  if (typeof syncSurfaceBlurAvailability === 'function') syncSurfaceBlurAvailability();
  bindAboutBannerUpdates();
}

/**
 * 更新关于页面横幅背景：直接使用必应每日一题 */
function updateAboutBannerBg() {
  const banner = document.getElementById('aboutBanner');
  const imageEl = document.getElementById('aboutBannerImage');
  const overlayEl = document.getElementById('aboutBannerOverlay');
  if (!banner || !imageEl) return;

  imageEl.style.cssText = '';
  if (overlayEl) overlayEl.style.cssText = '';

  // 始终使用必应每日一图
  let imgUrl = '';
  try {
    const cached = JSON.parse(localStorage.getItem('bing_daily_cache') || '{}');
    if (cached.imageUrl) imgUrl = cached.imageUrl;
  } catch (_) {}
  if (!imgUrl && typeof currentBingMeta !== 'undefined' && currentBingMeta?.imageUrl) {
    imgUrl = currentBingMeta.imageUrl;
  }

  if (imgUrl) {
    imageEl.style.backgroundImage = 'url("' + imgUrl + '")';
    imageEl.style.backgroundSize = 'cover';
    imageEl.style.backgroundPosition = 'center';
    return;
  }

  fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN')
    .then(r => r.json())
    .then(data => {
      const relativeUrl = data?.images?.[0]?.url;
      if (relativeUrl) {
        const url = 'https://www.bing.com' + relativeUrl;
        imageEl.style.backgroundImage = 'url("' + url + '")';
        imageEl.style.backgroundSize = 'cover';
        imageEl.style.backgroundPosition = 'center';
      }
    })
    .catch(() => {});
}

/**
 * 更新设置页顶部横幅：复用关于页横幅逻辑 */
function updateSettingsBannerBg() {
  const banner = document.getElementById('settingsBanner');
  const imageEl = document.getElementById('settingsBannerImage');
  const overlayEl = document.getElementById('settingsBannerOverlay');
  if (!banner || !imageEl) return;

  imageEl.style.cssText = '';
  if (overlayEl) overlayEl.style.cssText = '';

  // 始终使用必应每日一图
  let imgUrl = '';
  try {
    const cached = JSON.parse(localStorage.getItem('bing_daily_cache') || '{}');
    if (cached.imageUrl) imgUrl = cached.imageUrl;
  } catch (_) {}
  if (!imgUrl && typeof currentBingMeta !== 'undefined' && currentBingMeta?.imageUrl) {
    imgUrl = currentBingMeta.imageUrl;
  }

  if (imgUrl) {
    imageEl.style.backgroundImage = 'url("' + imgUrl + '")';
    imageEl.style.backgroundSize = 'cover';
    imageEl.style.backgroundPosition = 'center';
    return;
  }

  fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN')
    .then(r => r.json())
    .then(data => {
      const relativeUrl = data?.images?.[0]?.url;
      if (relativeUrl) {
        const url = 'https://www.bing.com' + relativeUrl;
        imageEl.style.backgroundImage = 'url("' + url + '")';
        imageEl.style.backgroundSize = 'cover';
        imageEl.style.backgroundPosition = 'center';
      }
    })
    .catch(() => {});
}

// 当背景模式或色调变化时，更新横幅背景
function bindAboutBannerUpdates() {
  // 监听背景模式变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'moonfog_bg_mode' || e.key === 'moonfog_tone') {
      updateAboutBannerBg();
    }
  });

  // 监听主题变化
  const observer = new MutationObserver(() => {
    updateAboutBannerBg();
    updateSettingsBannerBg();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

  // 监听自定义事件（背景切换时触发）
  if (!window.__aboutBannerBound) {
    window.__aboutBannerBound = true;
    window.addEventListener('bg-mode-change', updateAboutBannerBg);
    window.addEventListener('tone-change', updateAboutBannerBg);
    window.addEventListener('mode-change', () => { updateAboutBannerBg(); updateSettingsBannerBg(); });
  }
}
