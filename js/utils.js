/**
 * MoonFog - 通用工具
 */

/** 转义 HTML 文本，避免用户输入注�*/
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 转义 HTML 属性�*/
function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

/**
 * 同步单选卡片的 aria-checked
 */
function syncRadioSelection(grid) {
  if (!grid) return;
  grid.querySelectorAll('[data-value]').forEach((item) => {
    if (item.getAttribute('role') === 'radio') {
      item.setAttribute(
        'aria-checked',
        item.classList.contains('active') ? 'true' : 'false'
      );
    }
  });
}

/**
 * 图标三级回退：网�-> 本地 -> 首字� */
function fallbackIcon(img, fallbackChar) {
  if (!img._triedLocal) {
    img._triedLocal = true;
    const local = img.dataset.local;
    if (local) {
      img.src = local;
      return;
    }
  }
  // 本地也失败，隐藏图片显示首字母
  img.style.display = 'none';
  let span = img.nextElementSibling;
  if (!span || !span.classList.contains('engine-favicon-initial')) {
    span = document.createElement('span');
    span.className = 'engine-favicon-initial';
    span.textContent = fallbackChar;
    img.parentNode.insertBefore(span, img.nextSibling);
  } else {
    span.style.display = 'flex';
  }
}

/**
 * 初始化卡�/ 列表选择态（�localStorage 高亮当前项）
 */
function initCardSelection(gridId, storageKey, defaultValue) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  let savedValue = localStorage.getItem(storageKey) || defaultValue;
  // 色调：验证并规范化
  if (storageKey === 'moonfog_tone' && typeof resolveToneKey === 'function') {
    savedValue = resolveToneKey(savedValue);
  }
  // 背景模式：local/bing 是「图片」卡的子态，映射成 image 再校验——
  // 否则校验失败会把真实模式抹成空串，重启后 initBackground 读到 '' 退回纯色
  if (storageKey === 'moonfog_bg_mode' && (savedValue === 'local' || savedValue === 'bing')) {
    savedValue = 'image';
  }
  // 防呆：验证 savedValue 是否属于 grid 内的有效选项，无效则回退 defaultValue
  const validValues = Array.from(grid.querySelectorAll('[data-value]')).map(item => item.dataset.value);
  if (validValues.length > 0 && validValues.indexOf(savedValue) === -1) {
    savedValue = defaultValue;
    // 只有非空默认值才落盘：写空串会把有效模式抹掉（initCardClick 默认值就是 ''）
    if (defaultValue) {
      try { localStorage.setItem(storageKey, defaultValue); } catch (_) {}
    }
  }

  grid.querySelectorAll('[data-value]').forEach((item) => {
    item.classList.toggle('active', item.dataset.value === savedValue);
  });
  syncRadioSelection(grid);
}

/**
 * 绑定卡片 / 列表项点击（互斥 active + 回调 + 键盘支持� * @param {string} gridId
 * @param {string} storageKey
 * @param {function(string):void} callback
 * @param {object} options
 * @param {boolean} options.keyboard - 启用键盘导航 (Enter/Space)
 * @param {boolean} options.rovingTabindex - 使用 roving tabindex 模式
 */
function initCardClick(gridId, storageKey, callback, options = {}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const { keyboard = true, rovingTabindex = false } = options;

  const items = grid.querySelectorAll('[data-value]');
  items.forEach((item, index) => {
    if (keyboard) {
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
        if (rovingTabindex) {
          let targetIndex = index;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') targetIndex = (index + 1) % items.length;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') targetIndex = (index - 1 + items.length) % items.length;
          else return;
          e.preventDefault();
          items[targetIndex].focus();
        }
      });
      if (rovingTabindex) {
        item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      }
    }

    item.addEventListener('click', () => {
      items.forEach((c) => {
        c.classList.remove('active');
        if (rovingTabindex) c.setAttribute('tabindex', '-1');
      });
      item.classList.add('active');
      if (rovingTabindex) item.setAttribute('tabindex', '0');
      syncRadioSelection(grid);
      callback(item.dataset.value);
    });
  });

  // 初始化选中态
  initCardSelection(gridId, storageKey, '');
}

/**
 * 分段控件（Segment）工具：单选按钮组
 * @param {string} segmentId - 容器 ID
 * @param {string} storageKey - 存储� * @param {function(string):void} callback - 值变化回� * @param {object} options
 * @param {string} options.attr - 属性名 (默认 'data-value')
 * @param {boolean} options.keyboard - 键盘导航
 */
