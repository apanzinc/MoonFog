/**
 * MoonFog - Wallpaper Engine
 * 1. 按打开策略拿到背景
 * 2. 四种背景各显示各的
 * 3. 动效/视频统一暂停/恢复
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const state = {
    inited: false,
    currentItem: null,
    video: null,
    effectHandle: null,
    raf: 0,
    lastFrame: 0,
    frameTick: 0,
    paused: false,
    muted: true,
    rotateTimer: 0
  };

  function getMedia() {
    return document.getElementById('wallpaperMedia');
  }

  function getInner() {
    return document.getElementById('wallpaperMediaInner');
  }

  function setMediaVisible(visible) {
    const media = getMedia();
    if (media) media.classList.toggle('is-visible', !!visible);
    // 引擎这一层显示后，旧背景层（.page-bg-stack）就没必要再画一遍同一张图：
    // 两层叠加等于解码两次、每帧多合成一层全屏图，低端机上首屏就是这么卡住的。
    // 类挂在 html 上，由 CSS 收起旧层；遮罩层（.page-bg-overlay）保留不动
    const root = document.documentElement;
    if (root) root.classList.toggle('wp-media-live', !!visible);
  }

  function clearMediaInner() {
    const inner = getInner();
    if (!inner) return;
    inner.replaceChildren();
  }

  function stopVideo() {
    if (!state.video) return;
    try {
      state.video.pause();
      state.video.removeAttribute('src');
      state.video.load();
    } catch (_) {}
    state.video = null;
  }

  function destroyEffect() {
    if (state.effectHandle && typeof state.effectHandle.destroy === 'function') {
      try { state.effectHandle.destroy(); } catch (_) {}
    }
    state.effectHandle = null;
  }

  function cleanup() {
    stopVideo();
    destroyEffect();
    clearMediaInner();
    setMediaVisible(false);
    const root = document.documentElement;
    if (root) {
      root.style.removeProperty('--wp-solid-color');
      root.classList.remove('wp-solid-bg');
    }
    // 关闭旧流光层，避免动效/流光残留盖住图片或纯色
    if (typeof window.setGrainBackgroundActive === 'function') {
      try { window.setGrainBackgroundActive(false); } catch (_) {}
    }
  }

  function loadImage(url, timeoutMs) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ok ? img : null);
      };
      const timer = setTimeout(() => finish(false), timeoutMs || 12000);
      img.decoding = 'async';
      img.alt = '';
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = url;
    });
  }

  function waitVideo(video, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('error', onError);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);
      const timer = setTimeout(() => finish(false), timeoutMs || 9000);
      video.addEventListener('loadeddata', onReady);
      video.addEventListener('error', onError);
    });
  }

  function fallbackItem() {
    // 内置默认兜底：跟随当前明暗模式的底色，不能写死浅色（深色模式下会整屏发白）
    return { kind: 'solid', color: 'var(--bg-warm)' };
  }

  function applyGlobals(item) {
    const spec = WP.spec && WP.spec.get();
    const globals = spec ? spec.globals : {};
    const media = getMedia();
    const inner = getInner();
    if (!media || !inner) return;

    // 静音
    if (state.video) {
      const mute = globals.mute || 'follow';
      state.video.muted = mute !== 'allow';
    }

    // 性能模式影响模糊/动效质量
    const perf = globals.performance || 'balanced';
    media.dataset.perf = perf;
  }

  let renderToken = 0;

  // 同步旧背景系统的模式，避免主题切换时用过期模式重刷流光/纯色
  function syncLegacyBgMode(mode) {
    try {
      if (typeof currentBgMode !== 'undefined') currentBgMode = mode;
    } catch (_) {}
  }

  async function renderImage(item, token) {
    const url = await WP.library.resolveItemUrl(item);
    if (!url) throw new Error('no image url');
    const img = await loadImage(url);
    if (!img) throw new Error('image load failed');
    if (token !== undefined && token !== renderToken) return false;
    cleanup();
    const inner = getInner();
    inner.appendChild(img);
    setMediaVisible(true);
    applyGlobals(item);
    state.currentItem = item;
    syncLegacyBgMode('local');
    if (WP.theme && typeof WP.theme.apply === 'function') WP.theme.apply('image', url);
    return true;
  }

  async function renderVideo(item, token) {
    const url = await WP.library.resolveItemUrl(item);
    if (!url) throw new Error('no video url');
    cleanup();
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.muted = state.muted;
    video.preload = 'auto';
    const ready = await waitVideo(video);
    if (!ready) throw new Error('video load failed');
    if (token !== undefined && token !== renderToken) return false;
    const inner = getInner();
    inner.appendChild(video);
    setMediaVisible(true);
    state.video = video;
    applyGlobals(item);
    if (!state.paused) video.play().catch(() => {});
    state.currentItem = item;
    syncLegacyBgMode('local');
    if (WP.theme && typeof WP.theme.apply === 'function') WP.theme.apply('video', url);
    return true;
  }

  async function renderEffect(item) {
    cleanup();
    const renderer = WP.effects && WP.effects.get(item.effect || 'grain');
    if (!renderer) throw new Error('unknown effect');
    state.effectHandle = renderer.mount(getInner(), item);
    state.currentItem = item;
    // tick 循环在没有动效时会自己停，切到动效得把它重新叫起来
    if (state.effectHandle && typeof state.effectHandle.render === 'function') scheduleTick();
    if (WP.theme && typeof WP.theme.apply === 'function') WP.theme.apply('effect', null);
    return true;
  }

  async function renderSolid(item) {
    cleanup();
    const renderer = WP.effects && WP.effects.get('solid');
    if (renderer) state.effectHandle = renderer.mount(getInner(), item);
    state.currentItem = item;
    if (WP.theme && typeof WP.theme.apply === 'function') WP.theme.apply('solid', null);
    return true;
  }

  async function renderItem(item, token) {
    if (!item) throw new Error('no item');
    try {
      if (item.kind === 'image') return await renderImage(item, token);
      if (item.kind === 'video') return await renderVideo(item, token);
      if (item.kind === 'effect') return await renderEffect(item);
      if (item.kind === 'solid') return await renderSolid(item);
      throw new Error('unknown item kind');
    } catch (err) {
      console.warn('[MoonFogWp] 渲染失败，降级:', err);
      if (token !== undefined && token !== renderToken) return false;
      if (item.kind !== 'solid') {
        return await renderSolid(fallbackItem());
      }
      throw err;
    }
  }

  function tick(now) {
    state.raf = 0;
    if (state.paused || document.hidden) return;
    state.frameTick += 1;
    const render = state.effectHandle && state.effectHandle.render;
    if (typeof render === 'function') {
      try {
        render.call(state.effectHandle, now, state.frameTick);
      } catch (err) {
        console.warn('[MoonFogWp] 动效渲染失败:', err);
      }
      // 只有真的在动的层才需要逐帧。
      // 静态图 / 纯色没有 render，如果还继续排帧，
      // 主线程每天每帧都被叫醒一次，首屏那段最忙的时候纯属添乱
      scheduleTick();
    }
  }

  function scheduleTick() {
    if (state.raf) return;
    state.raf = window.requestAnimationFrame(tick);
  }

  function stopTick() {
    if (state.raf) window.cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  function setPaused(paused) {
    state.paused = !!paused;
    if (state.paused) {
      stopTick();
      if (state.video) {
        try { state.video.pause(); } catch (_) {}
      }
      if (state.effectHandle && typeof state.effectHandle.pause === 'function') {
        try { state.effectHandle.pause(); } catch (_) {}
      }
    } else {
      if (state.video) {
        try { state.video.play().catch(() => {}); } catch (_) {}
      }
      if (state.effectHandle && typeof state.effectHandle.resume === 'function') {
        try { state.effectHandle.resume(); } catch (_) {}
      }
      scheduleTick();
    }
  }

  function clearRotateTimer() {
    if (state.rotateTimer) {
      clearTimeout(state.rotateTimer);
      state.rotateTimer = 0;
    }
  }

  function scheduleRotate(spec) {
    clearRotateTimer();
    if (!spec || !spec.strategy || spec.strategy.kind !== 'rotate') return;
    const mins = Number(spec.strategy.intervalMin) || 0;
    if (mins <= 0) return;
    state.rotateTimer = setTimeout(() => {
      state.rotateTimer = 0;
      render({ advance: true });
    }, mins * 60000);
  }

  async function render(options) {
    const my = ++renderToken;
    const spec = WP.spec && WP.spec.get();
    if (!spec) return;
    clearRotateTimer();

    let item = null;
    try {
      item = await WP.sources.resolveStrategy(spec.strategy, { advance: !!(options && options.advance) });
    } catch (err) {
      console.warn('[MoonFogWp] 策略解析失败:', err);
    }
    if (my !== renderToken) return;

    if (!item) {
      item = fallbackItem();
    }

    scheduleRotate(spec);

    // 相同 item 且不是源/runtime 直接复用
    if (state.currentItem && state.currentItem.id && item.id && state.currentItem.id === item.id && item.source !== 'runtime') {
      return;
    }

    try {
      await renderItem(item, my);
    } catch (err) {
      console.error('[MoonFogWp] 渲染兜底失败:', err);
    }
  }

  function init() {
    if (state.inited) return;
    state.inited = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        setPaused(true);
      } else {
        setPaused(false);
      }
    });

    if (WP.spec && typeof WP.spec.onChange === 'function') {
      WP.spec.onChange(() => {
        render();
      });
    }

    window.addEventListener('moonfog-wp-items-change', () => {
      render();
    });
    window.addEventListener('moonfog-wp-sources-change', () => {
      render();
    });

    scheduleTick();
    render({ advance: true });
  }

  /** 当前正在展示的条目（明暗切换时判断要不要重算取色板用） */
  function getCurrent() {
    return state.currentItem;
  }

  WP.engine = {
    init,
    render,
    setPaused,
    cleanup,
    getCurrent
  };
})();
