import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChromeVersion } from './extension-version.mjs';
import { PACKAGE_PATHS } from './package-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveInside(rel) {
  if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel)) return null;
  const resolved = path.resolve(root, rel);
  const relative = path.relative(root, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}
const errors = [];

function fail(message) {
  errors.push(message);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
} catch (error) {
  console.error(`manifest.json 无法解析: ${error.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  fail('manifest_version 必须为 3');
}

const version = String(manifest.version || '');
if (!parseChromeVersion(version)) {
  fail(`version 必须是 Chrome 扩展版本号（1 到 4 段，每段 0–65535，无前导 0，且不能全为 0）: ${version}`);
}

for (const item of PACKAGE_PATHS) {
  if (!existsSync(path.join(root, item))) {
    fail(`缺少 ${item}`);
  }
}

const newtab = resolveInside(manifest.chrome_url_overrides?.newtab);
if (!newtab || !existsSync(newtab)) {
  fail(`chrome_url_overrides.newtab 不存在或不在扩展目录内: ${manifest.chrome_url_overrides?.newtab || '(空)'}`);
}

for (const [size, rel] of Object.entries(manifest.icons || {})) {
  const iconPath = resolveInside(rel);
  if (!iconPath || !existsSync(iconPath)) {
    fail(`icons.${size} 不存在或不在扩展目录内: ${rel}`);
  }
}

const locale = manifest.default_locale;
if (!locale) {
  fail('缺少 default_locale');
} else {
  const messagesPath = resolveInside(path.join('_locales', locale, 'messages.json'));
  if (!messagesPath || !existsSync(messagesPath)) {
    fail(`缺少 _locales/${locale}/messages.json`);
  } else {
    const messages = JSON.parse(readFileSync(messagesPath, 'utf8'));
    for (const field of ['name', 'description']) {
      const match = /^__MSG_([A-Za-z0-9_]+)__$/.exec(manifest[field] || '');
      if (match && !messages[match[1]]?.message) {
        fail(`${field} 引用的消息 ${match[1]} 不存在`);
      }
    }
  }
}

// Firefox / Safari 适配：browser_specific_settings（Chrome 会忽略该键）
const gecko = manifest.browser_specific_settings?.gecko;
if (gecko) {
  const id = String(gecko.id || '');
  const isEmailLike = /^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/.test(id);
  const isGuid = /^\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/.test(id);
  if (!isEmailLike && !isGuid) {
    fail(`browser_specific_settings.gecko.id 必须是邮箱样式或 GUID: ${id || '(空)'}`);
  }
  const required = gecko.data_collection_permissions?.required;
  if (!Array.isArray(required) || !required.includes('none')) {
    fail('browser_specific_settings.gecko.data_collection_permissions.required 必须包含 "none"（AMO 2025-11 起新提交必填）');
  }
  const min = String(gecko.strict_min_version || '');
  if (min && (min.includes('*') || !/^\d+(\.\d+)*$/.test(min))) {
    fail(`browser_specific_settings.gecko.strict_min_version 不允许 "*" 且需为版本号: ${min}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`manifest ${version} ok`);
