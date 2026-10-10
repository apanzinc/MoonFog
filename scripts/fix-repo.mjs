#!/usr/bin/env node
// 修复文件卫生：去掉 BOM、补齐文件末尾换行。
// 行尾符交给 .gitattributes（这里不改），第三方代码 js/vendor/ 跳过。
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SKIP_PREFIXES = ['js/vendor/'];
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.crx', '.zip', '.gz', '.7z', '.pdf', '.pem', '.der', '.p12',
  '.mp3', '.mp4', '.webm', '.mov', '.wav',
]);

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
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

let fixed = 0;
for (const file of trackedFiles()) {
  if (skipped(file)) continue;
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue;
  }
  if (looksBinary(buf)) continue;

  let out = buf;
  if (hasBom(out)) out = out.subarray(3);
  if (out.length > 0 && out[out.length - 1] !== 0x0a) {
    out = Buffer.concat([out, Buffer.from('\n')]);
  }
  if (!out.equals(buf)) {
    writeFileSync(file, out);
    console.log(`fixed: ${file}`);
    fixed += 1;
  }
}

console.log(fixed ? `fix-repo: 修复了 ${fixed} 个文件` : 'fix-repo: 无需修复');