function initSegment(segmentId, storageKey, callback, options = {}) {
  const segment = document.getElementById(segmentId);
  if (!segment) return;

  const { attr = 'data-value', keyboard = true } = options;
  const buttons = segment.querySelectorAll(`[${attr}]`);

  // 从存储恢复选中
  const saved = getStorage(storageKey);
  if (saved) {
    buttons.forEach(btn => {
      const active = btn.getAttribute(attr) === saved;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  buttons.forEach((btn, index) => {
    if (keyboard) {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    }
    btn.addEventListener('click', () => {
      const value = btn.getAttribute(attr);
      buttons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      setStorage(storageKey, value);
      callback(value);
    });
  });
}

/**
 * 滑块同步工具：滑�<-> 数值显�<-> 存储
 * @param {string} sliderId - 滑块 input ID
 * @param {object} options
 * @param {string} options.storageKey - 存储� * @param {number} options.min - 最小� * @param {number} options.max - 最大� * @param {number} options.step - 步长
 * @param {string} options.valueId - 数值显示元�ID (可�
 * @param {function(number):string} options.formatValue - 格式化显示�(可�
 * @param {function(number):void} options.onChange - 值变化回� * @param {boolean} options.live - input 事件实时回调 (默认 false，只�change 触发)
 */
function initSlider(sliderId, options) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  const {
    storageKey, min = 0, max = 100, step = 1,
    valueId, formatValue = v => String(v),
    onChange, live = false
  } = options;

  const valueEl = valueId ? document.getElementById(valueId) : null;

  // 从存储恢复
  const saved = getStorageTyped(storageKey, null, 'number');
  if (saved !== null) {
    slider.value = String(clampNumber(saved, min, max, min));
  }

  const updateUI = () => {
    if (valueEl) valueEl.textContent = formatValue(Number(slider.value));
  };

  const commit = () => {
    const val = Number(slider.value);
    setStorageTyped(storageKey, val, 'number');
    updateUI();
    if (onChange) onChange(val);
  };

  if (live) {
    slider.addEventListener('input', updateUI);
    slider.addEventListener('change', commit);
  } else {
    slider.addEventListener('change', commit);
  }

  updateUI();
  return { commit, updateUI };
}


/**
 * 收集容器内可聚焦元素（可见且�disabled� */
function getFocusableElements(root) {
  if (!root) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return Array.prototype.filter.call(root.querySelectorAll(selector), (el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
  });
}

/**
 * �modal 内安装焦点陷阱：Tab/Shift+Tab 不外溢到背景
 */
function trapFocus(modal) {
  if (!modal || modal._mfFocusTrapBound) return;
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !modal.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !modal.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  modal.addEventListener('keydown', handler);
  modal._mfFocusTrapBound = true;
  modal._mfFocusTrapHandler = handler;
}

/**
 * 释放焦点陷阱
 */
function releaseFocusTrap(modal) {
  if (!modal || !modal._mfFocusTrapBound) return;
  modal.removeEventListener('keydown', modal._mfFocusTrapHandler);
  delete modal._mfFocusTrapBound;
  delete modal._mfFocusTrapHandler;
}

/**
 * 打开通用 modal（统一 active / aria / 焦点 / 焦点陷阱� */
function openModal(modal, focusEl) {
  if (!modal) return;
  modal.classList.add('active');
  if (typeof initOverlayScrollbars === 'function') {
    const body = modal.querySelector('.modal-body');
    if (body) {
      initOverlayScrollbars(modal);
      requestAnimationFrame(() => body._mfScrollbar && body._mfScrollbar.update());
    }
  }
  modal.setAttribute('aria-hidden', 'false');
  modal.removeAttribute('inert');
  trapFocus(modal);
  if (focusEl) {
    setTimeout(() => {
      try { focusEl.focus(); focusEl.select && focusEl.select(); } catch (_) {}
    }, 30);
  }
}

/**
 * 关闭通用 modal（释放焦点陷阱并恢复焦点� */
function closeModal(modal, restoreEl) {
  if (!modal) return;
  const hadFocus = modal.contains(document.activeElement);
  releaseFocusTrap(modal);
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('inert', '');
  if (hadFocus && restoreEl && typeof restoreEl.focus === 'function') {
    try { restoreEl.focus(); } catch (_) {}
  }
}

/**
 * 设置 modal 错误提示
 */
function setModalError(errorEl, message, invalidEls) {
  const list = Array.isArray(invalidEls) ? invalidEls : (invalidEls ? [invalidEls] : []);
  list.forEach((el) => {
    if (!el) return;
    el.classList.remove('is-invalid');
  });
  if (!errorEl) return false;
  if (!message) {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
    return false;
  }
  errorEl.textContent = message;
  errorEl.classList.add('is-visible');
  list.forEach((el) => {
    if (el) el.classList.add('is-invalid');
  });
  return true;
}

/**
 * 清理 modal 校验� */
function clearModalValidation(errorEl, fields) {
  setModalError(errorEl, '', fields);
}


/**
 * 覆盖式自定义滚动条：不占用布局宽度，避免内容被原生滚动条顶开� * 返回 { update, destroy }
 */
function attachOverlayScrollbar(scroller, options) {
  if (!scroller || scroller.dataset.mfScrollbar === '1') {
    return scroller && scroller._mfScrollbar ? scroller._mfScrollbar : null;
  }

  const opts = options || {};
  const host = opts.host || scroller.parentElement;
  if (!host) return null;

  const hostStyle = window.getComputedStyle(host);
  if (hostStyle.position === 'static') host.style.position = 'relative';

  const bar = document.createElement('div');
  bar.className = 'mf-scrollbar';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="mf-scrollbar-track"><div class="mf-scrollbar-thumb"></div></div>';
  host.appendChild(bar);

  const track = bar.querySelector('.mf-scrollbar-track');
  const thumb = bar.querySelector('.mf-scrollbar-thumb');

  let hideTimer = null;
  let dragging = false;
  let dragStartY = 0;
  let dragStartTop = 0;
  let metrics = { trackH: 0, thumbH: 0, maxTop: 0, maxScroll: 0 };

  const show = () => {
    bar.classList.add('is-visible');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!dragging && !bar.matches(':hover')) bar.classList.remove('is-visible');
    }, opts.hideDelay || 900);
  };

  const update = () => {
    const viewH = scroller.clientHeight;
    const contentH = scroller.scrollHeight;
    const maxScroll = Math.max(0, contentH - viewH);
    const needed = maxScroll > 1;

    bar.hidden = !needed;
    bar.style.display = needed ? '' : 'none';
    if (!needed) {
      scroller.dataset.mfScrollbarNeeded = '0';
      return;
    }
    scroller.dataset.mfScrollbarNeeded = '1';

    const trackH = track.clientHeight || bar.clientHeight || viewH;
    const thumbH = Math.max(28, Math.round((viewH / contentH) * trackH));
    const maxTop = Math.max(0, trackH - thumbH);
    const top = maxScroll > 0 ? (scroller.scrollTop / maxScroll) * maxTop : 0;

    metrics = { trackH, thumbH, maxTop, maxScroll };
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = 'translateY(' + top + 'px)';
  };

  const onScroll = () => {
    update();
    show();
  };

  const onPointerDownThumb = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    bar.classList.add('is-dragging', 'is-active');
    dragStartY = e.clientY;
    const matrix = /translateY\(([-0-9.]+)px\)/.exec(thumb.style.transform || '');
    dragStartTop = matrix ? parseFloat(matrix[1]) : 0;
    try { thumb.setPointerCapture(e.pointerId); } catch (_) {}
    show();
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const dy = e.clientY - dragStartY;
    const nextTop = Math.min(metrics.maxTop, Math.max(0, dragStartTop + dy));
    if (metrics.maxTop > 0 && metrics.maxScroll > 0) {
      scroller.scrollTop = (nextTop / metrics.maxTop) * metrics.maxScroll;
    }
    show();
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('is-dragging', 'is-active');
    try { thumb.releasePointerCapture(e.pointerId); } catch (_) {}
    show();
  };

  const onTrackPointerDown = (e) => {
    if (e.target === thumb) return;
    e.preventDefault();
    const rect = track.getBoundingClientRect();
    const y = e.clientY - rect.top - metrics.thumbH / 2;
    const nextTop = Math.min(metrics.maxTop, Math.max(0, y));
    if (metrics.maxTop > 0 && metrics.maxScroll > 0) {
      scroller.scrollTop = (nextTop / metrics.maxTop) * metrics.maxScroll;
    }
    show();
  };

  scroller.addEventListener('scroll', onScroll, { passive: true });
  scroller.addEventListener('pointerenter', show);
  scroller.addEventListener('wheel', show, { passive: true });
  bar.addEventListener('pointerenter', () => bar.classList.add('is-hover'));
  bar.addEventListener('pointerleave', () => bar.classList.remove('is-hover'));
  thumb.addEventListener('pointerdown', onPointerDownThumb);
  track.addEventListener('pointerdown', onTrackPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', update);

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => update());
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
  }

  scroller.dataset.mfScrollbar = '1';
  const api = {
    update,
    show,
    destroy() {
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('pointerenter', show);
      scroller.removeEventListener('wheel', show);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
      delete scroller.dataset.mfScrollbar;
      delete scroller._mfScrollbar;
    }
  };
  scroller._mfScrollbar = api;
  requestAnimationFrame(update);
  return api;
}

