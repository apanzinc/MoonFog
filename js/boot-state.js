/**
 * MoonFog - Boot 状态管理器
 * 替代 window.__MOONFOG_* 全局变量，提供类型安全的 API
 * 必须在 boot-utils.js 之后加载
 */

(function() {
  'use strict';

  const STATE_KEYS = {
    BOOT_CONFIG: 'bootConfig',
    BOOT_QUOTE: 'bootQuote',
    PAINT_GREETING_FN: 'paintGreetingFn',
    GREETING_PAINTED_FN: 'greetingPaintedFn',
    BOOT_UTILS: 'bootUtils'
  };

  const state = new Map();
  const subscribers = new Map();

  function notify(key) {
    const handlers = subscribers.get(key) || new Set();
    const value = state.get(key);
    handlers.forEach(fn => {
      try { fn(value); } catch (_) {}
    });
  }

  function subscribe(key, fn) {
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(fn);
    // 立即通知当前值
    if (state.has(key)) fn(state.get(key));
    return () => subscribers.get(key).delete(fn);
  }

  window.__MOONFOG_STATE__ = {
    // Boot 配置
    setBootConfig(config) {
      state.set(STATE_KEYS.BOOT_CONFIG, config);
      notify(STATE_KEYS.BOOT_CONFIG);
    },
    getBootConfig() {
      return state.get(STATE_KEYS.BOOT_CONFIG) || {};
    },
    onBootConfig(fn) {
      return subscribe(STATE_KEYS.BOOT_CONFIG, fn);
    },

    // Boot 引用的一言
    setBootQuote(quote) {
      state.set(STATE_KEYS.BOOT_QUOTE, quote);
      notify(STATE_KEYS.BOOT_QUOTE);
    },
    getBootQuote() {
      return state.get(STATE_KEYS.BOOT_QUOTE);
    },
    takeBootQuote() {
      const quote = state.get(STATE_KEYS.BOOT_QUOTE);
      state.delete(STATE_KEYS.BOOT_QUOTE);
      return quote;
    },
    onBootQuote(fn) {
      return subscribe(STATE_KEYS.BOOT_QUOTE, fn);
    },

    // 问候绘制函数
    setPaintGreeting(fn) {
      state.set(STATE_KEYS.PAINT_GREETING_FN, fn);
      notify(STATE_KEYS.PAINT_GREETING_FN);
    },
    getPaintGreeting() {
      return state.get(STATE_KEYS.PAINT_GREETING_FN);
    },
    callPaintGreeting() {
      const fn = state.get(STATE_KEYS.PAINT_GREETING_FN);
      if (typeof fn === 'function') fn();
    },

    // 问候绘制状态检查
    setGreetingPaintedCheck(fn) {
      state.set(STATE_KEYS.GREETING_PAINTED_FN, fn);
      notify(STATE_KEYS.GREETING_PAINTED_FN);
    },
    isGreetingPainted() {
      const fn = state.get(STATE_KEYS.GREETING_PAINTED_FN);
      return typeof fn === 'function' ? fn() : false;
    },

    // Boot 工具集
    setBootUtils(utils) {
      state.set(STATE_KEYS.BOOT_UTILS, utils);
      notify(STATE_KEYS.BOOT_UTILS);
    },
    getBootUtils() {
      return state.get(STATE_KEYS.BOOT_UTILS) || {};
    },

    // 通用订阅
    subscribe(key, fn) {
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key).add(fn);
      if (state.has(key)) fn(state.get(key));
      return () => subscribers.get(key).delete(fn);
    },

    // 清理
    clear() {
      state.clear();
      subscribers.clear();
    }
  };

  // 兼容旧 API：同步到 window.__MOONFOG_*
  const legacySync = {
    __MOONFOG_BOOT__: () => state.get(STATE_KEYS.BOOT_CONFIG),
    __MOONFOG_BOOT_QUOTE__: {
      get: () => state.get(STATE_KEYS.BOOT_QUOTE),
      set: (v) => state.set(STATE_KEYS.BOOT_QUOTE, v)
    },
    __MOONFOG_PAINT_GREETING__: {
      get: () => state.get(STATE_KEYS.PAINT_GREETING_FN),
      set: (v) => state.set(STATE_KEYS.PAINT_GREETING_FN, v)
    },
    __MOONFOG_GREETING_PAINTED__: {
      get: () => state.get(STATE_KEYS.GREETING_PAINTED_FN),
      set: (v) => state.set(STATE_KEYS.GREETING_PAINTED_FN, v)
    },
    __MOONFOG_BOOT_UTILS__: () => state.get(STATE_KEYS.BOOT_UTILS)
  };

  // 定义旧属性的 getter/setter 以保持兼容
  Object.entries(legacySync).forEach(([key, accessor]) => {
    if (typeof accessor === 'function') {
      Object.defineProperty(window, key, {
        get: accessor,
        configurable: true
      });
    } else {
      Object.defineProperty(window, key, {
        get: () => accessor.get(),
        set: (v) => accessor.set(v),
        configurable: true
      });
    }
  });
})();