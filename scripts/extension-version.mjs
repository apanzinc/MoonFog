import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PART = '(?:0|[1-9][0-9]{0,4})';
const VERSION_RE = new RegExp(`^${PART}(?:\\.${PART}){0,3}$`);

export function parseChromeVersion(version) {
  if (typeof version !== 'string' || !VERSION_RE.test(version)) return null;
  const parts = version.split('.').map(Number);
  if (parts.some((part) => part > 65535) || parts.every((part) => part === 0)) return null;
  return parts;
}

export function compareChromeVersions(left, right) {
  const a = [...left, 0, 0, 0, 0].slice(0, 4);
  const b = [...right, 0, 0, 0, 0].slice(0, 4);
  for (let i = 0; i < 4; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function main() {
  const version = process.argv[2];
  const manifestPath = process.argv[3];
  const parsed = parseChromeVersion(version);
  if (!parsed) {
    console.error(`版本号必须是 Chrome 扩展版本（1 到 4 段，每段 0–65535，不能有前导 0，且不能全为 0）: ${version}`);
    process.exit(1);
  }
  if (!manifestPath) return;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const current = parseChromeVersion(String(manifest.version || ''));
  if (current && compareChromeVersions(parsed, current) < 0) {
    console.error(`不能发布低于当前 manifest ${manifest.version} 的版本: ${version}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