function initOverlayScrollbars(root) {
  const scope = root || document;
  const nodes = scope.querySelectorAll
    ? scope.querySelectorAll('[data-overlay-scroll], .settings-view, .modal-body')
    : [];
  nodes.forEach((el) => {
    if (!el || el.dataset.mfScrollbar === '1') {
      if (el && el._mfScrollbar) el._mfScrollbar.update();
      return;
    }
    // only attach when element can scroll / is intended scroller
    attachOverlayScrollbar(el, { host: el.parentElement });
  });
}


/**
 * 条件设置项展开/收起（与 CSS .settings-reveal 配合� * 进出同一�transition：收起度= 下移 6px + 透明 + max-height 0
 * show=true 进入；false 镜像退出。返回是否发生状态变化� */
function setSettingsReveal(el, show, options) {
  if (!el) return false;
  const opts = options || {};
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enterMs = opts.enterMs || 280;
  const exitMs = opts.exitMs || 280;
  const isHidden = el.hasAttribute('hidden') || el.hidden === true;
  const isLeaving = el.classList.contains('is-leaving');
  const isEntering = el.classList.contains('is-entering');

  if (el._revealTimer) {
    clearTimeout(el._revealTimer);
    el._revealTimer = null;
  }
  if (el._revealRaf) {
    cancelAnimationFrame(el._revealRaf);
    el._revealRaf = null;
  }

  const updateScrollbar = () => {
    const scroller = el.closest('.settings-view');
    if (scroller && scroller._mfScrollbar) scroller._mfScrollbar.update();
  };

  if (show) {
    if (!isHidden && !isLeaving && !isEntering && !opts.force) return false;
    if (reduce || opts.silent) {
      el.classList.remove('is-entering', 'is-leaving');
      el.hidden = false;
      el.removeAttribute('hidden');
      updateScrollbar();
      return true;
    }
    // 先锁收起态，再清 is-leaving / is-entering，避免中途打断时弹一下
    el.classList.add('is-entering');
    el.classList.remove('is-leaving');
    el.hidden = false;
    el.removeAttribute('hidden');
    void el.offsetWidth;
    el._revealRaf = requestAnimationFrame(() => {
      el._revealRaf = requestAnimationFrame(() => {
        el._revealRaf = null;
        el.classList.remove('is-entering');
      });
    });
    el._revealTimer = setTimeout(() => {
      el.classList.remove('is-entering');
      el._revealTimer = null;
      updateScrollbar();
    }, enterMs);
    return true;
  }

  if ((isHidden || isLeaving) && !opts.force) return false;
  el.classList.remove('is-entering');
  if (reduce || opts.silent) {
    el.classList.remove('is-leaving');
    el.hidden = true;
    el.setAttribute('hidden', '');
    updateScrollbar();
    return true;
  }

  el.classList.add('is-leaving');
  void el.offsetWidth;
  el._revealTimer = setTimeout(() => {
    if (!el.classList.contains('is-leaving')) return;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.classList.remove('is-leaving');
    el._revealTimer = null;
    updateScrollbar();
  }, exitMs);
  return true;
}

