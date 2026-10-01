/**
 * MoonFog - 快捷导航
 */

const SHORTCUTS_STORAGE_KEY = 'moonfog_shortcuts';
const ICON_CACHE_KEY = 'moonfog_icon_cache';

/** 图标缓存结构：{ [urlKey]: { src: dataURL, timestamp: number } } */
function getIconCache() {
  try {
    const raw = localStorage.getItem(ICON_CACHE_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (_) {}
  return {};
}

function saveIconCache(cache) {
  try {
    localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    // localStorage 空间不足时，清理旧缓存
    try {
      const keys = Object.keys(cache);
      keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
      const half = Math.floor(keys.length / 2);
      for (let i = 0; i < half; i++) delete cache[keys[i]];
      localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }
}

function getUrlKey(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_) {
    return String(url || '').toLowerCase();
  }
}

/** 扩展环境 fetch 图片与blob（host_permissions 已授权跨域） */
function fetchImageBlob(src) {
  return fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-cache' })
    .then(res => res.ok ? res.blob() : null)
    .catch(() => null);
}

/** blob 转为 dataURL */
function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/** 加载 blob 与Image（通过 ObjectURL，避免canvas 污染）*/
function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('img load failed')); };
    img.src = objUrl;
  });
}

/** 加载任意 src 与Image（用于已缓存 dataURL 等） */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img load failed'));
    img.src = src;
  });
}

/** 将图标URL 转为 dataURL 用于本地缓存（离线可用） */
function iconToDataURL(src) {
  return fetchImageBlob(src).then(blob => blob ? blobToDataURL(blob) : '');
}

/** 对比两个图标是否不同（用尺寸简易判断） */
function areIconsDifferent(cachedSrc, newSrc) {
  if (!cachedSrc || !newSrc) return Promise.resolve(true);
  return Promise.all([loadImage(cachedSrc), loadImage(newSrc)])
    .then(([a, b]) => a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight)
    .catch(() => true);
}

/** 检测图标是否本身已是圆角（四角是否有足够透明像素）*/
function detectIconHasRoundedCorners(src) {
  return fetchImageBlob(src)
    .then(blob => blob ? loadImageFromBlob(blob) : null)
    .then(img => {
      if (!img) return false;
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, w, h);
      // 取四角4x4 区域的平均透明度
      const sampleSize = Math.max(2, Math.floor(Math.min(w, h) / 16));
      const corners = [
        [0, 0], [w - sampleSize, 0],
        [0, h - sampleSize], [w - sampleSize, h - sampleSize]
      ];
      let totalAlpha = 0;
      let totalPixels = 0;
      corners.forEach(([cx, cy]) => {
        try {
          const data = ctx.getImageData(cx, cy, sampleSize, sampleSize).data;
          for (let i = 3; i < data.length; i += 4) {
            totalAlpha += data[i];
            totalPixels++;
          }
        } catch (_) {}
      });
      if (!totalPixels) return false;
      // 平均透明度< 0.9 认为有圆角（有透明像素）
      return (totalAlpha / totalPixels / 255) < 0.9;
    })
    .catch(() => false);
}

const DEFAULT_SHORTCUTS = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'YouTube', url: 'https://youtube.com' },
  { name: 'Bilibili', url: 'https://bilibili.com' }
];

/** 空文件夹占位模板（同族圆底图标 + 文案 + 标签同款胶囊按钮）*/
const EMPTY_FOLDER_HTML = '<div class="empty-folder-icon" aria-hidden="true"><span class="mgc_folder_2_line"></span></div><p>暂无内容</p><button class="shortcut-btn shortcut-expanded-add" type="button" aria-label="添加快捷方式" title="添加快捷方式"><span class="mgc_add_line" aria-hidden="true"></span><span>添加</span></button>';

let editingShortcutIndex = -1;
let editingShortcutChild = -1; // 文件夹内子项索引（-1 表示非子项）
let editingShortcutType = 'item'; // 'item' | 'folder' | 'child' | 'new-child' | 'new-child-folder' | 'child-folder'
let editingShortcutPath = []; // 多级子文件夹路径：数组的 子索引，如[0, 2] 表示 folder.children[0].children[2]

/**
 * 根据 folderIndex 和path 数组，从 shortcuts 中取出目标文件夹对象
 * path 为空数组时返回shortcuts[folderIndex] 本身
 */
function getFolderByPath(shortcuts, folderIndex, path) {
  let folder = shortcuts[folderIndex];
  if (!folder || folder.type !== 'folder') return null;
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (!folder.children || !folder.children[idx]) return null;
    folder = folder.children[idx];
    if (!folder || folder.type !== 'folder') return null;
  }
  return folder;
}

/**
 * 递归计算文件夹内所有子项数量（含子文件夹内的项目）
 */
function countFolderItems(folder) {
  if (!folder || !folder.children) return 0;
  let n = 0;
  folder.children.forEach(child => {
    if (child.type === 'folder') {
      n += countFolderItems(child);
    } else {
      n += 1;
    }
  });
  return n;
}

function getShortcuts() {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        // 校验每项至少本name
        const valid = data.every(item => item && item.name);
        if (valid) return data;
      }
      // 数据异常，清除
      localStorage.removeItem(SHORTCUTS_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(SHORTCUTS_STORAGE_KEY);
  }
  return cloneDefaultShortcuts();
}

function saveShortcuts(shortcuts) {
  localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
}

function openShortcutModal(index, data, type, childIndex, path) {
  const scModalTitle = document.getElementById('shortcutModalTitle');
  const scModalConfirm = document.getElementById('shortcutModalConfirm');
  const scNameInput = document.getElementById('shortcutName');
  const scUrlInput = document.getElementById('shortcutUrl');
  const scIconInput = document.getElementById('shortcutIcon');
  const shortcutModal = document.getElementById('shortcutModal');
  const errorEl = document.getElementById('shortcutModalError');
  const scUrlField = document.getElementById('shortcutUrlField') || (scUrlInput && scUrlInput.closest('.modal-field'));
  const scIconField = document.getElementById('shortcutIconField') || (scIconInput && scIconInput.closest('.modal-field'));
  if (!scModalTitle || !scModalConfirm || !scNameInput || !shortcutModal) return;

  // 记录触发元素，关闭时恢复焦点
  shortcutModal._mfRestoreEl = document.activeElement;
  editingShortcutIndex = index;
  editingShortcutChild = childIndex !== undefined ? childIndex : -1;
  editingShortcutType = type || 'item';
  editingShortcutPath = Array.isArray(path) ? [...path] : [];

  if (typeof clearModalValidation === 'function') {
    clearModalValidation(errorEl, [scNameInput, scUrlInput, scIconInput]);
  }

  const isFolderType = type === 'folder' || type === 'new-folder' || type === 'insert-folder' || type === 'new-child-folder' || type === 'child-folder';
  if (scUrlField) scUrlField.hidden = isFolderType;
  if (scIconField) scIconField.hidden = isFolderType;

  if (type === 'folder' || type === 'new-folder' || type === 'insert-folder') {
    const isNew = type === 'new-folder' || type === 'insert-folder';
    scModalTitle.textContent = isNew ? '新建文件夹' : '编辑文件夹';
    scModalConfirm.textContent = isNew ? '创建' : '保存';
    scNameInput.value = isNew ? '' : ((data && data.name) || '');
  } else if (type === 'new-child-folder') {
    scModalTitle.textContent = '新建子文件夹';
    scModalConfirm.textContent = '创建';
    scNameInput.value = '';
  } else if (type === 'child-folder') {
    scModalTitle.textContent = '编辑子文件夹';
    scModalConfirm.textContent = '保存';
    scNameInput.value = (data && data.name) || '';
  } else if (type === 'new-child' || type === 'insert-item' || (type === 'item' && !data)) {
    scModalTitle.textContent = '添加快捷方式';
    scModalConfirm.textContent = '添加';
    scNameInput.value = '';
    if (scUrlInput) scUrlInput.value = '';
    if (scIconInput) scIconInput.value = '';
  } else {
    scModalTitle.textContent = '编辑快捷方式';
    scModalConfirm.textContent = '保存';
    scNameInput.value = (data && data.name) || '';
    if (scUrlInput) scUrlInput.value = (data && data.url) || '';
    if (scIconInput) scIconInput.value = (data && data.icon) || '';
  }

  if (typeof openModal === 'function') openModal(shortcutModal, scNameInput);
  else {
    shortcutModal.classList.add('active');
    shortcutModal.setAttribute('aria-hidden', 'false');
    shortcutModal.removeAttribute('inert');
    setTimeout(() => scNameInput.focus(), 30);
  }
}

function closeShortcutModal() {
  const shortcutModal = document.getElementById('shortcutModal');
  if (!shortcutModal) return;
  const errorEl = document.getElementById('shortcutModalError');
  const fields = ['shortcutName', 'shortcutUrl', 'shortcutIcon']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (typeof clearModalValidation === 'function') clearModalValidation(errorEl, fields);
  if (typeof closeModal === 'function') closeModal(shortcutModal, shortcutModal._mfRestoreEl);
  else {
    shortcutModal.classList.remove('active');
    shortcutModal.setAttribute('aria-hidden', 'true');
    shortcutModal.setAttribute('inert', '');
  }
  shortcutModal._mfRestoreEl = null;
}



/**
 * 右键菜单
 */
let contextMenuTarget = null;
let contextMenuChildTarget = null; // 子项索引（文件夹内项目）
let contextMenuPath = []; // 多级子文件夹路径

