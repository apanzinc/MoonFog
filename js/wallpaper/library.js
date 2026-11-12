/**
 * MoonFog - Wallpaper Library
 * 背景库条目（图片/视频/动效/纯色）+ 源（必应/.wdd/API/用户方案）
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const ITEMS_KEY = 'moonfog_wallpaper_items';
  const SOURCES_KEY = 'moonfog_wallpaper_sources';
  const DB_NAME = 'moonfog-wallpaper';
  const STORE = 'blobs';
  const DB_VERSION = 1;
  const EVENT_ITEMS = 'moonfog-wp-items-change';
  const EVENT_SOURCES = 'moonfog-wp-sources-change';
  const VIDEO_MAX_BYTES = 120 * 1024 * 1024;

  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i;
  const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i;

  let dbPromise = null;
  const blobUrlCache = new Map();
  let initPromise = null;

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('[MoonFogWp] 写入失败:', err);
      return false;
    }
  }

  function emit(type) {
    try {
      window.dispatchEvent(new CustomEvent(type, { detail: { type: type } }));
    } catch (_) {}
  }

  function uid(prefix) {
    return (prefix || 'wp') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 不可用'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('打开壁纸数据库失败'));
      req.onblocked = () => reject(new Error('壁纸数据库被占用'));
    });
    return dbPromise;
  }

  async function idbPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('写入壁纸数据失败'));
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('读取壁纸数据失败'));
    });
  }

  async function idbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('删除壁纸数据失败'));
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(',');
    const head = parts[0] || '';
    const body = parts[1] || '';
    const mime = (head.match(/:(.*?);/) || [])[1] || 'application/octet-stream';
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  function stripExt(name) {
    return String(name || '未命名').replace(/\.[^.]+$/, '').trim() || '未命名';
  }

  function kindFromFile(file) {
    if (file && typeof file.type === 'string') {
      if (file.type.indexOf('video/') === 0) return 'video';
      if (file.type.indexOf('image/') === 0) return 'image';
    }
    return VIDEO_EXT.test(file && file.name) ? 'video' : 'image';
  }

  function kindFromUrl(url) {
    return VIDEO_EXT.test(String(url)) ? 'video' : 'image';
  }

  // ==================== 背景库条目 ====================

  function listItems(kind) {
    const items = readJson(ITEMS_KEY).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!kind) return items;
    return items.filter((item) => item.kind === kind);
  }

  function getItem(id) {
    if (!id) return null;
    return readJson(ITEMS_KEY).find((item) => item.id === id) || null;
  }

  async function addImageFile(file) {
    const compressed = typeof window.compressImageFile === 'function'
      ? await window.compressImageFile(file) : await readFileAsDataUrl(file);
    return addPreparedImage(compressed, stripExt(file.name));
  }

  // 引导中已压缩的图片直接入库，避免再读原文件、再次解码压缩。
  async function addPreparedImage(dataUrl, name) {
    if (!/^data:image\//i.test(String(dataUrl))) throw new Error('无效的图片');
    const item = {
      id: uid('image'),
      kind: 'image',
      source: 'local',
      name: String(name || '本地图片').slice(0, 60),
      createdAt: Date.now()
    };
    await idbPut(item.id, dataUrlToBlob(dataUrl));
    if (!writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]))) {
      await idbDelete(item.id);
      throw new Error('图片未能保存');
    }
    emit(EVENT_ITEMS);
    return item;
  }

  async function addVideoFile(file) {
    if (file.size > VIDEO_MAX_BYTES) throw new Error('视频超过 120MB');
    const item = {
      id: uid('video'),
      kind: 'video',
      source: 'local',
      name: stripExt(file.name),
      createdAt: Date.now()
    };
    await idbPut(item.id, file);
    writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]));
    emit(EVENT_ITEMS);
    return item;
  }

  async function addMediaFiles(files) {
    const added = [];
    for (const file of Array.from(files || [])) {
      if (!file) continue;
      const kind = kindFromFile(file);
      const item = kind === 'video' ? await addVideoFile(file) : await addImageFile(file);
      added.push(item);
    }
    return added;
  }

  async function addImageUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) throw new Error('请输入图片地址');
    let normalized = raw;
    if (normalized.indexOf('//') === 0) normalized = 'https:' + normalized;
    if (!/^(https?:|data:|blob:)/i.test(normalized)) throw new Error('只支持 http/https 地址');
    const item = {
      id: uid('image'),
      kind: 'image',
      source: 'online',
      name: '在线图片',
      url: normalized,
      createdAt: Date.now()
    };
    writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]));
    emit(EVENT_ITEMS);
    return item;
  }

  async function addVideoUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) throw new Error('请输入视频地址');
    let normalized = raw;
    if (normalized.indexOf('//') === 0) normalized = 'https:' + normalized;
    if (!/^(https?:|blob:)/i.test(normalized)) throw new Error('只支持 http/https 地址');
    const item = {
      id: uid('video'),
      kind: 'video',
      source: 'online',
      name: '在线视频',
      url: normalized,
      createdAt: Date.now()
    };
    writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]));
    emit(EVENT_ITEMS);
    return item;
  }

  function addSolid(name, color) {
    const item = {
      id: uid('solid'),
      kind: 'solid',
      source: 'built-in',
      name: String(name || '纯色').slice(0, 40),
      color: String(color || '#F5F0E8'),
      createdAt: Date.now()
    };
    writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]));
    emit(EVENT_ITEMS);
    return item;
  }

  function addEffect(name, effect, params) {
    const item = {
      id: uid('effect'),
      kind: 'effect',
      source: 'built-in',
      name: String(name || '动效').slice(0, 40),
      effect: String(effect || 'grain'),
      params: params && typeof params === 'object' ? params : {},
      createdAt: Date.now()
    };
    writeJson(ITEMS_KEY, readJson(ITEMS_KEY).concat([item]));
    emit(EVENT_ITEMS);
    return item;
  }

  async function removeItem(id) {
    if (!id) return false;
    const items = readJson(ITEMS_KEY);
    if (!items.find((item) => item.id === id)) return false;
    writeJson(ITEMS_KEY, items.filter((item) => item.id !== id));
    try {
      await idbDelete(id);
    } catch (_) {}
    const cached = blobUrlCache.get(id);
    if (cached) {
      try { URL.revokeObjectURL(cached); } catch (_) {}
      blobUrlCache.delete(id);
    }
    emit(EVENT_ITEMS);
    return true;
  }

  function renameItem(id, name) {
    const items = readJson(ITEMS_KEY);
    const item = items.find((entry) => entry.id === id);
    if (!item) return null;
    item.name = String(name || '').trim().slice(0, 60) || item.name;
    writeJson(ITEMS_KEY, items);
    emit(EVENT_ITEMS);
    return item;
  }

  async function getBlobUrl(id) {
    if (!id) return '';
    if (blobUrlCache.has(id)) return blobUrlCache.get(id);
    try {
      const blob = await idbGet(id);
      if (!blob) return '';
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(id, url);
      return url;
    } catch (err) {
      console.warn('[MoonFogWp] 读取 blob 失败:', err);
      return '';
    }
  }

  async function resolveItemUrl(item) {
    if (!item) return '';
    if (item.url) return item.url;
    if (item.blobKey || item.id) return getBlobUrl(item.blobKey || item.id);
    return '';
  }

  function getCover(item) {
    if (!item) return '';
    if (item.kind === 'solid') return '';
    if (item.kind === 'effect') return '';
    if (item.url) return item.url;
    return '';
  }

  // ==================== 源 ====================

  function listSources() {
    return readJson(SOURCES_KEY).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getSource(id) {
    if (!id) return null;
    return readJson(SOURCES_KEY).find((s) => s.id === id) || null;
  }

  function addSource(kind, name, config) {
    const item = {
      id: uid('source'),
      kind: String(kind),
      name: String(name || '源').slice(0, 40),
      config: config && typeof config === 'object' ? config : {},
      createdAt: Date.now()
    };
    writeJson(SOURCES_KEY, readJson(SOURCES_KEY).concat([item]));
    emit(EVENT_SOURCES);
    return item;
  }

  function removeSource(id) {
    if (!id) return false;
    const sources = readJson(SOURCES_KEY);
    if (!sources.find((s) => s.id === id)) return false;
    writeJson(SOURCES_KEY, sources.filter((s) => s.id !== id));
    emit(EVENT_SOURCES);
    return true;
  }

  function renameSource(id, name) {
    const sources = readJson(SOURCES_KEY);
    const source = sources.find((s) => s.id === id);
    if (!source) return null;
    source.name = String(name || '').trim().slice(0, 60) || source.name;
    writeJson(SOURCES_KEY, sources);
    emit(EVENT_SOURCES);
    return source;
  }

  function ensureBuiltinSources() {
    const sources = readJson(SOURCES_KEY);
    let changed = false;
    if (!sources.find((s) => s.kind === 'bing')) {
      sources.push({
        id: uid('source'),
        kind: 'bing',
        name: '必应每日',
        config: {},
        builtIn: true,
        createdAt: Date.now()
      });
      changed = true;
    }
    if (changed) {
      writeJson(SOURCES_KEY, sources);
      emit(EVENT_SOURCES);
    }
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try { await openDb(); } catch (err) { console.warn('[MoonFogWp] IndexedDB 失败:', err); }
      ensureBuiltinSources();
      return true;
    })();
    return initPromise;
  }

  WP.library = {
    init,
    listItems,
    getItem,
    addMediaFiles,
    addImageUrl,
    addPreparedImage,
    addVideoUrl,
    addSolid,
    addEffect,
    removeItem,
    renameItem,
    resolveItemUrl,
    getCover,
    listSources,
    getSource,
    addSource,
    removeSource,
    renameSource,
    ITEM_KINDS: { image: '图片', video: '视频', effect: '动效', solid: '纯色' },
    SOURCE_KINDS: { bing: '必应每日', wdd: '.wdd 时间表', api: '第三方 API', scheme: '用户方案' }
  };
})();