function setSettingsRevealMany(entries) {
  (entries || []).forEach((item) => {
    if (!item) return;
    if (Array.isArray(item)) setSettingsReveal(item[0], item[1], item[2]);
    else if (item.el) setSettingsReveal(item.el, item.show, item.options);
  });
}

/** 检�prefers-reduced-motion，全局复用避免重复�matchMedia */
function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 通用 clamp：Number(value) �Math.min(max, Math.max(min, Math.round(n)))，失败返�fallback */
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 安全读取 localStorage �JSON.parse，失败返�fallback */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/** 安全写入 localStorage JSON.stringify，失败不抛错 */
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

/** rgbToHex：统一版本，r,g,b 为数字，输出小写 #rrggbb，clamp 度0-255，取度*/
function rgbToHex(r, g, b) {
  const toByte = (n) => {
    const v = Math.min(255, Math.max(0, Math.round(Number(n) || 0)));
    return v.toString(16).padStart(2, '0');
  };
  return ('#' + toByte(r) + toByte(g) + toByte(b)).toLowerCase();
}

/**
 * 安全读取 localStorage 字符串，失败返回 fallback
 */
function getStorage(key, fallback = '') {
  try {
    const val = localStorage.getItem(key);
    return val == null ? fallback : val;
  } catch (_) {
    return fallback;
  }
}

/**
 * 安全写入 localStorage 字符串，失败不抛� */
function setStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 删除 localStorage � */
function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 带类型转换的 localStorage 读取
 * @param {string} key
 * @param {any} fallback
 * @param {'string'|'number'|'boolean'|'json'} type
 */
function getStorageTyped(key, fallback, type = 'string') {
  const raw = getStorage(key, null);
  if (raw === null) return fallback;
  try {
    switch (type) {
      case 'number': return Number(raw);
      case 'boolean': return raw === '1' || raw === 'true';
      case 'json': return JSON.parse(raw);
      default: return raw;
    }
  } catch (_) {
    return fallback;
  }
}

