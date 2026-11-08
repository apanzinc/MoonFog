/**
 * MoonFog 本地开发服务器
 *
 *   node scripts/dev-serve.mjs [port]
 *
 * - 根路径直接给 newtab.html，不列目录
 * - HTTP/1.1 keep-alive（Python 版是 HTTP/1.0，每个资源一条新连接）
 * - listen backlog 511（Python 版默认 5，浏览器并发 6 就 ERR_CONNECTION_REFUSED）
 * - 文本资源 gzip，全站 no-store
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { rewriteHtml as rewriteHtmlShared, rewriteCssUrls } from './lib/bundle-html.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8132;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const gzip = (buf) => zlib.gzipSync(buf, { level: 6 });

/* gzip 结果缓存：以前每个请求都同步压一遍，188KB 的字体 CSS、几份大 JS
   光压缩就要几十毫秒，几十个请求排队会把首屏拖慢一两秒。
   按 mtime+size 失效，改文件立刻重压。 */
const gzipCache = new Map();
const GZIP_CACHE_MAX = 200;

function gzipCached(abs, stat, buf) {
  const key = `${abs}|${stat.size}|${stat.mtimeMs}`;
  const hit = gzipCache.get(key);
  if (hit) return hit;
  const out = gzip(buf);
  if (gzipCache.size >= GZIP_CACHE_MAX) {
    gzipCache.delete(gzipCache.keys().next().value);
  }
  gzipCache.set(key, out);
  return out;
}

/* 访问日志：只记非本机来源，方便确认手机 / 局域网 / ZeroTier 的请求有没有真的打进来。
   写到 scripts/dev-access.log，一行一条，不会污染控制台 */
const ACCESS_LOG = path.join(ROOT, 'scripts', 'dev-access.log');
const isLoopback = (ip) => /^(::1|127\.|::ffff:127\.)/.test(ip || '');

function logAccess(req) {
  const raw = req.socket.remoteAddress || '';
  if (isLoopback(raw)) return;
  const ip = raw.replace(/^::ffff:/, '');
  const ua = (req.headers['user-agent'] || '').slice(0, 48).replace(/\s+/g, ' ');
  const line = `${new Date().toISOString()}  ${ip.padEnd(15)}  ${req.method} ${req.url}  ${ua}\n`;
  try {
    fs.appendFileSync(ACCESS_LOG, line);
  } catch {
    /* 日志写不了不能影响响应 */
  }
}

function resolvePath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '/index.html') rel = '/newtab.html';
  const abs = path.join(ROOT, rel);
  // 防目录穿越
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

/* ------------------------------------------------------------------
   开发期资源合并（只影响本地预览，newtab.html / 产物保持原样）

   页面本来有 11 个样式 + 28 个脚本，HTTP/1.1 只有 6 条并发连接，
   在移动网络（ZeroTier 中继 RTT ~400ms）下光排队就要五六秒。
   这里把「连续排在一起」的资源拼成单个响应，首屏请求从 39 个降到个位数。
   带 ?raw=1 访问可以拿到未改写的 HTML（要按文件打断点时用）。
   ------------------------------------------------------------------ */
const BUNDLE_PREFIX = '/dev-bundle';

/** 读一份资源的内容，用于拼 bundle */
async function readForBundle(rel) {
  const abs = path.join(ROOT, rel.split('?')[0].replace(/^\.?\//, ''));
  return fsp.readFile(abs, 'utf8');
}

async function rewriteHtmlWithBundles(html) {
  bundleStore.clear();
  const { html: out, bundles } = rewriteHtmlShared(html, (name) => `${BUNDLE_PREFIX}/${name}`);
  for (const b of bundles) bundleStore.set(b.name, b);
  return out;
}

const bundleStore = new Map();

async function serveBundle(res, name) {
  const entry = bundleStore.get(name);
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('no bundle');
    return;
  }
  const chunks = [];
  const isCss = entry.type.startsWith('text/css');
  for (const rel of entry.parts) {
    try {
      let text = await readForBundle(rel);
      if (isCss) text = rewriteCssUrls(text, rel);
      chunks.push(`\n/* ==== ${rel} ==== */\n${text}`);
    } catch {
      chunks.push(`\n/* 读取失败: ${rel} */\n`);
    }
  }
  const body = Buffer.from(chunks.join(isCss ? '\n' : '\n;\n'));
  const headers = {
    'Content-Type': entry.type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  const acceptsGzip = /\bgzip\b/.test(res.req.headers['accept-encoding'] || '');
  let payload = body;
  if (acceptsGzip) {
    payload = gzip(body);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = payload.length;
  res.writeHead(200, headers).end(payload);
}

const server = http.createServer(async (req, res) => {
  logAccess(req);
  const urlPath = req.url || '/';

  if (urlPath.startsWith(`${BUNDLE_PREFIX}/`)) {
    await serveBundle(res, urlPath.slice(BUNDLE_PREFIX.length + 1).split('?')[0]);
    return;
  }

  const abs = resolvePath(urlPath);
  if (!abs) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    return;
  }
  if (stat.isDirectory()) {
    // 不列目录：目录只认它下面的 index/newtab，否则 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
    return;
  }

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end();
    return;
  }

  let body;
  try {
    body = await fsp.readFile(abs);
  } catch {
    res.writeHead(500).end('Read Error');
    return;
  }

  // HTML 入口：把首屏那几十个 css/js 合并成几个响应（?raw=1 可关掉）
  if (ext === '.html' && !/[?&]raw=1\b/.test(urlPath)) {
    body = Buffer.from(await rewriteHtmlWithBundles(body.toString('utf8')), 'utf8');
  }

  const headers = {
    'Content-Type': type,
    // no-cache = 每次都用 ETag 复验，改了立刻生效，没改走 304
    'Cache-Control': 'no-cache',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  };

  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (acceptsGzip && COMPRESSIBLE.test(type) && body.length > 1024) {
    body = gzipCached(abs, stat, body);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;

  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
});

server.keepAliveTimeout = 30000;
server.headersTimeout = 35000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，换个端口：node scripts/dev-serve.mjs 8133`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', 511, () => {
  console.log(`MoonFog dev server  http://127.0.0.1:${PORT}/`);
  console.log(`局域网              http://<本机 IP>:${PORT}/`);
  console.log(`根路径 -> ${path.join(ROOT, 'newtab.html')}`);
  console.log(`文件不存在时直接 404，不列目录`);
});
