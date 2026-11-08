/**
 * MoonFog - Wallpaper Theme Bridge
 * 图片/视频帧 → 旧取色管线；纯色/动效 → 清理图片调色板。
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});
  let token = 0;

  function resolveUrl(src) {
    if (typeof src === 'string') return src;
    if (src && typeof src === 'object') return src.url || '';
    return '';
  }

  async function apply(kind, src) {
    if (kind === 'solid' || kind === 'effect' || kind === 'grain') {
      token += 1;
      if (typeof window.clearImagePalette === 'function') {
        try { window.clearImagePalette(); } catch (_) {}
      }
      return;
    }

    const url = resolveUrl(src);
    if (!url) return;
    if (typeof window.applyPaletteForUrl !== 'function') return;

    const my = ++token;
    try {
      await window.applyPaletteForUrl(url);
    } catch (err) {
      console.warn('[MoonFogWp] 取色失败:', err);
    }
    return my === token;
  }

  WP.theme = { apply };
})();
