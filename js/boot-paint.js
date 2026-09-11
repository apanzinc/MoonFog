/**
 * MoonFog - Boot 首屏即时绘制
 * 必须在 greeting-section 内同步执行，确保文案与壁纸同帧进场
 */
(function () {
  if (window.__MOONFOG_PAINT_GREETING__) window.__MOONFOG_PAINT_GREETING__();
  var root = document.documentElement;
  if (root.classList.contains('boot-ready')) return;
  root.classList.add('boot-ready', 'bg-swap-ready');
  setTimeout(function () {
    root.classList.add('bg-entered');
  }, 950);
})();
