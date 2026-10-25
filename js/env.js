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

  /**
   * 网页版跨域请求统一入口：
   * - 扩展环境：host_permissions 已授权跨域，URL 原样返回。
   * - 网页版：带 ACAO 头的接口（Hitokoto、搜索联想、必应图片 CDN）可直连；
   *   不带跨域头的接口（必应 HPImageArchive、Google favicon 服务）需经
   *   web-config.js 配置的 corsProxy 转发（支持 {url} 占位符）。
   *   未配置代理时返回 ''，调用方应跳过该请求（静默降级，避免控制台刷错）。
   *   data:/blob:/同源/相对 URL 不受跨域限制，原样放行。
   */
  function applyCorsProxy(url) {
    if (isExtension) return url;
    var str = String(url || '');
    if (!/^https?:/i.test(str)) return str;
    // 同源判定：location.origin 相等即同源（URL 构造失败时退回前缀比较，避免误放行跨源）
    var sameOrigin = false;
    try {
      sameOrigin = new URL(str).origin === location.origin;
    } catch (_) {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      try {
        var origin = String(location.origin || '');
        if (origin && str.toLowerCase().indexOf(origin.toLowerCase()) === 0) sameOrigin = true;
      } catch (_) {}
    }
    if (sameOrigin) return str;
    var cfg = null;
    try { cfg = window.MoonFogWebConfig || null; } catch (_) {}
    var proxy = cfg && typeof cfg.corsProxy === 'string' ? cfg.corsProxy : '';
    if (!proxy) return '';
    return proxy.indexOf('{url}') >= 0
      ? proxy.replace('{url}', encodeURIComponent(str))
      : proxy + encodeURIComponent(str);
  }

  var env = {
    isExtension: isExtension,
    isWeb: !isExtension,
    host: host,
    applyCorsProxy: applyCorsProxy
  };

  try {
    Object.freeze(env);
  } catch (_) {}

  window.MoonFogEnv = env;
})();
