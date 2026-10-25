/**
 * MoonFog 运行环境检测
 * 同一份页面同时跑在扩展（Chrome / Edge / Firefox / Safari）与网页版上，
 * 这里统一判定宿主，供各模块做能力降级（字体列表、书签同步等）。
 */
(function () {
  'use strict';

  var protocol = '';
  try { protocol = (location && location.protocol) || ''; } catch (_) {}

  // chrome-extension: / edge-extension: / moz-extension: / safari-web-extension:
  var isExtension = /^(chrome|edge|moz|safari|webkit)-(web-)?extension:$/.test(protocol);

  var host = 'web';
  if (isExtension) {
    if (protocol === 'moz-extension:') {
      host = 'firefox';
    } else if (protocol === 'safari-web-extension:') {
      host = 'safari';
    } else {
      var ua = '';
      try { ua = navigator.userAgent || ''; } catch (_) {}
      host = /Edg\//.test(ua) ? 'edge' : 'chrome';
    }
  }

  var env = {
    isExtension: isExtension,
    isWeb: !isExtension,
    host: host
  };

  try {
    Object.freeze(env);
  } catch (_) {}

  window.MoonFogEnv = env;
})();