function showContextMenu(menuId, e, index, childIndex, path) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuTarget = index;
  contextMenuChildTarget = childIndex !== undefined ? childIndex : null;
  contextMenuPath = path || [];

  // 关闭所有其他菜单
  hideShortcutContextMenu();

  const menu = document.getElementById(menuId);
  if (!menu) return;
  menu.hidden = false;
  menu.classList.add('active');

  // 先显示再量尺寸，避免贴边裁切
  const rect = menu.getBoundingClientRect();
  const pad = 8;
  const x = Math.min(Math.max(pad, e.clientX), window.innerWidth - rect.width - pad);
  const y = Math.min(Math.max(pad, e.clientY), window.innerHeight - rect.height - pad);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideShortcutContextMenu() {
  document.querySelectorAll('.context-menu').forEach((m) => {
    m.classList.remove('active');
    m.hidden = true;
  });
}

/** 网站图标加载失败时的默认地球图标（颜色继承currentColor）*/
const FALLBACK_ICON_SVG = `<svg class="shortcut-fallback-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" fill-rule="nonzero" d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m2 11.4-1.564 1.251a.5.5 0 0 0-.041.744l1.239 1.239a2 2 0 0 1 .508.864l.175.613a1.8 1.8 0 0 0 1.017 1.163 8.021 8.021 0 0 0 2.533-1.835l-.234-1.877a2 2 0 0 0-1.09-1.54l-1.47-.736A1 1 0 0 0 14 13.4M12 4a7.987 7.987 0 0 0-6.335 3.114l-.165.221V9.02a3 3 0 0 0 1.945 2.809l.178.06 1.29.395c1.373.42 2.71-.697 2.577-2.096l-.019-.145-.175-1.049a1 1 0 0 1 .656-1.108l.108-.03.612-.14a2.667 2.667 0 0 0 1.989-3.263A7.987 7.987 0 0 0 12 4"/></svg>`;

function setShortcutFallbackIcon(iconEl) {
  if (!iconEl) return;
  iconEl.innerHTML = FALLBACK_ICON_SVG;
}

/** 已知纯黑/单色站点图标：深色模式下需要反白才看得见*/
/* 仅纯黑近黑单色标；带品牌色的（如Claude 橙）不能 invert，会变蓝 */
const MONO_ICON_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'x.com',
  'twitter.com',
  'github.com'
];

function isMonoIconSrc(src, pageUrl) {
  const checkHost = (host) => {
    if (!host) return false;
    const h = host.toLowerCase().replace(/^www\./, '');
    return MONO_ICON_HOSTS.some((m) => h === m || h.endsWith('.' + m));
  };
  try {
    if (src && /^(https?:|chrome-extension:|data:)/i.test(src) === false && src.includes('chatgpt')) {
      return true;
    }
    if (src && /^https?:/i.test(src)) return checkHost(new URL(src).hostname);
  } catch { /* ignore */ }
  try {
    if (pageUrl) return checkHost(new URL(pageUrl).hostname);
  } catch { /* ignore */ }
  return false;
}

/**
 * 创建带圆角检测单色图标的快捷方式img 元素
 * @param {string} src 图标 URL
 * @param {string} pageUrl 所在页面URL（用于单色图标host 判断） * @param {Object} opts 配置
 * @param {string} opts.imgClass 基础 class 前缀（默认'shortcut-icon-img'，列表下用'shortcut-list-icon-img'） * @param {Function} opts.onLoaded(img, hasRounded) 加载成功回调（可选）
 * @param {Function} opts.onFailed() 加载失败回调（可选，不传则默认调用setShortcutFallbackIcon） * @param {HTMLElement} opts.iconEl 图标容器（用于默认失败回调）
 * @returns {HTMLImageElement}
 */
function createShortcutImg(src, pageUrl, opts) {
  const options = opts || {};
  const prefix = options.imgClass || 'shortcut-icon-img';
  const img = document.createElement('img');
  img.className = prefix + (isMonoIconSrc(src, pageUrl) ? ' icon-mono' : '');
  img.alt = '';
  img.decoding = 'async';

  const fail = () => {
    if (typeof options.onFailed === 'function') options.onFailed();
    else if (options.iconEl) setShortcutFallbackIcon(options.iconEl);
  };

  img.onload = () => {
    // 空图 / 1x1 占位视为失败
    if (!img.naturalWidth || img.naturalWidth < 2) {
      fail();
      return;
    }
    detectIconHasRoundedCorners(src).then((hasRounded) => {
      if (!hasRounded) {
        img.classList.add('icon-no-rounded');
        // 列表图标的容器也同步 class
        if (options.iconEl && options.iconEl.classList) {
          options.iconEl.classList.add('is-no-rounded');
        }
      }
      if (typeof options.onLoaded === 'function') {
        try { options.onLoaded(img, hasRounded); } catch (_) {}
      }
      // 统一：清空容器并插入 img
      if (options.iconEl && options.iconEl !== img.parentNode) {
        options.iconEl.innerHTML = '';
        options.iconEl.appendChild(img);
      }
    }).catch(() => {
      // 圆角检测失败仍然显示
      if (options.iconEl && options.iconEl !== img.parentNode) {
        options.iconEl.innerHTML = '';
        options.iconEl.appendChild(img);
      }
      if (typeof options.onLoaded === 'function') {
        try { options.onLoaded(img, false); } catch (_) {}
      }
    });
  };
  img.onerror = fail;
  img.src = src;
  return img;
}

function setShortcutIcon(iconEl, src, pageUrl, skipCacheRefresh) {
  if (!iconEl) return;
  if (!src) {
    setShortcutFallbackIcon(iconEl);
    return;
  }

  const urlKey = pageUrl ? getUrlKey(pageUrl) : getUrlKey(src);
  const cache = getIconCache();
  const cached = cache[urlKey];

  // 优先用缓存立刻显示（若有），否则用原始src
  createShortcutImg(cached && cached.src ? cached.src : src, pageUrl, {
    iconEl: iconEl
  });

  // 缓存更新机制：异步获取最新图标，有差异则更新
  if (!skipCacheRefresh && urlKey) {
    fetchFavicon(pageUrl || src, true).then(latestSrc => {
      if (!latestSrc) return;
      const checkAndUpdate = async () => {
        const different = await areIconsDifferent(cached ? cached.src : '', latestSrc);
        if (different) {
          const dataUrl = await iconToDataURL(latestSrc);
          if (dataUrl) {
            cache[urlKey] = { src: dataUrl, timestamp: Date.now() };
            saveIconCache(cache);
            // 静默替换当前显示的图标（若当前用的是缓存或旧图）
            const currentImg = iconEl.querySelector('.shortcut-icon-img');
            if (!currentImg || currentImg.src !== latestSrc) {
              createShortcutImg(dataUrl, pageUrl, {
                iconEl: iconEl
              });
            }
          }
        } else if (!cached) {
          // 无缓存但新图相同，也写入缓存供下次用
          const dataUrl = await iconToDataURL(latestSrc);
          if (dataUrl) {
            cache[urlKey] = { src: dataUrl, timestamp: Date.now() };
            saveIconCache(cache);
          }
        }
      };
      checkAndUpdate();
    });
  }
}

/**
 * 获取网站 favicon
 * 优先 Google s2（跨域 ORB 更稳），失败再试站点 /favicon.ico
 * 空字符串 = 全部失败
 * @param {string} url 网站 URL
 * @param {boolean} forceRefresh 是否强制从网络获取（不走内存缓存） */
function fetchFavicon(url, forceRefresh) {
  return new Promise((resolve) => {
    let hostname = '';
    let origin = '';
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname;
      origin = parsed.origin;
    } catch {
      resolve('');
      return;
    }

    // 先尝试缓存读取（非强制刷新时）
    if (!forceRefresh) {
      const urlKey = getUrlKey(url);
      const cache = getIconCache();
      if (cache[urlKey] && cache[urlKey].src) {
        resolve(cache[urlKey].src);
        return;
      }
    }

    const candidates = [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`,
      `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
      `${origin}/favicon.ico`
    ];

    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        resolve('');
        return;
      }
      const src = candidates[index++];
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 1) resolve(src);
        else tryNext();
      };
      img.onerror = tryNext;
      img.src = src + (forceRefresh && src.indexOf('?') >= 0 ? '&_t=' + Date.now() : (forceRefresh ? '?_t=' + Date.now() : ''));
    };
    tryNext();
  });
}

/**
 * 渲染主页快捷导航
 */

/**
 * 文件夹展开方向设置：up 向上（标签上面）| down 向下（标签下面，默认）| auto 屏幕自适应
 * 主面板与多级子面板统一按此设置弹出；指定方向放不下时自动翻到另一侧，
 * auto 每次打开时直接取空间更大的一侧
 */
const FOLDER_EXPAND_DIR_KEY = 'moonfog_folder_expand_dir';

function normalizeExpandDir(value) {
  return value === 'up' || value === 'auto' ? value : 'down';
}

function getFolderExpandDir() {
  return normalizeExpandDir(getStorage(FOLDER_EXPAND_DIR_KEY, ''));
}

/**
 * 收起所有已展开的文件夹/子面板并复位页面位移（改设置后旧定位失效时用）
 */
