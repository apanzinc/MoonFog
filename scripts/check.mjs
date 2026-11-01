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

// Chrome Web Store 单一用途（Single Purpose）：替换新标签页是唯一用途。
// 1) 不允许 chrome_settings_overrides：覆盖默认搜索引擎/主页/启动页会叠加第二用途；
// 2) 扩展内搜索必须走 chrome.search，尊重用户在浏览器里选择的默认搜索引擎；
// 3) 输入联想（WeTab 模式，可在设置里关闭）直接调用各引擎官方联想接口，声明对应主机权限。
if (manifest.chrome_settings_overrides) {
  fail('不允许 chrome_settings_overrides：覆盖默认搜索引擎/主页/启动页会被商店判定为第二用途');
}
const overrides = manifest.chrome_url_overrides || {};
for (const key of Object.keys(overrides)) {
  if (key !== 'newtab') fail(`chrome_url_overrides 只允许 newtab，发现: ${key}`);
}
const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
if (!permissions.includes('search')) {
  fail('permissions 必须包含 "search"：扩展内搜索框通过 chrome.search 使用浏览器默认搜索引擎');
}
const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
const optionalHostPermissions = Array.isArray(manifest.optional_host_permissions)
  ? manifest.optional_host_permissions : [];
// 必需权限只保留常驻功能：壁纸（Bing）、一言（Hitokoto）、快捷方式图标缓存（DuckDuckGo）
const requiredHosts = [
  'https://www.bing.com/*',
  'https://cn.bing.com/*',
  'https://v1.hitokoto.cn/*',
  'https://hitokoto.c0ffee.space/*',
  'https://icons.duckduckgo.com/*'
];
for (const host of requiredHosts) {
  if (!hostPermissions.includes(host)) fail(`host_permissions 必须包含 ${host}`);
}
if (hostPermissions.includes('https://www.google.com/*')) {
  fail('host_permissions 不应再包含 www.google.com：扩展内图标缓存已不使用该域名');
}
// 输入联想改为按需授权：安装时不申请，用户打开「输入联想」时才请求
const optionalSuggestHosts = [
  'https://api.bing.com/*',
  'https://suggestqueries.google.com/*',
  'https://suggestion.baidu.com/*'
];
for (const host of optionalSuggestHosts) {
  if (!optionalHostPermissions.includes(host)) {
    fail(`optional_host_permissions 必须包含 ${host}：用户开启输入联想时按需申请`);
  }
  if (hostPermissions.includes(host)) {
    fail(`host_permissions 不应包含 ${host}：联想接口应放在 optional_host_permissions 按需授权`);
  }
}
if (hostPermissions.some((item) => String(item).includes('search-sug'))
  || optionalHostPermissions.some((item) => String(item).includes('search-sug'))) {
  fail('扩展不应再声明 search-sug.lonely.land：输入联想已改为直接调用引擎官方接口，第三方聚合仅网页版使用');
}
const searchSource = readFileSync(path.join(root, 'js', 'search.js'), 'utf8');
if (!searchSource.includes('chrome.search.query')) {
  fail('js/search.js 未调用 chrome.search.query：扩展内搜索会退回页面内搜索引擎');
}
if (!searchSource.includes('SUGGEST_OFFICIAL_API')) {
  fail('js/search.js 缺少 SUGGEST_OFFICIAL_API：扩展内输入联想应直连引擎官方接口');
}
if (!searchSource.includes('SUGGEST_PERMISSION_ORIGINS')
  || !searchSource.includes('chrome.permissions.request')) {
  fail('js/search.js 缺少可选权限申请逻辑：联想接口应在用户开启时申请授权');
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
