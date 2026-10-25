import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 网页版构建：把新标签页原样发布成纯静态站点（index.html + 静态资源），
// 供 Chrome / Edge / Firefox / Safari 通过「主页 / 新标签页网址」直接使用。
// 扩展专有的 manifest.json 与 _locales 不进入网页版。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(root, 'dist-web');

const WEB_PATHS = ['css', 'js', 'icons', 'fonts'];

function copyTo(rel, destRoot) {
  const src = path.join(root, rel);
  if (!existsSync(src)) {
    throw new Error(`缺少网页版文件: ${rel}`);
  }
  cpSync(src, path.join(destRoot, rel), {
    recursive: true,
    filter: (srcPath) => path.basename(srcPath) !== '.DS_Store',
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
writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml.replace(anchor, webConfigTag + anchor));
writeFileSync(
  path.join(OUT_DIR, 'web-config.js'),
  [
    '/* MoonFog 网页版配置（构建产物，扩展包不含此文件）',
    ' * corsProxy: 网页版跨域转发。必应壁纸接口、Google/必应 favicon 服务等不带跨域头，',
    ' * 直连必然失败（已由 MoonFogEnv.applyCorsProxy 统一静默降级）。如自建转发服务',
    ' * （如 Cloudflare Worker），填入地址即可恢复这些功能：',
    ' *   - 追加式: "https://your-worker.example.com/?url=" （自动拼接 encodeURIComponent(目标地址)）',
    ' *   - 占位式: "https://your-worker.example.com/fetch/{url}"',
    ' * 留空表示不启用（不发出注定失败的请求，控制台保持干净）。 */',
    'window.MoonFogWebConfig = { corsProxy: "" };',
    '',
  ].join('\n'),
);

const { count, bytes } = countFiles(OUT_DIR);
console.log(`网页版构建完成: ${path.relative(root, OUT_DIR)} (${count} 个文件, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
console.log('本地预览: cd dist-web && npx serve . 或 python -m http.server');