function closeAllShortcutPanels() {
  document.querySelectorAll('.shortcut-expanded-subfolder.open').forEach(collapseSubfolder);
  document.querySelectorAll('.shortcut-folder.open').forEach((f) => {
    f.classList.remove('open');
    const t = f.querySelector('.shortcut-folder-trigger');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
  document.body.classList.remove('folder-open');
  stopFolderShiftFollow();
  document.documentElement.style.setProperty('--folder-shift', '0px');
  refreshAllDim();
}

/**
 * 展开方向三选一（收藏夹设置页）
 */
function bindFolderExpandDirSetting() {
  const seg = document.getElementById('folderExpandDirSegment');
  if (!seg || seg.dataset.bound === '1') return;
  seg.dataset.bound = '1';
  // 归一化存量值：保证 initSegment 恢复选中时一定能命中一个按钮
  const dir = getFolderExpandDir();
  if (getStorage(FOLDER_EXPAND_DIR_KEY, '') !== dir) setStorage(FOLDER_EXPAND_DIR_KEY, dir);
  initSegment('folderExpandDirSegment', FOLDER_EXPAND_DIR_KEY, () => {
    closeAllShortcutPanels();
  }, { attr: 'data-expand-dir' });
}

/**
 * 根据展开的文件夹实际高度计算上移距离
 * 展开面板已在 CSS 中封顶（max-height），配合内部滚动，任意内容量都不会超出视口
 */
function updateFolderShift() {
  const openFolder = document.querySelector('.shortcut-folder.open');
  if (!openFolder) {
    document.documentElement.style.setProperty('--folder-shift', '0px');
    return;
  }
  const expanded = openFolder.querySelector(':scope > .shortcut-expanded');
  if (!expanded) {
    document.documentElement.style.setProperty('--folder-shift', '0px');
    return;
  }
  // 向上展开：面板向标签上方生长，整页不用让位（上移反而会把胶囊顶出屏幕）
  if (expanded.classList.contains('is-up')) {
    document.documentElement.style.setProperty('--folder-shift', '0px');
    return;
  }
  const content = document.querySelector('.content');
  // .content 的 top 过渡期间 getBoundingClientRect 拿到的是动画中的位置，
  // 加上当前实际生效的位移还原成静态位置，重复计算才不会互相打架
  const applied = content ? -(parseFloat(getComputedStyle(content).top) || 0) : 0;
  const staticBottom = openFolder.getBoundingClientRect().bottom + applied;
  const viewportH = window.innerHeight;
  // offsetHeight = 封顶后的可见高度（scrollHeight 是未裁剪的内容高度）
  const expandedHeight = expanded.offsetHeight;
  // 弹窗底部预计位置
  const expandedBottom = staticBottom + 8 + expandedHeight;
  // 如果弹窗底部超出视口底部，需要上移
  const overflow = expandedBottom - viewportH + 20; // 20px 安全距离
  let shift;
  if (overflow > 0) {
    // 溢出了，按溢出量上移，让弹窗底部刚好在视口内
    shift = overflow + 40; // 额外余量，确保完整显示
  } else {
    // 没溢出，给一个基础上移量，腾出呼吸空间
    shift = 60;
  }
  // 触发器不能被顶出屏幕：上移量最多让触发器停在视口顶部下方
  const maxShift = Math.max(0, staticBottom - openFolder.offsetHeight - 8);
  shift = Math.min(shift, maxShift, viewportH + 200);
  document.documentElement.style.setProperty('--folder-shift', shift + 'px');
}

let folderShiftRaf = 0;

/**
 * 结束逐帧跟算，恢复正常过渡
 */
function stopFolderShiftFollow() {
  cancelAnimationFrame(folderShiftRaf);
  folderShiftRaf = 0;
  document.body.classList.remove('folder-following');
}

/**
 * 逐帧重算上移距离
 * @param {boolean} follow - 面板高度正在做 max-height 过渡时传 true：
 *   关掉 .content 的 top 过渡，让位移由本循环逐帧直驱，与面板同帧同步，
 *   否则 top 过渡去追每帧变化的目标会永远慢半拍（表现为面板动完页面才跟上）
 */
function scheduleFolderShift(follow) {
  stopFolderShiftFollow();
  if (follow) {
    document.body.classList.add('folder-following');
  }
  // 同步先算一次：与点击里刚加的 class 同帧 flush，
  // 位移不比面板动画晚一帧起步（晚一帧就肉眼可见“面板先开、页面后动”）
  updateFolderShift();
  const start = performance.now();
  const step = () => {
    updateFolderShift();
    if (performance.now() - start < 400) {
      folderShiftRaf = requestAnimationFrame(step);
    } else {
      stopFolderShiftFollow();
    }
  };
  folderShiftRaf = requestAnimationFrame(step);
}

/**
 * 层级聚焦：按当前打开的最深层级，给祖先面板打淡化档
 * （距最深一层 dim-1=0.75，两层及以上 dim-2=0.55，最深层不淡——逐层清晰）
 */
function refreshAllDim() {
  let anySub = false;
  document.querySelectorAll('.shortcut-folder.open').forEach((folder) => {
    const expanded = folder.querySelector(':scope > .shortcut-expanded');
    if (!expanded) return;
    let maxDepth = 1;
    const walkDepth = (panel, depth) => {
      if (depth > maxDepth) maxDepth = depth;
      panel.querySelectorAll('.shortcut-expanded-subfolder.open').forEach((sf) => {
        if (sf.subPanelEl) walkDepth(sf.subPanelEl, depth + 1);
      });
    };
    walkDepth(expanded, 1);
    if (maxDepth > 1) anySub = true;
    const applyDim = (panel, depth) => {
      const gap = maxDepth - depth;
      panel.classList.toggle('dim-1', gap === 1);
      panel.classList.toggle('dim-2', gap >= 2);
      panel.querySelectorAll('.shortcut-expanded-subfolder.open').forEach((sf) => {
        if (sf.subPanelEl) applyDim(sf.subPanelEl, depth + 1);
      });
    };
    applyDim(expanded, 1);
  });
  // 页面标签只在再开一级（存在打开的子面板）时才失焦
  document.body.classList.toggle('has-subpanel', anySub);
}

/**
 * 收起子文件夹：清 open（含 portal 里的面板）与 aria-expanded
 */
function collapseSubfolder(sf) {
  sf.classList.remove('open');
  const t = sf.querySelector(':scope > .shortcut-folder-trigger');
  if (t) t.setAttribute('aria-expanded', 'false');
  if (sf.subPanelEl) sf.subPanelEl.classList.remove('open');
  refreshAllDim();
}

/**
 * 展开前设置子面板（portal 定位）：锚点换算到 folder 坐标系、限宽、视口内翻转/夹取
 * 子面板挂在 .subfolder-portal（folder 直下、主面板外），坐标相对 folder，不受主面板裁剪
 */
function prepareSubPanel(subEl, panelEl) {
  const folder = subEl.closest('.shortcut-folder');
  if (!folder) return;
  // subEl 相对 folder 的布局偏移（offsetParent 链穿主面板/上级面板，不受 scale 动画影响）
  let ox = 0;
  let oy = 0;
  let n = subEl;
  while (n && n !== folder) {
    ox += n.offsetLeft;
    oy += n.offsetTop;
    n = n.offsetParent;
  }
  if (n !== folder) return;
  const subW = subEl.offsetWidth;
  const subH = subEl.offsetHeight;
  const folderRect = folder.getBoundingClientRect();
  // 限宽：右缘不超主面板（视觉对齐），不足 168px 时向左补足
  const expanded = subEl.closest('.shortcut-expanded');
  const avail = expanded
    ? expanded.offsetWidth - ox - 12
    : Math.min(window.innerWidth, 360) - ox - 12;
  const leftPx = Math.round(ox + Math.min(0, avail - 168));
  panelEl.style.maxWidth = Math.max(168, avail) + 'px';
  panelEl.style.left = leftPx + 'px';
  // 方向三态：优先按设置方向，该方向放不下时翻到另一侧
  // （up=先上、放不下转下；down=先下、放不下转上；auto=取空间更大的一侧）
  const panelH = panelEl.offsetHeight;
  const anchorTop = folderRect.top + oy;
  const spaceBelow = window.innerHeight - 4 - (anchorTop + subH + 8);
  const spaceAbove = anchorTop - 4;
  const expandDir = getFolderExpandDir();
  const fitsUp = panelH + 8 <= spaceAbove;
  const fitsDown = panelH + 8 <= spaceBelow;
  let up;
  if (expandDir === 'up') up = fitsUp || (!fitsDown && spaceAbove >= spaceBelow);
  else if (expandDir === 'down') up = !fitsDown && (fitsUp || spaceAbove > spaceBelow);
  else up = !fitsDown && spaceAbove > spaceBelow;
  let top = up ? oy - panelH - 8 : oy + subH + 8;
  // 最后夹进视口（任何方向都不出屏）
  top = Math.max(
    4 - folderRect.top,
    Math.min(top, window.innerHeight - 4 - folderRect.top - panelH),
  );
  const topPx = Math.round(top);
  panelEl.style.top = topPx + 'px';
  // 缩放锚点 = 胶囊中心（换算进面板坐标系），面板从胶囊里弹出/收回
  panelEl.style.transformOrigin =
    `${((subW / 2) + (ox - leftPx)).toFixed(1)}px ${((subH / 2) + (oy - topPx)).toFixed(1)}px`;
}

/**
 * 递归渲染文件夹子项（支持多级子文件夹）
 * @param {HTMLElement} container - 所在层级的标签流容器（主面板或上级子面板）
 * @param {Array} children - 子项数组
 * @param {number} folderIndex - 顶层文件夹索引
 * @param {Array} path - 当前路径（子索引数组）
 * @param {HTMLElement} portal - 子面板 portal（folder 直下），所有层级共用
 */
function renderFolderChildrenExpanded(container, children, folderIndex, path, portal) {
  // 按原始顺序渲染，子文件夹和链接混合排列（与浏览器书签一致）
  children.forEach((child, ci) => {
    if (child.type === 'folder') {
      // 子文件夹：使用与主页文件夹完全一致的胶囊样式
      const subPath = [...path, ci];
      const depth = subPath.length;
      const subEl = document.createElement('div');
      subEl.className = 'shortcut-expanded-subfolder';
      subEl.dataset.depth = depth;

      const subTrigger = document.createElement('button');
      subTrigger.type = 'button';
      subTrigger.className = 'shortcut-btn shortcut-folder-trigger shortcut-expanded-subfolder-trigger';
      subTrigger.setAttribute('aria-expanded', 'false');
      const subChildCount = countFolderItems(child);
      subTrigger.innerHTML = `<span class="shortcut-icon shortcut-folder-icon"><span class="mgc_folder_2_line" aria-hidden="true"></span></span><span class="shortcut-label">${escapeHtml(child.name)}</span><span class="shortcut-folder-count"${subChildCount ? '' : ' hidden'}>${subChildCount || ''}</span>`;
      // 右键菜单：子文件夹
      subTrigger.addEventListener('contextmenu', (e) => showContextMenu('childFolderContextMenu', e, folderIndex, ci, path));
      subTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // 关闭同级其他已展开的子文件夹
        subEl.parentElement.querySelectorAll('.shortcut-expanded-subfolder.open').forEach((sf) => {
          if (sf !== subEl) collapseSubfolder(sf);
        });
        const willOpen = !subEl.classList.contains('open');
        const panelEl = subEl.subPanelEl;
        if (panelEl) {
          // 先定位/换锚点，再开——同一渲染帧内生效，打开起点即胶囊锚点
          if (willOpen) prepareSubPanel(subEl, panelEl);
          panelEl.classList.toggle('open', willOpen);
        }
        subEl.classList.toggle('open', willOpen);
        subTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        refreshAllDim();
      });
      subEl.appendChild(subTrigger);

      const subChildren = document.createElement('div');
      subChildren.className = 'shortcut-expanded-subfolder-children';
      // 每深一层 z 提一层：深层面板盖浅层，文件夹中的文件夹不被上层覆盖
      subChildren.style.zIndex = String(depth);
      // 面板内部滚动（封顶）时关闭其内的子面板（弹层锚点已失效）
      subChildren.addEventListener('scroll', () => {
        subChildren.querySelectorAll('.shortcut-expanded-subfolder.open').forEach(collapseSubfolder);
      }, { passive: true });
      // 关键：面板不进 subEl，挂到独立 portal（folder 直下、主面板外）——
      // 不包裹在主面板里，不受其 overflow 裁剪/滚动约束。
      // 必须在递归前 append：portal 内 DOM 序浅在前、深在后，深层面板才不会被浅层盖住
      subEl.subPanelEl = subChildren;
      portal.appendChild(subChildren);
      if (child.children && child.children.length > 0) {
        renderFolderChildrenExpanded(subChildren, child.children, folderIndex, subPath, portal);
      } else {
        subChildren.classList.add('is-empty');
        const empty = document.createElement('div');
        empty.className = 'shortcut-expanded-empty';
        empty.innerHTML = EMPTY_FOLDER_HTML;
        empty.querySelector('.shortcut-expanded-add').addEventListener('click', (e) => {
          e.stopPropagation();
          openShortcutModal(folderIndex, null, 'new-child', undefined, subPath);
        });
        subChildren.appendChild(empty);
      }
      container.appendChild(subEl);
    } else {
      // 普通链接项：与主页快捷方式完全一致的样式
      const btn = document.createElement('a');
      btn.className = 'shortcut-btn shortcut-expanded-item';
      btn.href = child.url;
      btn.title = child.name;
      btn.setAttribute('aria-label', child.name);
      btn.innerHTML = `<span class="shortcut-icon"></span><span class="shortcut-label">${escapeHtml(child.name)}</span>`;
      // 右键菜单：文件夹内链接项
      btn.addEventListener('contextmenu', (e) => showContextMenu('childShortcutContextMenu', e, folderIndex, ci, path));

      const iconEl = btn.querySelector('.shortcut-icon');
      setShortcutFallbackIcon(iconEl);
      if (child.icon) {
        setShortcutIcon(iconEl, child.icon, child.url);
      } else {
        fetchFavicon(child.url).then(src => setShortcutIcon(iconEl, src, child.url));
      }
      container.appendChild(btn);
    }
  });
}

