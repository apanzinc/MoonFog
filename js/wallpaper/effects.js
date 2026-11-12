/**
 * MoonFog - Wallpaper Effects
 * 动效渲染器注册表。动效帧由 engine 统一驱动，不各自起循环。
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const registry = new Map();

  // 内置流光渐变动效，委托旧 grain 渲染器
  registry.set('grain', {
    name: '流光渐变',
    paramsSchema: [],
    mount(container, item) {
      // 隐藏容器，显示旧 grain 层
      const media = document.getElementById('wallpaperMedia');
      if (media) media.classList.remove('is-visible');
      if (typeof window.applyBackgroundMode === 'function') {
        window.applyBackgroundMode('grain', { persist: false, force: true });
      }
      return {
        pause() {},
        resume() {},
        destroy() {}
      };
    }
  });

  // 纯色也是背景库条目，但渲染简单，不归为 effect；这里注册一个占位便于统一调用
  registry.set('solid', {
    name: '纯色',
    mount(container, item) {
      const color = item && item.color ? item.color : 'var(--bg-warm)';
      const media = document.getElementById('wallpaperMedia');
      if (media) media.classList.remove('is-visible');
      const root = document.documentElement;
      if (root) {
        root.style.setProperty('--wp-solid-color', color);
        root.classList.add('wp-solid-bg');
      }
      if (typeof window.applyBackgroundMode === 'function') {
        window.applyBackgroundMode('solid', { persist: false, force: true });
      }
      return { pause() {}, resume() {}, destroy() {} };
    }
  });

  function register(name, renderer) {
    registry.set(name, renderer);
  }

  function get(name) {
    return registry.get(name) || null;
  }

  WP.effects = { register, get, registry };
})();