/**
 * 带类型转换的 localStorage 写入
 */
function setStorageTyped(key, value, type = 'string') {
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
 * 通用数值归一化：clamp �[min, max]，取整，失败返回 fallback
 */
function normalizeNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * 布尔值归一化：支持 '1'/'0', 'true'/'false', true/false, 1/0
 */
function normalizeBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

/**
 * 十六进制颜色归一化：#rrggbb �#rgb �#rrggbb (小写)
 */
function normalizeHexColor(value, fallback = '#000000') {
  let raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    raw = raw.split('').map(c => c + c).join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(raw)) return String(fallback).toLowerCase();
  return ('#' + raw).toLowerCase();
}

/**
 * 解析十六进制颜色�RGB 对象
 */
function hexToRgb(hex) {
  const n = normalizeHexColor(hex, '#000000').slice(1);
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16)
  };
}

/**
 * RGB �HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * HSL 度RGB
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
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hk + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hk) * 255),
    b: Math.round(hue2rgb(p, q, hk - 1/3) * 255)
  };
}

/**
 * RGB �HSV
 */
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

/**
 * HSV 度RGB
 */
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(1, Math.max(0, s / 100));
  v = Math.min(1, Math.max(0, v / 100));
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * HSV �Hex
 */
function hsvToHex(h, s, v) {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * 相对亮度（sRGB��），用于对比度计� */
function relativeLuminance(r, g, b) {
  const toLinear = c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * 两色对比度比 (WCAG)
 */
function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 颜色混合（color-mix 简易实现）
 * @param {string} color1 - #rrggbb
 * @param {string} color2 - #rrggbb
 * @param {number} weight - 0-100，color1 的权度 */
function mixColors(color1, color2, weight) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const w = Math.min(100, Math.max(0, weight)) / 100;
  const inv = 1 - w;
  return rgbToHex(
    Math.round(c1.r * w + c2.r * inv),
    Math.round(c1.g * w + c2.g * inv),
    Math.round(c1.b * w + c2.b * inv)
  );
}

/**
 * 颜色加深/变浅
 */
function shadeColor(hex, percent) {
  const rgb = hexToRgb(hex);
  const factor = Math.min(100, Math.max(-100, percent)) / 100;
  return rgbToHex(
    Math.round(rgb.r + (255 - rgb.r) * factor),
    Math.round(rgb.g + (255 - rgb.g) * factor),
    Math.round(rgb.b + (255 - rgb.b) * factor)
  );
}

/**
 * 十六进制�RGBA 字符� */
function hexToRgba(hex, alpha = 1) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * 检查颜色是否为深色
 */
function isDarkColor(hex) {
  const rgb = hexToRgb(hex);
  return relativeLuminance(rgb.r, rgb.g, rgb.b) < 0.5;
}

/**
 * 获取对比色（度白）
 */
function getContrastColor(hex) {
  return isDarkColor(hex) ? '#FFFFFF' : '#000000';
}

/**
 * 防抖函数
 */
function debounce(fn, ms = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * 节流函数
 */
function throttle(fn, ms = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

/**
 * 安全添加事件监听器（自动绑定 this，返回清理函数）
 */
function on(el, event, handler, options) {
  if (!el) return () => {};
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * 批量绑定事件（同一选择器下的多个元素）
 */
function onAll(selector, event, handler, options, root = document) {
  const els = root.querySelectorAll(selector);
  const cleanups = [];
  els.forEach(el => cleanups.push(on(el, event, handler, options)));
  return () => cleanups.forEach(fn => fn());
}

/**
 * 单次事件监听（自动移除）
 */
function once(el, event, handler, options) {
  if (!el) return;
  const wrapped = (...args) => {
    el.removeEventListener(event, wrapped, options);
    handler(...args);
  };
  el.addEventListener(event, wrapped, options);
}

/**
 * 创建带清理功能的 MutationObserver
 */
function observeMutations(target, callback, options = { childList: true, subtree: true }) {
  if (!target || typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(target, options);
  return () => observer.disconnect();
}

/**
 * 等待元素出现
 */
function waitForElement(selector, root = document, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = root.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = root.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

/**
 * 安全执行函数（捕获错误，可�fallback� */
function safeCall(fn, fallback, ...args) {
  try {
    return fn(...args);
  } catch (e) {
    return fallback;
  }
}

/**
 * 异步安全执行
 */
async function safeCallAsync(fn, fallback, ...args) {
  try {
    return await fn(...args);
  } catch (e) {
    return fallback;
  }
}

/**
 * 单次绑定事件：绑定后自动标记，防止重复绑� * @param {HTMLElement} el - 目标元素
 * @param {string} event - 事件类型
 * @param {Function} handler - 处理函数
 * @param {object} options - addEventListener 选项
 * @param {string} markAttr - 标记属性名 (默认 'data-bound')
 */
function bindOnce(el, event, handler, options, markAttr = 'data-bound') {
  if (!el || el.hasAttribute(markAttr)) return;
  el.setAttribute(markAttr, '1');
  el.addEventListener(event, handler, options);
}

/**
 * 批量单次绑定
 * @param {string} selector - 选择� * @param {string} event - 事件类型
 * @param {Function} handler - 处理函数 (接收 element 作为参数)
 * @param {object} options - addEventListener 选项
 * @param {string} markAttr - 标记属性名
 * @param {HTMLElement} root - 查找根节� */
function bindOnceAll(selector, event, handler, options, markAttr = 'data-bound', root = document) {
  const els = root.querySelectorAll(selector);
  els.forEach(el => bindOnce(el, event, () => handler(el), options, markAttr));
}

/**
 * 生成唯一 ID（基于时间戳 + 随机数）
 */
function uniqueId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 深拷贝（简易版，仅支持 JSON 兼容类型� */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 对象浅合� */
function merge(target, ...sources) {
  const result = { ...target };
  sources.forEach(src => {
    if (src) Object.keys(src).forEach(k => { result[k] = src[k]; });
  });
  return result;
}

/**
 * 获取 CSS 变量� */
function getCssVar(name, element = document.documentElement) {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

/**
 * 设置 CSS 变量� */
function setCssVar(name, value, element = document.documentElement) {
  element.style.setProperty(name, value);
}

/**
 * 批量设置 CSS 变量
 */
function setCssVars(vars, element = document.documentElement) {
  Object.entries(vars).forEach(([k, v]) => element.style.setProperty(k, v));
}

/**
 * 移除 CSS 变量
 */
function removeCssVar(name, element = document.documentElement) {
  element.style.removeProperty(name);
}

/**
 * 批量移除 CSS 变量
 */
function removeCssVars(names, element = document.documentElement) {
  names.forEach(name => element.style.removeProperty(name));
}

/**
 * 检查元素是否在视口度 */
function isInViewport(el, threshold = 0) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return (
    rect.bottom >= threshold &&
    rect.right >= threshold &&
    rect.top <= (window.innerHeight - threshold) &&
    rect.left <= (window.innerWidth - threshold)
  );
}

/**
 * 格式化数字（添加千分位分隔符� */
function formatNumber(num) {
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 截断字符串（支持中英文混排）
 */
function truncate(str, maxLen, suffix = '…') {
  const s = String(str);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - suffix.length) + suffix;
}

/**
 * 生成随机整数 [min, max]
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从数组中随机选取一个元� */
function randomPick(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[randomInt(0, arr.length - 1)];
}

/**
 * 数组去重（基度key 函数� */
function uniqBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 数组分组
 */
function groupBy(arr, keyFn) {
  return arr.reduce((groups, item) => {
    const key = keyFn(item);
    (groups[key] = groups[key] || []).push(item);
    return groups;
  }, {});
}

/**
 * CSS 变量注入工具：构建并注入主题样式
 * @param {object} options
 * @param {object} options.vars - CSS 变量键值对 { '--var-name': 'value' }
 * @param {string} options.selector - 选择器前缀 (默认 'html')
 * @param {object} options.attrs - 属性选择�{ 'data-tone': 'sand', 'data-mode': 'dark' }
 * @param {string} options.styleId - style 元素 ID (用于更新/移除)
 * @param {HTMLElement} options.target - 插入目标 (默认 document.head)
 * @param {boolean} options.prepend - 是否插入到头�(默认 true)
 */
function injectCssVars(options) {
  const {
    vars = {},
    selector = 'html',
    attrs = {},
    styleId,
    target = document.head,
    prepend = true
  } = options;

  let css = selector;
  if (Object.keys(attrs).length) {
    const attrParts = Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`);
    css += attrParts.join('');
  }
  css += '{';
  Object.entries(vars).forEach(([k, v]) => {
    css += `${k}:${v};`;
  });
  css += '}';

  let style = styleId ? document.getElementById(styleId) : null;
  if (style) {
    style.textContent = css;
    return style;
  }

  style = document.createElement('style');
  if (styleId) style.id = styleId;
  style.textContent = css;

  if (prepend && target.firstChild) {
    target.insertBefore(style, target.firstChild);
  } else {
    target.appendChild(style);
  }
  return style;
}

/**
 * 移除注入�CSS 变量样式
 */
function removeInjectedCssVars(styleId) {
  const style = document.getElementById(styleId);
  if (style) style.remove();
}

/**
 * 构建主题 CSS 变量字符串（用于内联 style题 * @param {object} vars - CSS 变量对象
 * @param {object} attrs - 属性选择� * @param {string} baseSelector - 基础选择� */
function buildThemeCss(vars, attrs = {}, baseSelector = 'html') {
  let css = baseSelector;
  if (Object.keys(attrs).length) {
    const attrParts = Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`);
    css += attrParts.join('');
  }
  css += '{';
  Object.entries(vars).forEach(([k, v]) => {
    css += `${k}:${v};`;
  });
  css += '}';
  return css;
}

/**
 * 应用主题变量到元素（内联 style题 * @param {object} vars - CSS 变量对象
 * @param {HTMLElement} element - 目标元素 (默认 document.documentElement)
 */
function applyThemeVars(vars, element = document.documentElement) {
  Object.entries(vars).forEach(([k, v]) => {
    element.style.setProperty(k, v);
  });
}

/**
 * 同步 theme-color meta 标签
 */
function syncThemeColorMeta(color) {
  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.setAttribute('content', color);
}

/**
 * 同步 color-scheme
 */
function syncColorScheme(isDark) {
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

/**
 * DOM 元素缓存器：避免重复 querySelector/getElementById
 * @param {string|HTMLElement} selector - 选择器或元素
 * @param {HTMLElement} root - 查找根节� * @returns {HTMLElement|null}
 */
const _domCache = new Map();
function $(selector, root = document) {
  if (selector instanceof HTMLElement) return selector;
  const key = root === document ? selector : `${selector}@${root}`;
  if (_domCache.has(key)) return _domCache.get(key);
  const el = typeof selector === 'string' ? root.querySelector(selector) : selector;
  if (el) _domCache.set(key, el);
  return el;
}
function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}
function clearDomCache(selector) {
  if (selector) _domCache.delete(selector);
  else _domCache.clear();
}

/**
 * 安全获取元素属�� */
function getVal(el, prop = 'value') {
  if (!el) return '';
  return el[prop] ?? el.getAttribute(prop) ?? '';
}
function setVal(el, value, prop = 'value') {
  if (!el) return;
  if (prop === 'value') el.value = value;
  else el.setAttribute(prop, value);
}

/**
 * 安全切换 class
 */
function toggleClass(el, className, force) {
  if (!el) return false;
  return el.classList.toggle(className, force);
}
function addClass(el, ...classNames) {
  if (!el) return;
  el.classList.add(...classNames);
}
function removeClass(el, ...classNames) {
  if (!el) return;
  el.classList.remove(...classNames);
}
function hasClass(el, className) {
  return el ? el.classList.contains(className) : false;
}

/**
 * 批量设置属� */
function setAttrs(el, attrs) {
  if (!el || !attrs) return;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) el.removeAttribute(k);
    else el.setAttribute(k, v);
  });
}

/**
 * 创建元素的简易工� * @param {string} tag - 标签� * @param {object} attrs - 属� * @param {string|HTMLElement|Array} children - 子节� */
function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  const append = (child) => {
    if (!child) return;
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (Array.isArray(child)) child.forEach(append);
    else el.appendChild(child);
  };
  append(children);
  return el;
}

/**
 * HTML 字符串转元素
 */
function htmlToEl(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/**
 * 表单数据序列� */
function formDataToObj(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (data[k]) {
      if (!Array.isArray(data[k])) data[k] = [data[k]];
      data[k].push(v);
    } else data[k] = v;
  });
  return data;
}

