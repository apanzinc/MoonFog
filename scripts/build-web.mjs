import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteHtml, rewriteCssUrls } from './lib/bundle-html.mjs';

// 网页版构建：把新标签页原样发布成纯静态站点（index.html + 静态资源），
// 供 Chrome / Edge / Firefox / Safari 通过「主页 / 新标签页网址」直接使用。
// 扩展专有的 manifest.json 与 _locales 不进入网页版。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(root, 'dist-web');

const WEB_PATHS = ['css', 'js', 'icons', 'fonts'];

// 发布包里只带「会真正被下载」的东西：
// - fonts/ 下整包的思源宋体（每个字重 1.5MB）是切片的源文件，网页只用 fonts/slices/
// - 图标字体的 ttf/woff 是原始备份，网页只加载 woff2 子集
const SKIP_RE = [
  /fonts[\\/]SourceHanSerifSC-(Regular|Medium|SemiBold|Bold)\.woff2$/,
  /icons[\\/]font[\\/]MingCute\.(ttf|woff)$/,
  /icons[\\/]font[\\/]Mingcute\.full\.css$/,
];

function shouldSkip(srcPath) {
  const normalized = srcPath.replace(/\\/g, '/');
  return SKIP_RE.some((re) => re.test(normalized));
}

function copyTo(rel, destRoot) {
  const src = path.join(root, rel);
  if (!existsSync(src)) {
    throw new Error(`缺少网页版文件: ${rel}`);
  }
  cpSync(src, path.join(destRoot, rel), {
    recursive: true,
    filter: (srcPath) => path.basename(srcPath) !== '.DS_Store' && !shouldSkip(srcPath),
  });
}

function countFiles(dir) {
  let count = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countFiles(full);
      count += sub.count;
      bytes += sub.bytes;
    } else {
      count += 1;
      bytes += statSync(full).size;
    }
  }
  return { count, bytes };
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const item of WEB_PATHS) {
  copyTo(item, OUT_DIR);
}

// 扩展入口 newtab.html 在网页版即站点首页。
// 同时注入 web-config.js：网页版专用配置（跨域代理等），扩展包不含此文件。
const indexHtml = readFileSync(path.join(root, 'newtab.html'), 'utf8');
const webConfigTag = '<script src="web-config.js"></script>\n  ';
const anchor = '<script src="js/env.js"></script>';
if (!indexHtml.includes(anchor)) {
  throw new Error('newtab.html 缺少 js/env.js 引用，无法注入 web-config.js');
}
const patchedHtml = indexHtml.replace(anchor, webConfigTag + anchor);
writeFileSync(
  path.join(OUT_DIR, 'web-config.js'),
  [
    '/* MoonFog 网页版配置（构建产物，扩展包不含此文件）',
    ' * corsProxy: 网页版跨域转发（可选）。必应官方接口、Google favicon 服务等不带跨域头：',
    ' *   - 配置后经自建服务转发（如 Cloudflare Worker），零第三方依赖，优先级最高：',
    ' *     追加式: "https://your-worker.example.com/?url=" （自动拼接 encodeURIComponent(目标地址)）',
    ' *     占位式: "https://your-worker.example.com/fetch/{url}"',
    ' *   - 留空时回退公共镜像（api.codelife.cc / peapix.com）获取必应壁纸；',
    ' */',
    'window.MoonFogWebConfig = { corsProxy: "" };',
    '',
  ].join('\n'),
);

// 合并首屏资源：11 个样式 + 28 个脚本压成几个文件，
// 静态托管（HTTP/1.1、无 HTTP/2 推送）时少几十个往返。
function readBundled(rel) {
  const clean = rel.split('?')[0];
  const inOut = path.join(OUT_DIR, clean);
  return readFileSync(existsSync(inOut) ? inOut : path.join(root, clean), 'utf8');
}

const { html: finalHtml, bundles } = rewriteHtml(
  patchedHtml,
  (name) => `bundle-${name}.${name === 'css' ? 'css' : 'js'}`,
);

const versionMap = new Map();

for (const bundle of bundles) {
  const isCss = bundle.type.startsWith('text/css');
  const chunks = bundle.parts.map((rel) => {
    const text = readBundled(rel);
    return `\n/* ==== ${rel} ==== */\n${isCss ? rewriteCssUrls(text, rel) : text}`;
  });
  const fileName = `bundle-${bundle.name}.${isCss ? 'css' : 'js'}`;
  const content = chunks.join(isCss ? '\n' : '\n;\n');
  writeFileSync(path.join(OUT_DIR, fileName), content);
  // 文件名固定，手机浏览器会拿旧缓存一直用；
  // 内容 hash 挂在查询串上，样式/脚本一改，链接就变，刷新即生效
  versionMap.set(fileName, createHash('sha1').update(content).digest('hex').slice(0, 8));
}

let versionedHtml = finalHtml;
for (const [fileName, hash] of versionMap) {
  versionedHtml = versionedHtml.split(`"${fileName}"`).join(`"${fileName}?v=${hash}"`);
}
writeFileSync(path.join(OUT_DIR, 'index.html'), versionedHtml);

const { count, bytes } = countFiles(OUT_DIR);

// 产物自检：HTML 引用到的本地 css/js 必须都在，否则上线就是白屏
const refs = [...finalHtml.matchAll(/(?:href|src)="([^"?#]+\.(?:css|js))"/g)].map((m) => m[1]);
const missing = refs.filter((rel) => !/^https?:/.test(rel) && !existsSync(path.join(OUT_DIR, rel)));
if (missing.length) {
  throw new Error(`产物缺少被引用的文件: ${[...new Set(missing)].join(', ')}`);
}

console.log(`网页版构建完成: ${path.relative(root, OUT_DIR)} (${count} 个文件, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log('本地预览: cd dist-web && npx serve . 或 python -m http.server');
