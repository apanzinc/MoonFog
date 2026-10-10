/**
 * MoonFog - 搜索引擎
 */

/**
 * 初始化搜索 */
function initSearch() {
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
  syncClearBtn();
  input.focus();
}

const SEARCH_SUGGEST_LIMIT = 8;
let searchSuggestTimer = 0;
let searchSuggestAbort = null;
let searchSuggestSeq = 0;
let searchSuggestActive = -1;
let searchSuggestComposing = false;

function isSearchSuggestEnabled() {
  if (typeof getStorageTyped !== 'function') return true;
  return getStorageTyped(SEARCH_SUGGEST_KEY, true, 'boolean');
}

function currentSuggestProvider() {
  const engineKey = localStorage.getItem('moonfog_engine') || DEFAULT_ENGINE;
  const custom = typeof getCustomEngines === 'function' ? getCustomEngines() : {};
  if (custom[engineKey]) return '';
  const engine = SEARCH_ENGINES[engineKey];
  return engine && engine.suggest ? engine.suggest : '';
}

function suggestLocale() {
  const lang = String((navigator.language || 'zh-CN')).replace(/_/g, '-');
  const lower = lang.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower.startsWith('zh-hans')) return 'zh-CN';
  return lang || 'zh-CN';
}

function bindSearchSuggestToggle() {
  const el = document.getElementById('searchSuggestToggle');
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.checked = isSearchSuggestEnabled();
  el.addEventListener('change', () => {
    if (typeof setStorageTyped === 'function') {
      setStorageTyped(SEARCH_SUGGEST_KEY, !!el.checked, 'boolean');
    }
    if (!el.checked) closeSearchSuggest();
    else scheduleSearchSuggest();
  });
}

function scheduleSearchSuggest() {
  window.clearTimeout(searchSuggestTimer);
  if (searchSuggestComposing) return;
  const input = document.getElementById('searchInput');
  const query = input ? input.value.trim() : '';
  if (!isSearchSuggestEnabled() || !query || !currentSuggestProvider()) {
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
  const provider = currentSuggestProvider();
  if (!isSearchSuggestEnabled() || !query || !provider) {
    closeSearchSuggest();
    return;
  }
  if (searchSuggestAbort) searchSuggestAbort.abort();
  searchSuggestAbort = new AbortController();
  const seq = ++searchSuggestSeq;
  const url = new URL(SEARCH_SUGGEST_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('with', provider);
  url.searchParams.set('l', suggestLocale());
  fetch(url.toString(), { signal: searchSuggestAbort.signal })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then((data) => {
      if (seq !== searchSuggestSeq) return;
      if (input.value.trim() !== query) return;
      renderSearchSuggest(panel, input, Array.isArray(data) ? data : []);
    })
    .catch((err) => {
      if (err && err.name === 'AbortError') return;
      if (seq !== searchSuggestSeq) return;
      closeSearchSuggest();
    });
}

function renderSearchSuggest(panel, input, items) {
  const list = items
    .map((item) => ({
      text: item && typeof item.text === 'string' ? item.text.trim() : '',
      desc: item && typeof item.desc === 'string' ? item.desc.trim() : '',
      image: item && typeof item.image === 'string' ? item.image.trim() : ''
    }))
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
    btn.addEventListener('click', () => chooseSearchSuggest(item.text));
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

function chooseSearchSuggest(text) {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  if (input) input.value = text;
  if (clearBtn) clearBtn.hidden = !text;
  closeSearchSuggest();
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
    const picked = takeActiveSuggestion();
    if (picked) {
      e.preventDefault();
      chooseSearchSuggest(picked);
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
  
  const engineKey = localStorage.getItem('moonfog_engine') || DEFAULT_ENGINE;
  
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