function renderShortcuts() {
  const row = document.getElementById('shortcutsRow');
  if (!row) return;
  row.innerHTML = '';
  let shortcuts;
  try {
    shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
    if (!Array.isArray(shortcuts)) shortcuts = DEFAULT_SHORTCUTS;
  } catch (e) {
    shortcuts = DEFAULT_SHORTCUTS;
  }

  shortcuts.forEach((item, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'shortcut-drag-wrapper';
    wrapper.draggable = true;
    wrapper.dataset.index = idx;

    if (item.type === 'folder') {
      // 文件夹
      const folder = document.createElement('div');
      folder.className = 'shortcut-folder';
      folder.dataset.index = idx;

      const trigger = document.createElement('button');
      trigger.className = 'shortcut-btn shortcut-folder-trigger';
      trigger.type = 'button';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'true');
      const childCount = countFolderItems(item);
      trigger.innerHTML = `<span class="shortcut-icon shortcut-folder-icon"><span class="mgc_folder_2_line" aria-hidden="true"></span></span><span class="shortcut-label">${escapeHtml(item.name)}</span><span class="shortcut-folder-count"${childCount ? '' : ' hidden'}>${childCount || ''}</span>`;
      trigger.addEventListener('contextmenu', (e) => showContextMenu('folderContextMenu', e, idx));
      folder.appendChild(trigger);

      // 展开容器
      const expanded = document.createElement('div');
      expanded.className = 'shortcut-expanded';

      if (!item.children || item.children.length === 0) {
        expanded.classList.add('is-empty');
        const empty = document.createElement('div');
        empty.className = 'shortcut-expanded-empty';
        empty.innerHTML = EMPTY_FOLDER_HTML;
        empty.querySelector('.shortcut-expanded-add').addEventListener('click', (e) => {
          e.stopPropagation();
          openShortcutModal(idx, null, 'new-child', undefined, []);
        });
        expanded.appendChild(empty);
      } else {
        // 子面板 portal（folder 直下、主面板外）：所有层级的子面板都挂这里，
        // 不包裹进主页面板，不受其 overflow 裁剪/滚动约束
        const portal = document.createElement('div');
        portal.className = 'subfolder-portal';
        folder.appendChild(portal);
        // 递归渲染文件夹子项（支持多级子文件夹）
        renderFolderChildrenExpanded(expanded, item.children, idx, [], portal);
      }

      folder.appendChild(expanded);

      // 主面板封顶内部滚动时关闭全部子面板（弹层锚点失效）
      expanded.addEventListener('scroll', () => {
        expanded.querySelectorAll('.shortcut-expanded-subfolder.open').forEach(collapseSubfolder);
      }, { passive: true });

      trigger.addEventListener('click', () => {
        const willOpen = !folder.classList.contains('open');
        // 关闭其他已展开的文件夹
        document.querySelectorAll('.shortcut-folder.open').forEach((f) => {
          if (f !== folder) {
            f.classList.remove('open');
            const t = f.querySelector('.shortcut-folder-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        // 同时关闭已展开的子文件夹
        document.querySelectorAll('.shortcut-expanded-subfolder.open').forEach(collapseSubfolder);
        if (willOpen) {
          // 方向决策：优先按设置方向，该方向放不下时翻到另一侧
          // （up=先上、放不下转下；down=先下、放不下转上；auto=取空间更大的一侧）
          const dir = getFolderExpandDir();
          expanded.style.maxHeight = '';
          const folderRect = folder.getBoundingClientRect();
          const panelH = expanded.offsetHeight;
          const spaceBelow = window.innerHeight - 4 - (folderRect.bottom + 8);
          const spaceAbove = folderRect.top - 4;
          const fitsUp = panelH + 8 <= spaceAbove;
          const fitsDown = panelH + 8 <= spaceBelow;
          let up;
          if (dir === 'up') up = fitsUp || (!fitsDown && spaceAbove >= spaceBelow);
          else if (dir === 'down') up = !fitsDown && (fitsUp || spaceAbove > spaceBelow);
          else up = !fitsDown && spaceAbove > spaceBelow;
          expanded.classList.toggle('is-up', up);
          // 向上弹：封顶到标签上方的可视空间（面板内部滚动，不出视口顶）
          expanded.style.maxHeight = up
            ? Math.max(80, Math.min(folderRect.top - 8, window.innerHeight * 0.7)) + 'px'
            : '';
          // 缩放锚点 = 触发器胶囊中心（分方向换算进面板坐标系），面板从胶囊里长出/缩回
          const originY = up
            ? expanded.offsetHeight + folder.offsetHeight / 2 + 8
            : -(folder.offsetHeight / 2 + 8);
          expanded.style.transformOrigin =
            `${(folder.offsetWidth / 2).toFixed(1)}px ${originY.toFixed(1)}px`;
        }
        folder.classList.toggle('open', willOpen);
        refreshAllDim();
        trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        // 切换 body.folder-open 以控制问候语显隐
        document.body.classList.toggle('folder-open', willOpen);
        // 根据弹窗实际高度动态调整上移距离，确保不超出屏幕底部
        if (willOpen) {
          if (expanded.classList.contains('is-up')) {
            // 向上弹：面板不占下方空间，整页归位
            stopFolderShiftFollow();
            document.documentElement.style.setProperty('--folder-shift', '0px');
          } else {
            scheduleFolderShift();
          }
        } else {
          stopFolderShiftFollow();
          document.documentElement.style.setProperty('--folder-shift', '0px');
        }
      });

      wrapper.appendChild(folder);
      row.appendChild(wrapper);
    } else {
      // 独立快捷方式
      const btn = document.createElement('a');
      btn.className = 'shortcut-btn';
      btn.href = item.url;
      btn.title = item.name;
      btn.setAttribute('aria-label', item.name);
      btn.innerHTML = `<span class="shortcut-icon"></span><span class="shortcut-label">${escapeHtml(item.name)}</span>`;

      btn.addEventListener('contextmenu', (e) => showContextMenu('shortcutContextMenu', e, idx));
      wrapper.appendChild(btn);

      const iconEl = btn.querySelector('.shortcut-icon');
      setShortcutFallbackIcon(iconEl);

      if (item.icon) {
        setShortcutIcon(iconEl, item.icon, item.url);
      } else {
        fetchFavicon(item.url).then(src => setShortcutIcon(iconEl, src, item.url));
      }

      row.appendChild(wrapper);
    }
  });

  // 拖拽排序
  let dragIndex = null;
  row.querySelectorAll('.shortcut-drag-wrapper').forEach(w => {
    w.addEventListener('dragstart', (e) => {
      dragIndex = parseInt(w.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      w.classList.add('dragging');
    });
    w.addEventListener('dragend', () => {
      w.classList.remove('dragging');
      row.querySelectorAll('.shortcut-drag-wrapper').forEach(x => x.classList.remove('drag-over'));
    });
    w.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.querySelectorAll('.shortcut-drag-wrapper').forEach(x => x.classList.remove('drag-over'));
      w.classList.add('drag-over');
    });
    w.addEventListener('dragleave', () => {
      w.classList.remove('drag-over');
    });
    w.addEventListener('drop', (e) => {
      e.preventDefault();
      w.classList.remove('drag-over');
      const dropIndex = parseInt(w.dataset.index);
      if (dragIndex === null || dragIndex === dropIndex) return;

      const shortcuts = getShortcuts() || [...DEFAULT_SHORTCUTS];
      const [moved] = shortcuts.splice(dragIndex, 1);
      shortcuts.splice(dropIndex, 0, moved);
      saveShortcuts(shortcuts);
      renderShortcuts();
      dragIndex = null;
    });
  });

  // 图片背景下：重渲染后重新贴上场景对比色
  if (
    typeof lastPalette !== 'undefined' &&
    lastPalette &&
    document.body.classList.contains('has-image-bg') &&
    typeof applyShortcutContrastInline === 'function'
  ) {
    applyShortcutContrastInline(lastPalette);
  }
}

/**
 * 渲染设置面板中的快捷导航列表
 */
function renderShortcutList() {
  const list = document.getElementById('shortcutList');
  list.innerHTML = '';
  const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;

  const applyListIcon = (iconWrap, shortcutData) => {
    if (!iconWrap) return;
    iconWrap.innerHTML = '';
    const iconEl = document.createElement('span');
    iconEl.className = 'shortcut-list-icon-inner';
    iconWrap.appendChild(iconEl);
    // 先用首字母占位（与setShortcutFallbackIcon 一致的思路）
    const fallbackChar = (shortcutData.name.charAt(0) || '?').toUpperCase();
    const fallback = document.createElement('span');
    fallback.className = 'shortcut-list-fallback';
    fallback.textContent = fallbackChar;
    iconEl.appendChild(fallback);

    const applyIcon = (src, pageUrl) => {
      if (!src) return;
      createShortcutImg(src, pageUrl, {
        imgClass: 'shortcut-list-icon-img',
        iconEl: iconEl,
        onFailed: () => { /* 保留 fallback */ }
      });
    };

    // 优先缓存
    const urlKey = getUrlKey(shortcutData.url);
    const cache = getIconCache();
    const cached = cache[urlKey];
    if (cached && cached.src) {
      applyIcon(cached.src, shortcutData.url);
    }
    // 用户自定义icon
    if (shortcutData.icon) {
      applyIcon(shortcutData.icon, shortcutData.url);
    } else {
      // 异步 fetch 最新
      fetchFavicon(shortcutData.url, false)
.then(src => {
        if (src) applyIcon(src, shortcutData.url);
      });
    }
  };

  shortcuts.forEach((item, i) => {
    if (item.type === 'folder') {
      // 文件夹头部
      const header = document.createElement('div');
      header.className = 'shortcut-list-folder-header';
      header.innerHTML = `
        <span class="shortcut-list-favicon shortcut-list-folder-favicon" aria-hidden="true">
          <span class="mgc_folder_line" style="font-size:14px;color:var(--text-secondary);line-height:1" aria-hidden="true"></span>
        </span>
        <span class="shortcut-list-name">${escapeHtml(item.name)}</span>
        <button type="button" class="shortcut-list-edit" data-index="${i}" aria-label="编辑 ${escapeAttr(item.name)}">
          <span class="mgc_edit_line" aria-hidden="true"></span>
        </button>
        <button type="button" class="shortcut-list-delete" data-index="${i}" aria-label="删除 ${escapeAttr(item.name)}">
          <span class="mgc_close_line" aria-hidden="true"></span>
        </button>
      `;
      list.appendChild(header);

      // 递归渲染子项（支持多级子文件夹）
      if (item.children && item.children.length > 0) {
        renderShortcutListChildren(list, item.children, i, [], 1, applyListIcon);
      }

      // 文件夹内添加按钮
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'shortcut-list-add-child';
      addBtn.dataset.folderIndex = i;
      addBtn.dataset.path = '';
      addBtn.innerHTML = `<span class="mgc_add_line" style="font-size:12px" aria-hidden="true"></span><span>添加到 ${escapeHtml(item.name)}</span>`;
      list.appendChild(addBtn);
    } else {
      const row = document.createElement('div');
      row.className = 'shortcut-list-item';
      let host = '';
      try { host = new URL(item.url).hostname; } catch {}
      row.innerHTML = `
        <span class="shortcut-list-favicon" aria-hidden="true"></span>
        <span class="shortcut-list-name">${escapeHtml(item.name)}</span>
        <span class="shortcut-list-url" title="${escapeAttr(item.url)}">${escapeHtml(host)}</span>
        <button type="button" class="shortcut-list-edit" data-index="${i}" aria-label="编辑 ${escapeAttr(item.name)}">
          <span class="mgc_edit_line" aria-hidden="true"></span>
        </button>
        <button type="button" class="shortcut-list-delete" data-index="${i}" aria-label="删除 ${escapeAttr(item.name)}">
          <span class="mgc_close_line" aria-hidden="true"></span>
        </button>
      `;
      list.appendChild(row);
      const favWrap = row.querySelector('.shortcut-list-favicon');
      if (favWrap) applyListIcon(favWrap, item);
    }
  });

  // 绑定事件
  bindShortcutListEvents();
}

/**
 * 递归渲染设置列表中的文件夹子项（支持多级子文件夹） * @param {HTMLElement} list - 列表容器
 * @param {Array} children - 子项数组
 * @param {number} folderIndex - 顶层文件夹索式 * @param {Array} path - 当前路径
 * @param {number} depth - 当前深度（=直接子项） * @param {Function} applyListIcon - 图标渲染函数
 */
function renderShortcutListChildren(list, children, folderIndex, path, depth, applyListIcon) {
  const indent = 36 + (depth - 1) * 20;
  const pathStr = path.join('.');

  children.forEach((child, ci) => {
    const currentPath = [...path, ci];
    const currentPathStr = currentPath.join('.');

    if (child.type === 'folder') {
      // 子文件夹头部
      const subHeader = document.createElement('div');
      subHeader.className = 'shortcut-list-subfolder-header';
      subHeader.style.setProperty('--sc-list-indent', indent + 'px');
      subHeader.innerHTML = `
        <span class="shortcut-list-favicon shortcut-list-folder-favicon" aria-hidden="true">
          <span class="mgc_folder_line" style="font-size:12px;color:var(--text-secondary);line-height:1" aria-hidden="true"></span>
        </span>
        <span class="shortcut-list-name">${escapeHtml(child.name)}</span>
        <button type="button" class="shortcut-list-edit" data-folder="${folderIndex}" data-child="${ci}" data-path="${pathStr}" data-subfolder="1" aria-label="编辑 ${escapeAttr(child.name)}">
          <span class="mgc_edit_line" aria-hidden="true"></span>
        </button>
        <button type="button" class="shortcut-list-delete" data-folder="${folderIndex}" data-child="${ci}" data-path="${pathStr}" data-subfolder="1" aria-label="删除 ${escapeAttr(child.name)}">
          <span class="mgc_close_line" aria-hidden="true"></span>
        </button>
      `;
      list.appendChild(subHeader);

      // 递归渲染子文件夹的子项
      if (child.children && child.children.length > 0) {
        renderShortcutListChildren(list, child.children, folderIndex, currentPath, depth + 1, applyListIcon);
      }

      // 子文件夹内添加按钮
      const subAddBtn = document.createElement('button');
      subAddBtn.type = 'button';
      subAddBtn.className = 'shortcut-list-subfolder-add';
      subAddBtn.style.setProperty('--sc-list-indent', (indent + 20) + 'px');
      subAddBtn.dataset.folderIndex = folderIndex;
      subAddBtn.dataset.path = currentPathStr;
      subAddBtn.innerHTML = `<span class="mgc_add_line" style="font-size:11px" aria-hidden="true"></span><span>添加到 ${escapeHtml(child.name)}</span>`;
      list.appendChild(subAddBtn);
    } else {
      // 普通链接项
      const row = document.createElement('div');
      row.className = 'shortcut-list-item shortcut-list-child';
      row.style.paddingLeft = indent + 'px';
      let host = '';
      try { host = new URL(child.url).hostname; } catch {}
      row.innerHTML = `
        <span class="shortcut-list-favicon" aria-hidden="true"></span>
        <span class="shortcut-list-name">${escapeHtml(child.name)}</span>
        <span class="shortcut-list-url" title="${escapeAttr(child.url)}">${escapeHtml(host)}</span>
        <button type="button" class="shortcut-list-edit" data-folder="${folderIndex}" data-child="${ci}" data-path="${pathStr}" aria-label="编辑 ${escapeAttr(child.name)}">
          <span class="mgc_edit_line" aria-hidden="true"></span>
        </button>
        <button type="button" class="shortcut-list-delete" data-folder="${folderIndex}" data-child="${ci}" data-path="${pathStr}" aria-label="删除 ${escapeAttr(child.name)}">
          <span class="mgc_close_line" aria-hidden="true"></span>
        </button>
      `;
      list.appendChild(row);
      const favWrap = row.querySelector('.shortcut-list-favicon');
      if (favWrap) applyListIcon(favWrap, child);
    }
  });
}

function bindShortcutListEvents() {
  const list = document.getElementById('shortcutList');

  // 独立页/ 文件夹头皠编辑
  list.querySelectorAll('.shortcut-list-edit[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const s = shortcuts[idx];
      if (!s) return;
      if (s.type === 'folder') {
        openShortcutModal(idx, s, 'folder');
      } else {
        openShortcutModal(idx, s, 'item');
      }
    });
  });

  // 独立页/ 文件夹头皠删除
  list.querySelectorAll('.shortcut-list-delete[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      deleteShortcutAt(idx);
    });
  });

  // 文件夹内子项的编辑（含子文件夹）
  list.querySelectorAll('.shortcut-list-edit[data-folder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = parseInt(btn.dataset.folder);
      const ci = parseInt(btn.dataset.child);
      const pathStr = btn.dataset.path || '';
      const path = pathStr ? pathStr.split('.').map(Number) : [];
      const isSubfolder = btn.dataset.subfolder === '1';
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const targetFolder = getFolderByPath(shortcuts, fi, path);
      if (!targetFolder || !targetFolder.children || !targetFolder.children[ci]) return;
      const child = targetFolder.children[ci];
      if (isSubfolder || child.type === 'folder') {
        openShortcutModal(fi, child, 'child-folder', ci, path);
      } else {
        openShortcutModal(fi, child, 'child', ci, path);
      }
    });
  });

  // 文件夹内子项的删除（含子文件夹）
  list.querySelectorAll('.shortcut-list-delete[data-folder]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = parseInt(btn.dataset.folder, 10);
      const ci = parseInt(btn.dataset.child, 10);
      const pathStr = btn.dataset.path || '';
      const path = pathStr ? pathStr.split('.').map(Number) : [];
      deleteChildShortcut(fi, ci, path);
    });
  });

  // 文件夹内添加按钮（含子文件夹的添加按钮）
  list.querySelectorAll('.shortcut-list-add-child, .shortcut-list-subfolder-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const fi = parseInt(btn.dataset.folderIndex);
      const pathStr = btn.dataset.path || '';
      const path = pathStr ? pathStr.split('.').map(Number) : [];
      openShortcutModal(fi, null, 'new-child', undefined, path);
    });
  });
}

