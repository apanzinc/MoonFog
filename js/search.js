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
    const query = input.value.trim();
    if (query) {
      performSearch(query);
    }
  });

  input.addEventListener('input', syncClearBtn);
  input.addEventListener('search', syncClearBtn);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      syncClearBtn();
      input.focus();
    });
  }

  syncClearBtn();
  input.focus();
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
  const safeInitial = escapeAttr(initial);
  const safeHost = escapeAttr(host);
  const safeKey = escapeAttr(key);
  const faviconSrc = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
    : '';

  row.innerHTML = `
    <img src="${faviconSrc}" width="16" height="16" alt="" aria-hidden="true" onerror="fallbackIcon(this,'${safeInitial}')">
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
