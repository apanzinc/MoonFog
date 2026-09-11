/**
 * MoonFog - 背景预加载与 body class 同步（从 boot-config.js 提取�? * 依赖 boot-config.js 设置�?window.__MOONFOG_BOOT__
 */
(function () {
  'use strict';

  let root = document.documentElement;
  let boot = window.__MOONFOG_BOOT__ || {};
  let bgMode = boot.bgMode || 'solid';
  let bgUrl = boot.bgUrl || '';
  let blur = boot.blur || 20;
  let greetingPainted = false;

  function revealBootBackground() {
    root.classList.add('boot-bg-decoded');
    let pageBg = document.getElementById('pageBg');
    let img = document.getElementById('pageBgImage');
    if (pageBg) pageBg.classList.add('has-image', 'is-ready');
    if (img) {
      img.style.filter = blur > 0 ? ('blur(' + blur + 'px)') : 'none';
      img.style.removeProperty('transform');
      img.style.removeProperty('opacity');
      img.style.removeProperty('transition');
      img.classList.add('is-ready', 'is-active');
      img.classList.remove('is-entering', 'is-entered');
    }
  }

  function preloadBootBackground() {
    if (!bgUrl || (bgMode !== 'local' && bgMode !== 'bing')) {
      revealBootBackground();
      return;
    }
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      revealBootBackground();
    }
    try {
      let probe = new Image();
      let afterLoad = function () {
        if (probe.decode) {
          probe.decode().then(finish).catch(finish);
        } else if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () { requestAnimationFrame(finish); });
        } else {
          setTimeout(finish, 0);
        }
      };
      probe.onload = afterLoad;
      probe.onerror = finish;
      probe.src = bgUrl;
      if (probe.complete && probe.naturalWidth > 0) {
        afterLoad();
      } else {
        setTimeout(finish, 1800);
      }
    } catch (e) {
      finish();
    }
  }

  function syncBodyClasses() {
    if (!document.body) return false;
    if (bgMode === 'grain') {
      document.body.classList.add('has-grain-bg');
      let grainBg = document.getElementById('pageBg');
      if (grainBg) grainBg.classList.add('has-grain', 'is-ready');
    }
    if (root.classList.contains('boot-has-image')) {
      document.body.classList.add('has-image-bg');
      if (root.classList.contains('boot-img-ui-dark')) {
        document.body.classList.add('img-ui-dark');
      } else if (root.classList.contains('boot-img-ui-light')) {
        document.body.classList.add('img-ui-light');
      }
      let pageBg = document.getElementById('pageBg');
      let img = document.getElementById('pageBgImage');
      let imgB = document.getElementById('pageBgImageB');
      if (img) {
        img.style.filter = blur > 0 ? ('blur(' + blur + 'px)') : 'none';
        img.style.removeProperty('transform');
        img.style.removeProperty('transition');
        img.style.removeProperty('opacity');
        if (bgUrl) {
          img.style.backgroundImage = 'url("' + String(bgUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
        }
        img.classList.add('is-active');
      }
      if (imgB) {
        imgB.style.filter = blur > 0 ? ('blur(' + blur + 'px)') : 'none';
        imgB.style.removeProperty('transform');
        imgB.style.removeProperty('transition');
        imgB.style.removeProperty('opacity');
      }
      if (pageBg) pageBg.classList.add('has-image');
      preloadBootBackground();
    }
    if (typeof window.__MOONFOG_GREETING_PAINTED__ === 'function' && !window.__MOONFOG_GREETING_PAINTED__()) {
      if (typeof window.__MOONFOG_PAINT_GREETING__ === 'function') window.__MOONFOG_PAINT_GREETING__();
    }
    return true;
  }

  if (!syncBodyClasses()) {
    if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', syncBodyClasses, { once: true });
    }
    let obs = new MutationObserver(function () {
      if (typeof window.__MOONFOG_GREETING_PAINTED__ === 'function' && !window.__MOONFOG_GREETING_PAINTED__()) {
        if (typeof window.__MOONFOG_PAINT_GREETING__ === 'function') window.__MOONFOG_PAINT_GREETING__();
      }
      if (syncBodyClasses()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