/**
 * 规范区URL：无协议时补 https://
 */
function normalizeShortcutUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return 'https://' + raw;
}

/**
 * 深拷贝默认快捷方式（避免直接改常量）
 */
function cloneDefaultShortcuts() {
  return DEFAULT_SHORTCUTS.map((s) => ({
    ...s,
    children: s.children ? [...s.children] : undefined
  }));
}

/**
 * 弹窗确认：按 editingShortcutType 写入 shortcuts
 */
function confirmShortcutModal() {
  const nameInput = document.getElementById('shortcutName');
  const urlInput = document.getElementById('shortcutUrl');
  const iconInput = document.getElementById('shortcutIcon');
  if (!nameInput) return;

  const errorEl = document.getElementById('shortcutModalError');
  const name = nameInput.value.trim();
  let url = urlInput ? urlInput.value.trim() : '';
  const icon = iconInput ? iconInput.value.trim() : '';
  if (typeof clearModalValidation === 'function') {
    clearModalValidation(errorEl, [nameInput, urlInput, iconInput]);
  }
  if (!name) {
    if (typeof setModalError === 'function') setModalError(errorEl, '请填写名称', nameInput);
    nameInput.focus();
    return;
  }

  const shortcuts = getShortcuts() || cloneDefaultShortcuts();
  const type = editingShortcutType;

  // 需要链接的分支统一校验
  const requiresUrl = type === 'new-child' || type === 'child' || type === 'item' || type === 'insert-item';
  if (requiresUrl && !url) {
    if (typeof setModalError === 'function') setModalError(errorEl, '请填写链接', urlInput);
    if (urlInput) urlInput.focus();
    return;
  }
  if (requiresUrl) url = normalizeShortcutUrl(url);

  // 文件夹内操作统一取目标文件夹
  const needsTargetFolder = type === 'new-child-folder' || type === 'child-folder' || type === 'new-child' || type === 'child';
  const targetFolder = needsTargetFolder ? getFolderByPath(shortcuts, editingShortcutIndex, editingShortcutPath) : null;

  if (type === 'folder' || type === 'new-folder' || type === 'insert-folder') {
    const isNew = type === 'new-folder' || type === 'insert-folder';
    if (isNew) {
      const folder = { type: 'folder', name, children: [] };
      if (type === 'insert-folder' && editingShortcutIndex >= 0) {
        shortcuts.splice(editingShortcutIndex, 0, folder);
      } else {
        shortcuts.push(folder);
      }
    } else {
      shortcuts[editingShortcutIndex].name = name;
    }
  } else if (type === 'new-child-folder') {
    // 在文件夹内（可嵌套）新建子文件夹
    if (targetFolder) {
      if (!targetFolder.children) targetFolder.children = [];
      targetFolder.children.push({ type: 'folder', name, children: [] });
    }
  } else if (type === 'child-folder') {
    // 重命名文件夹内的子文件夹
    if (targetFolder && targetFolder.children && targetFolder.children[editingShortcutChild]) {
      targetFolder.children[editingShortcutChild].name = name;
    }
  } else if (type === 'new-child') {
    if (targetFolder) {
      if (!targetFolder.children) targetFolder.children = [];
      targetFolder.children.push({ name, url, icon: icon || '' });
    }
  } else if (type === 'child') {
    if (targetFolder && targetFolder.children) {
      targetFolder.children[editingShortcutChild] = { name, url, icon: icon || '' };
    }
  } else {
    // 独立项：编辑 / 插入 / 新增
    const entry = { name, url, icon: icon || '' };
    if (type === 'insert-item' && editingShortcutIndex >= 0) {
      shortcuts.splice(editingShortcutIndex, 0, entry);
    } else if (editingShortcutIndex >= 0 && type !== 'insert-item') {
      shortcuts[editingShortcutIndex] = entry;
    } else {
      shortcuts.push(entry);
    }
  }

  saveShortcuts(shortcuts);
  renderShortcutList();
  renderShortcuts();
  closeShortcutModal();
}

