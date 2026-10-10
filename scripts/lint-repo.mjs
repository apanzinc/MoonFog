#!/usr/bin/env node
// 仓库文件卫生检查：BOM / 末尾换行 / 行尾符（检查仓库内存储，而非工作区）。
// 规则来自 .editorconfig 与 .gitattributes；CI 里由 Guard / hygiene 执行。
// 第三方代码放在 js/vendor/ 下，整体跳过。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SKIP_PREFIXES = ['js/vendor/'];
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.crx', '.zip', '.gz', '.7z', '.pdf', '.pem', '.der', '.p12',
  '.mp3', '.mp4', '.webm', '.mov', '.wav',
]);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean);
}

function skipped(file) {
  if (SKIP_PREFIXES.some((p) => file.startsWith(p))) return true;
  const dot = file.lastIndexOf('.');
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : '';
  return BINARY_EXT.has(ext);
}

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

const problems = [];

for (const file of trackedFiles()) {
  if (skipped(file)) continue;
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue;
  }
  if (looksBinary(buf)) continue;
  if (hasBom(buf)) problems.push([file, '带 BOM（应为无 BOM 的纯 UTF-8）']);
  if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) problems.push([file, '末尾缺少换行']);
}

// 行尾符：只检查仓库内存储（i/...），工作区的 CRLF 只是 core.autocrlf 所致，不算问题。
try {
  for (const line of git(['ls-files', '--eol']).split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const meta = line.slice(0, tab);
    const file = line.slice(tab + 1).trim();
    if (!file || skipped(file)) continue;
    const m = meta.match(/^i\/(\S+)/);
    if (!m) continue;
    if (m[1] === 'crlf' || m[1] === 'mixed') {
      problems.push([file, `仓库内行尾为 ${m[1]}（应为 LF）`]);
    }
  }
} catch {
  // 无 git 信息时跳过该项
}

if (problems.length === 0) {
  console.log('lint-repo: OK（BOM / 末尾换行 / 行尾符 均通过）');
  process.exit(0);
}

console.error(`lint-repo: 发现 ${problems.length} 处问题\n`);
for (const [file, why] of problems) console.error(`  - ${file}：${why}`);
console.error('\n修复：npm run fix:repo（去 BOM、补末尾换行）。');
console.error('行尾符由 .gitattributes 控制；刚启用时运行一次 `git add --renormalize .` 即可。');
process.exit(1);