/**
 * 表单重置 + 错误清理
 */
function resetForm(form, errorEl) {
  if (form) form.reset();
  if (errorEl && typeof clearModalValidation === 'function') {
    const inputs = form ? form.querySelectorAll('input, select, textarea') : [];
    clearModalValidation(errorEl, Array.from(inputs));
  }
}

/**
 * 输入防抖：仅在用户停止输入后触发
 */
function debouncedInput(el, handler, ms = 300) {
  if (!el) return () => {};
  let timer = null;
  const fn = (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => handler(e), ms);
  };
  el.addEventListener('input', fn);
  return () => {
    clearTimeout(timer);
    el.removeEventListener('input', fn);
  };
}

/**
 * 存储键前缀管理� */
function createStore(prefix) {
  return {
    get: (key, fallback = '', type = 'string') => getStorageTyped(`${prefix}_${key}`, fallback, type),
    set: (key, value, type = 'string') => setStorageTyped(`${prefix}_${key}`, value, type),
    remove: (key) => removeStorage(`${prefix}_${key}`),
    clear: () => {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(prefix + '_')) localStorage.removeItem(k);
      });
    },
    keys: () => Object.keys(localStorage).filter(k => k.startsWith(prefix + '_')).map(k => k.slice(prefix.length + 1)),
    all: () => {
      const data = {};
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(prefix + '_')) data[k.slice(prefix.length + 1)] = localStorage.getItem(k);
      });
      return data;
    }
  };
}