/**
 * 删除顶层快捷项（主页右键 / 设置列表共用） */
function deleteShortcutAt(index) {
  const shortcuts = getShortcuts() || [...DEFAULT_SHORTCUTS];
  const target = shortcuts[index];
  if (!target) return;
  const label = target.type === 'folder' ? `文件夹「${target.name}」` : `快捷方式「${target.name}」`;
  if (!window.confirm(`确定删除${label}？`)) return;
  shortcuts.splice(index, 1);
  saveShortcuts(shortcuts);
  renderShortcuts();
  if (typeof isSettingsOpen === 'function' && isSettingsOpen()) {
    renderShortcutList();
  }
}

/**
 * 删除文件夹内子项（支持多级路径）
 */
function deleteChildShortcut(folderIndex, childIndex, path) {
  const shortcuts = getShortcuts() || [...DEFAULT_SHORTCUTS];
  const targetFolder = getFolderByPath(shortcuts, folderIndex, path);
  if (!targetFolder || !targetFolder.children || !targetFolder.children[childIndex]) return;
  const child = targetFolder.children[childIndex];
  const label = child.type === 'folder' ? `子文件夹 ${child.name}」` : `快捷方式 ${child.name}」`;
  if (!window.confirm(`确定删除${label}？`)) return;
  targetFolder.children.splice(childIndex, 1);
  saveShortcuts(shortcuts);
  renderShortcuts();
  if (typeof isSettingsOpen === 'function' && isSettingsOpen()) {
    renderShortcutList();
  }
}

/**
 * 设置面板 + 主页：快捷导航弹窗与右键菜单
 * 用initSettings() 调用一次 */
