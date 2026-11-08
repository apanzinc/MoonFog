/**
 * 把 newtab.html 里「连续排在一起」的 css / js 合并成几个响应。
 *
 * 页面本来有 11 个样式 + 28 个脚本，HTTP/1.1 只有 6 条并发连接，
 * 移动网络（RTT 300-500ms）下光排队就要四五秒。合并后首屏个位数请求。
 *
 * 两种用法：
 *   - dev-serve.mjs：每次请求现拼，改源文件立刻生效（虚拟地址）
 *   - build-web.mjs：构建期写成实体文件
 *
 * 只合并「相邻且中间只有空白/注释」的标签，跨 DOM 结构的脚本保持原位置，
 * module 脚本单独留着（它有 defer 语义，合进来会改执行顺序）。
 */

import path from 'node:path';

const SCRIPT_RE = /<script\b([^>]*?)\bsrc="([^"]+)"([^>]*?)><\/script>/g;
const LINK_RE = /<link\b([^>]*?)\bhref="([^"]+)"([^>]*?)>/g;
const GAP_OK = /^(?:\s|<!--[\s\S]*?-->)*$/;

function collectTags(html, re) {
  re.lastIndex = 0;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      attrs: `${m[1]} ${m[3]}`,
      src: m[2],
    });
  }
  return out;
}

function groupAdjacent(tags, html) {
  const groups = [];
  for (const tag of tags) {
    const last = groups[groups.length - 1];
    if (last && GAP_OK.test(html.slice(last[last.length - 1].end, tag.start))) {
      last.push(tag);
    } else {
      groups.push([tag]);
    }
  }
  return groups;
}

/**
 * @param {string} html 原始 HTML
 * @param {(name: string) => string} urlOf bundle 名称 → 引用地址
 * @returns {{ html: string, bundles: Array<{ name: string, type: string, parts: string[] }> }}
 */
export function rewriteHtml(html, urlOf) {
  const edits = [];
  const bundles = [];

  // 1) 样式：全部合成一个（顺序就是层叠顺序）
  const links = collectTags(html, LINK_RE).filter((l) => /rel="stylesheet"/.test(l.raw));
  if (links.length > 1) {
    bundles.push({ name: 'css', type: 'text/css; charset=utf-8', parts: links.map((l) => l.src) });
    edits.push({
      start: links[0].start,
      end: links[links.length - 1].end,
      replacement: `<link rel="stylesheet" href="${urlOf('css')}">`,
    });
  }

  // 2) 脚本：相邻的 classic script 合并
  const scripts = collectTags(html, SCRIPT_RE).filter((s) => !/type="module"/.test(s.attrs));
  let index = 0;
  for (const group of groupAdjacent(scripts, html)) {
    if (group.length < 2) continue;
    const name = `js${index++}`;
    bundles.push({ name, type: 'text/javascript; charset=utf-8', parts: group.map((g) => g.src) });
    edits.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      replacement: `<script src="${urlOf(name)}"></script>`,
    });
  }

  edits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  return { html: out, bundles };
}

/**
 * 合并后的 CSS 换了地址，里面的 url() 相对路径会全部指错
 * （图标字体的 woff2 直接 404）。按「原文件所在目录」重算成站点根路径。
 */
export function rewriteCssUrls(css, fromRel) {
  const dir = path.posix.dirname(fromRel.split('?')[0].replace(/^\.?\//, ''));
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, url) => {
    if (/^(?:https?:|data:|blob:|\/\/|\/|#)/i.test(url)) return whole;
    return `url(${quote}/${path.posix.normalize(path.posix.join(dir, url))}${quote})`;
  });
}