/**
 * 常用存储实例
 */
const stores = {
  config: createStore('moonfog'),
  bg: createStore('moonfog_bg'),
  quote: createStore('moonfog_quote'),
  shortcut: createStore('moonfog_shortcut'),
  type: createStore('moonfog_type'),
  oobe: createStore('moonfog_oobe')
};

/**
 * 常见验证规则
 */
const validators = {
  required: (v) => v != null && String(v).trim() !== '',
  minLength: (min) => (v) => String(v).length >= min,
  maxLength: (max) => (v) => String(v).length <= max,
  pattern: (re) => (v) => re.test(String(v)),
  url: (v) => {
    try { new URL(String(v)); return true; } catch { return false; }
  },
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)),
  number: (v) => !isNaN(Number(v)),
  range: (min, max) => (v) => {
    const n = Number(v);
    return !isNaN(n) && n >= min && n <= max;
  }
};

/**
 * 验证值对� */
function validate(obj, rules) {
  const errors = {};
  Object.entries(rules).forEach(([key, rule]) => {
    const val = obj[key];
    if (Array.isArray(rule)) {
      for (const r of rule) {
        if (!r.validator(val)) {
          errors[key] = r.message;
          break;
        }
      }
    } else if (!rule.validator(val)) {
      errors[key] = rule.message;
    }
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * 异步重试工具
 */
async function retry(fn, options = {}) {
  const { retries = 3, delay = 1000, backoff = 2, shouldRetry = () => true } = options;
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === retries || !shouldRetry(e)) break;
      await new Promise(r => setTimeout(r, delay * Math.pow(backoff, i)));
    }
  }
  throw lastError;
}