function initShortcutSettings() {
  bindFolderExpandDirSetting();

  const shortcutModal = document.getElementById('shortcutModal');

  const closeBtn = document.getElementById('shortcutModalClose');
  const cancelBtn = document.getElementById('shortcutModalCancel');
  const confirmBtn = document.getElementById('shortcutModalConfirm');

  if (closeBtn) closeBtn.addEventListener('click', closeShortcutModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeShortcutModal);
  if (confirmBtn) confirmBtn.addEventListener('click', confirmShortcutModal);

  if (shortcutModal) {
    shortcutModal.addEventListener('click', (e) => {
      if (e.target === shortcutModal) closeShortcutModal();
    });
  }

  ['shortcutName', 'shortcutUrl', 'shortcutIcon'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      const errorEl = document.getElementById('shortcutModalError');
      if (typeof clearModalValidation === 'function') {
        clearModalValidation(errorEl, [
          document.getElementById('shortcutName'),
          document.getElementById('shortcutUrl'),
          document.getElementById('shortcutIcon'),
        ]);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmShortcutModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeShortcutModal();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('shortcutModal');
    if (!modal || !modal.classList.contains('active')) return;
    e.preventDefault();
    closeShortcutModal();
  });

  // 全局：点出/ 右键空白处/ 滚动缩放时收起菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideShortcutContextMenu();
    }
    // 点子面板/子胶囊以外的空白（含主面板内标签间隙）→ 收起所有子面板
    const inSubArea =
      e.target.closest('.shortcut-expanded-subfolder') ||
      e.target.closest('.shortcut-expanded-subfolder-children');
    if (!inSubArea) {
      document.querySelectorAll('.shortcut-expanded-subfolder.open').forEach(collapseSubfolder);
    }
    if (!e.target.closest('.shortcut-folder') && !e.target.closest('.shortcut-expanded-subfolder')) {
      document.querySelectorAll('.shortcut-folder.open').forEach((f) => {
        f.classList.remove('open');
        const trigger = f.querySelector('.shortcut-folder-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
      // 恢复问候语
      document.body.classList.remove('folder-open');
      stopFolderShiftFollow();
      document.documentElement.style.setProperty('--folder-shift', '0px');
    }
  });
  // 全局阻止原生右键菜单：整个新标签页都用应用自定义菜单
  document.addEventListener('contextmenu', (e) => {
    // 输入桰文本域保留原生菜单（复制/粘贴等功能）
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
    if (!isInput) {
      e.preventDefault();
    }
    // 如果点击的不是任何快捷方式相关元素，隐藏自定义菜单    // .shortcut-folder-trigger / .shortcut-expanded-item 本身带.shortcut-btn 类，无需重复匹配
    if (!e.target.closest('.shortcut-btn') && !e.target.closest('.shortcuts-row')) {
      hideShortcutContextMenu();
    }
  });
  window.addEventListener('resize', hideShortcutContextMenu);
  window.addEventListener('scroll', hideShortcutContextMenu);

  // 右键菜单：普通快捷按钮
  const ctxEdit = document
.getElementById('ctxEdit');
  const ctxDelete = document.getElementById('ctxDelete');
  const ctxAddRight = document.getElementById('ctxAddRight');
  const ctxAddFolderRight = document.getElementById('ctxAddFolderRight');

  // 公共 handler：供 ctx* 与fCtx* 共用
  const handleCtxDelete = () => {
    deleteShortcutAt(contextMenuTarget);
    hideShortcutContextMenu();
  };
  const handleCtxAddRight = () => {
    openShortcutModal(contextMenuTarget + 1, null, 'insert-item');
    hideShortcutContextMenu();
  };
  const handleCtxAddFolderRight = () => {
    openShortcutModal(contextMenuTarget + 1, null, 'insert-folder');
    hideShortcutContextMenu();
  };

  if (ctxEdit) {
    ctxEdit.addEventListener('click', () => {
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const s = shortcuts[contextMenuTarget];
      if (!s) return;
      openShortcutModal(contextMenuTarget, s, s.type === 'folder' ? 'folder' : 'item');
      hideShortcutContextMenu();
    });
  }
  if (ctxDelete) {
    ctxDelete.addEventListener('click', handleCtxDelete);
  }
  if (ctxAddRight) {
    ctxAddRight.addEventListener('click', handleCtxAddRight);
  }
  if (ctxAddFolderRight) {
    ctxAddFolderRight.addEventListener('click', handleCtxAddFolderRight);
  }

  // 右键菜单：快捷栏空白
  const barAddItem = document.getElementById('barAddItem');
  const barAddFolder = document.getElementById('barAddFolder');
  const shortcutsRow = document.getElementById('shortcutsRow');

  if (barAddItem) {
    barAddItem.addEventListener('click', () => {
      openShortcutModal(-1, null, 'item');
      hideShortcutContextMenu();
    });
  }
  if (barAddFolder) {
    barAddFolder.addEventListener('click', () => {
      openShortcutModal(-1, null, 'new-folder');
      hideShortcutContextMenu();
    });
  }
  if (shortcutsRow) {
    shortcutsRow.addEventListener('contextmenu', (e) => {
      if (
        !e.target.closest('.shortcut-btn') &&
        !e.target.closest('.shortcut-folder') &&
        !e.target.closest('.shortcut-drag-wrapper')
      ) {
        showContextMenu('shortcutsBarContextMenu', e, -1);
      }
    });
  }

  // 右键菜单：文件夹
  const fCtxEdit = document.getElementById('fCtxEdit');
  const fCtxAdd = document.getElementById('fCtxAdd');
  const fCtxAddSubfolder = document.getElementById('fCtxAddSubfolder');
  const fCtxDelete = document.getElementById('fCtxDelete');
  const fCtxAddRight = document.getElementById('fCtxAddRight');
  const fCtxAddFolderRight = document.getElementById('fCtxAddFolderRight');

  if (fCtxEdit) {
    fCtxEdit.addEventListener('click', () => {
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const s = shortcuts[contextMenuTarget];
      if (s) openShortcutModal(contextMenuTarget, s, 'folder');
      hideShortcutContextMenu();
    });
  }
  if (fCtxAdd) {
    fCtxAdd.addEventListener('click', () => {
      openShortcutModal(contextMenuTarget, null, 'new-child', undefined, []);
      hideShortcutContextMenu();
    });
  }
  if (fCtxAddSubfolder) {
    fCtxAddSubfolder.addEventListener('click', () => {
      openShortcutModal(contextMenuTarget, null, 'new-child-folder', undefined, []);
      hideShortcutContextMenu();
    });
  }
  if (fCtxDelete) {
    fCtxDelete.addEventListener('click', handleCtxDelete);
  }
  if (fCtxAddRight) {
    fCtxAddRight.addEventListener('click', handleCtxAddRight);
  }
  if (fCtxAddFolderRight) {
    fCtxAddFolderRight.addEventListener('click', handleCtxAddFolderRight);
  }

  // 右键菜单：文件夹内链接项
  const cCtxEdit = document.getElementById('cCtxEdit');
  const cCtxDelete = document.getElementById('cCtxDelete');
  const cCtxAddRight = document.getElementById('cCtxAddRight');
  const cCtxAddFolderRight = document.getElementById('cCtxAddFolderRight');

  if (cCtxEdit) {
    cCtxEdit.addEventListener('click', () => {
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const folder = getFolderByPath(shortcuts, contextMenuTarget, contextMenuPath);
      if (folder && folder.children && folder.children[contextMenuChildTarget] != null) {
        openShortcutModal(contextMenuTarget, folder.children[contextMenuChildTarget], 'child', contextMenuChildTarget, contextMenuPath);
      }
      hideShortcutContextMenu();
    });
  }
  if (cCtxDelete) {
    cCtxDelete.addEventListener('click', () => {
      deleteChildShortcut(contextMenuTarget, contextMenuChildTarget, contextMenuPath);
      hideShortcutContextMenu();
    });
  }
  if (cCtxAddRight) {
    cCtxAddRight.addEventListener('click', () => {
      openShortcutModal(contextMenuTarget, null, 'new-child', undefined, contextMenuPath);
      hideShortcutContextMenu();
    });
  }
  if (cCtxAddFolderRight) {
    cCtxAddFolderRight.addEventListener('click', () => {
      openShortcutModal(contextMenuTarget, null, 'new-child-folder', undefined, contextMenuPath);
      hideShortcutContextMenu();
    });
  }

  // 右键菜单：文件夹内子文件夹
  const cfCtxEdit = document
.getElementById('cfCtxEdit');
  const cfCtxAdd = document.getElementById('cfCtxAdd');
  const cfCtxAddSubfolder = document.getElementById('cfCtxAddSubfolder');
  const cfCtxDelete = document.getElementById('cfCtxDelete');

  if (cfCtxEdit) {
    cfCtxEdit.addEventListener('click', () => {
      const shortcuts = getShortcuts() || DEFAULT_SHORTCUTS;
      const folder = getFolderByPath(shortcuts, contextMenuTarget, contextMenuPath);
      if (folder && folder.children && folder.children[contextMenuChildTarget] != null) {
        openShortcutModal(contextMenuTarget, folder.children[contextMenuChildTarget], 'child-folder', contextMenuChildTarget, contextMenuPath);
      }
      hideShortcutContextMenu();
    });
  }
  if (cfCtxAdd) {
    cfCtxAdd.addEventListener('click', () => {
      // 在子文件夹内添加快捷方式：路径需要包含当前子文件夹索引
      const newPath = [...contextMenuPath, contextMenuChildTarget];
      openShortcutModal(contextMenuTarget, null, 'new-child', undefined, newPath);
      hideShortcutContextMenu();
    });
  }
  if (cfCtxAddSubfolder) {
    cfCtxAddSubfolder.addEventListener('click', () => {
      const newPath = [...contextMenuPath, contextMenuChildTarget];
      openShortcutModal(contextMenuTarget, null, 'new-child-folder', undefined, newPath);
      hideShortcutContextMenu();
    });
  }
  if (cfCtxDelete) {
    cfCtxDelete.addEventListener('click', () => {
      deleteChildShortcut(contextMenuTarget, contextMenuChildTarget, contextMenuPath);
      hideShortcutContextMenu();
    });
  }
}

/* ==========================================================================
 * 浏览器收藏夹（书签）导入（Netscape Bookmark File Format / .html） *   Chrome / Edge / Firefox / Safari 导出的书签均兼容此格式 * ========================================================================== */

/**
 * 判断 URL 是否属于可导入的「用户网页」 *   剔除浏览器内部协议，保证导入后都能正常打开
 */