/**
 * 简单的发布/订阅
 */
function createEventBus() {
  const events = new Map();
  return {
    on(event, handler) {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event).add(handler);
      return () => events.get(event).delete(handler);
    },
    off(event, handler) {
      events.get(event)?.delete(handler);
    },
    emit(event, ...args) {
      events.get(event)?.forEach(h => h(...args));
    },
    clear(event) {
      if (event) events.delete(event);
      else events.clear();
    }
  };
}

/**
 * 生命周期钩子管理
 */
function createLifecycle() {
  const hooks = { mount: [], unmount: [], update: [] };
  return {
    onMount(fn) { hooks.mount.push(fn); return () => { hooks.mount = hooks.mount.filter(f => f !== fn); }; },
    onUnmount(fn) { hooks.unmount.push(fn); return () => { hooks.unmount = hooks.unmount.filter(f => f !== fn); }; },
    onUpdate(fn) { hooks.update.push(fn); return () => { hooks.update = hooks.update.filter(f => f !== fn); }; },
    mount() { hooks.mount.forEach(f => f()); },
    unmount() { hooks.unmount.forEach(f => f()); },
    update() { hooks.update.forEach(f => f()); }
  };
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 下载文件
 */
function downloadFile(content, filename, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * 获取/设置 CSS 自定义属性（变量� */
const cssVars = {
  get: (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim(),
  set: (name, value, el = document.documentElement) => el.style.setProperty(name, value),
  remove: (name, el = document.documentElement) => el.style.removeProperty(name),
  getAll: (prefix = '', el = document.documentElement) => {
    const style = getComputedStyle(el);
    const result = {};
    for (let i = 0; i < style.length; i++) {
      const name = style[i];
      if (!prefix || name.startsWith(prefix)) result[name] = style.getPropertyValue(name).trim();
    }
    return result;
  }
};

/**
 * 安全解析 JSON
 */
function parseJSON(json, fallback = null) {
  try { return JSON.parse(json); } catch { return fallback; }
}

/**
 * 安全字符串化
 */
function stringifyJSON(obj, fallback = '') {
  try { return JSON.stringify(obj); } catch { return fallback; }
}

/**
 * 延迟执行（Promise �setTimeout� */
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 带超时的 Promise
 */
function withTimeout(promise, ms, timeoutError = new Error('Timeout')) {
  return Promise.race([
    promise,
    new Promise((_, r) => setTimeout(() => r(timeoutError), ms))
  ]);
}

/**
 * 并发控制
 */
async function parallelLimit(tasks, limit, callback) {
  const results = [];
  const executing = [];
  for (const task of tasks) {
    const p = callback(task).then(r => {
      executing.splice(executing.indexOf(p), 1);
      return r;
    });
    results.push(p);
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

/**
 * 类型守卫
 */
const is = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !isNaN(v),
  boolean: (v) => typeof v === 'boolean',
  function: (v) => typeof v === 'function',
  object: (v) => v !== null && typeof v === 'object',
  array: Array.isArray,
  element: (v) => v instanceof HTMLElement,
  node: (v) => v instanceof Node,
  empty: (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v).length === 0),
  defined: (v) => v !== undefined && v !== null
};