function isBookmarkUrlUsable(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const proto = u.protocol.toLowerCase();
    if (['http:', 'https:', 'ftp:', 'ftps:'].indexOf(proto) !== -1) return true;
    // 常见内部协议直接排除，避免误导入
    return false;
  } catch (_) {
    return /^https?:\/\//i.test(url.trim());
  }
}

/**
 * 把书签HTML 中的一中<DL> 节点递归解析与AstrGO 快捷导航数组
 *   DT -> H3  -> folder （其后紧跟的 <DL> 才是它的子项） *   DT -> A   -> link   （读句HREF、textContent、可选 ICON / ICON_URI） */
function parseBookmarkDL(dlEl, depthLimit) {
  depthLimit = typeof depthLimit === 'number' ? depthLimit : 20;
  if (!dlEl || depthLimit <= 0) return [];
  const out = [];
  const children = dlEl.children || [];
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (!el || el.tagName !== 'DT') continue;

    const firstChild = el.firstElementChild;
    if (!firstChild) continue;

    if (firstChild.tagName === 'H3') {
      // 文件夹：找到紧随其后的<DL>（标准格式），或者兼容嵌套在 DT 内部的写法
      const folderName = firstChild.textContent.trim() || '未命名文件夹';
      let nextDL = null;
      if (el.nextElementSibling && el.nextElementSibling.tagName === 'DL') {
        nextDL = el.nextElementSibling;
      } else {
        const inner = el.querySelector(':scope > DL');
        if (inner) nextDL = inner;
      }
      const children2 = nextDL ? parseBookmarkDL(nextDL, depthLimit - 1) : [];
      // 跳过空文件夹（避免导入大量空的系统默认文件夹，用户可以手动再建）
      if (children2.length) {
        out.push({ type: 'folder', name: folderName, children: children2 });
      }
      // 如果 DL 是sibling，跳过它避免重复解析
      if (nextDL && el.nextElementSibling === nextDL) i++;
    } else if (firstChild.tagName === 'A') {
      const link = firstChild;
      // getAttribute 大小写不敏感，无需两个分支
      const href = link.getAttribute('href') || '';
      const name = (link.textContent || '').trim() || href;
      if (!isBookmarkUrlUsable(href)) continue;
      // 可选：浏览器导出时会把 favicon 件ICON dataURL 写进来，直接复用
      const iconAttr = link.getAttribute('icon') || '';
      const entry = { name, url: href };
      if (/^data:image\//i.test(iconAttr)) entry.icon = iconAttr;
      out.push(entry);
    }
  }
  return out;
}

/**
 * 解析浏览器导出的书签 HTML
 *   返回 { items, stats: { total, folders, skipped } }
 *   items 是「扁平化的顶层条目数组」，子项通过 folder.children 嵌套
 */
function parseBrowserBookmarksHTML(htmlText) {
  const stats = { total: 0, folders: 0, skipped: 0 };
  const doc = new DOMParser().parseFromString(
    String(htmlText || ''),
    'text/html'
  );
  // 标准格式下最外层 <DL> 直接在<body> �?
  const outerDL = doc.querySelector('body > DL, body > dl') || doc
.querySelector('DL, dl');
  let items = outerDL ? parseBookmarkDL(outerDL, 20) : [];

  // 去重（按 URL + 父级文件夹名，简单按 URL 去重；文件夹用 name+children 哈希）
  const seenUrls = new Set();
  const dedupFlat = (arr) => {
    const out = [];
    arr.forEach(it => {
      if (it.type === 'folder') {
        const newChildren = dedupFlat(it.children || []);
        if (newChildren.length) {
          out.push({ type: 'folder', name: it.name, children: newChildren });
          stats.folders += 1;
        }
      } else {
        try {
          const key = new URL(it.url).toString();
          if (seenUrls.has(key)) { stats.skipped += 1; return; }
          seenUrls.add(key);
          out.push(it);
          stats.total += 1;
        } catch (_) {
          stats.skipped += 1;
        }
      }
    });
    return out;
  };
  items = dedupFlat(items);
  return { items, stats };
}

/**
 * 把解析出的书签条目合并到当前快捷导航
 *   默认策略：追加到现有列表末尾，不覆盖原有的 *   返回 { added, merged, folderCount }
 */
function mergeImportedBookmarks(importedItems) {
  const current = getShortcuts() ? [...getShortcuts()] : [];
  let added = 0;
  let folderCount = 0;

  const countItems = (arr) => {
    let n = 0;
    (arr || []).forEach(it => {
      if (it.type === 'folder') { folderCount += 1; n += countItems(it.children); }
      else n += 1;
    });
    return n;
  };

  // 追加导入（保留用户原有的顺序）
  (importedItems || []).forEach(it => current.push(it));
  added = countItems(importedItems);
  saveShortcuts(current);
  return { added, merged: true, folderCount };
}

/**
 * 从文件读取并导入浏览器书签 *   tipElementId 指定显示提示的元素ID（数据页 / 收藏夹页共用） */
function importBrowserBookmarksFromFile(file, tipElementId) {
  const tipEl = document.getElementById(tipElementId || 'importBookmarksTip');
  const setTip = (msg) => {
    if (!tipEl) return;
    tipEl.hidden = false;
    tipEl.textContent = msg || '';
  };
  if (!file) return Promise.resolve({ ok: false, reason: 'no_file' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      setTip('读取书签文件失败，请换一个文件重试');
      resolve({ ok: false, reason: 'read_error' });
    };
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        // 粗略校验文件格式（Netscape Bookmark DOCTYPE / 常见 HTML 结构（
        if (!/<DL[\s>]/i.test(raw) && !/<dl[\s>]/i.test(raw)) {
          setTip('文件不是标准的浏览器书签 HTML 格式');
          resolve({ ok: false, reason: 'bad_format' });
          return;
        }
        const parsed = parseBrowserBookmarksHTML(raw);
        if (!parsed.items.length) {
          const msg =
            parsed.stats.skipped > 0
              ? '没有找到可导入的书签（已跳过 ' + parsed.stats.skipped + ' 条内部链接）'
              : '没有找到可导入的书签';
          setTip(msg);
          resolve({ ok: false, reason: 'empty', stats: parsed.stats });
          return;
        }
        const merged = mergeImportedBookmarks(parsed.items);
        const suffix =
          merged.folderCount > 0 ? '（含 ' + merged.folderCount + ' 个文件夹）' : '';
        setTip(
          '已导入' + merged.added + ' 个书签' + suffix +
          (parsed.stats.skipped ? '，跳过' + parsed.stats.skipped + ' 条重复或不可用链接' : '')
        );
        // 重新渲染
        try {
          if (typeof renderShortcuts === 'function') renderShortcuts();
          if (typeof renderShortcutList === 'function') renderShortcutList();
        } catch (_) {}
        resolve({ ok: true, added: merged.added, stats: parsed.stats, folderCount: merged.folderCount });
      } catch (err) {
        setTip('导入时发生错误：' + (err && err.message ? err.message : String(err)));
        resolve({ ok: false, reason: 'error', error: err });
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

/** 收藏夹页面入口（复用通用导入函数）*/
function importBrowserBookmarksFromFileShortcuts(file) {
  return importBrowserBookmarksFromFile(file, 'importBookmarksTipShortcuts');
}

/**
 * 绑定「导入浏览器收藏夹」按钮（國DOMContentLoaded 后挂到文档里） * 本地 HTML 文件导入无需权限开关，直接可用。 * 浏览器书签直接同步为高度敏感权限，需用户手动开启。 */
const BOOKMARK_SYNC_PERMISSION_KEY = 'moonfog_bookmark_sync_enabled';

function isBookmarkSyncEnabled() {
  try {
    return localStorage.getItem(BOOKMARK_SYNC_PERMISSION_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function setBookmarkSyncEnabled(enabled) {
  try {
    localStorage.setItem(BOOKMARK_SYNC_PERMISSION_KEY, enabled ? '1' : '0');
  } catch (_) {}
}

function updateBookmarkSyncUI() {
  const toggle = document.getElementById('bookmarkSyncPermissionToggle');
  const statusEl = document.getElementById('bookmarkSyncStatus');
  if (toggle) {
    toggle.checked = isBookmarkSyncEnabled();
  }
  if (statusEl) {
    const enabled = isBookmarkSyncEnabled();
    if (enabled) {
      statusEl.hidden = false;
      // 检查 chrome.bookmarks API 是否可用
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        statusEl.textContent = '已授权同步。点击下方按钮可从浏览器书签直接导入。';
      } else {
        statusEl.textContent = '当前浏览器不支持直接同步书签 API，请使用 HTML 文件导入。';
      }
    } else {
      statusEl.hidden = true;
    }
  }
}

function bindImportBookmarksUI() {
  // 通用导入按钮绑定（数据页 / 收藏夹页结构相同）
  const bindImportButton = (btnId, inputId, importFn) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (btn && input && btn.dataset.bound !== '1') {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (file) importFn(file);
      });
    }
  };
  bindImportButton('importBookmarksBtn', 'importBookmarksInput', importBrowserBookmarksFromFile);
  bindImportButton('importBookmarksBtnShortcuts', 'importBookmarksInputShortcuts', importBrowserBookmarksFromFileShortcuts);

  // 浏览器书签直接同步开关（高度敏感权限）
  const syncToggle = document
.getElementById('bookmarkSyncPermissionToggle');
  if (syncToggle && syncToggle.dataset.bound !== '1') {
    syncToggle.dataset.bound = '1';
    syncToggle.checked = isBookmarkSyncEnabled();
    syncToggle.addEventListener('change', () => {
      setBookmarkSyncEnabled(syncToggle.checked);
      updateBookmarkSyncUI();
    });
  }

  // 初始化同步UI 状态
  updateBookmarkSyncUI();
}
