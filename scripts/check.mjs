import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
if (!/^\d{1,5}(\.\d{1,5}){2,3}$/.test(version)) {
  fail(`version 必须是 Chrome 扩展版本号（如 1.2.3）: ${version}`);
} else if (version.split('.').some((part) => Number(part) > 65535)) {
  fail('version 每一段必须 <= 65535');
}

for (const item of ['newtab.html', 'css', 'js', 'icons', 'fonts', '_locales']) {
  if (!existsSync(path.join(root, item))) {
    fail(`缺少 ${item}`);
  }
}

const newtab = manifest.chrome_url_overrides?.newtab;
if (!newtab || !existsSync(path.join(root, newtab))) {
  fail(`chrome_url_overrides.newtab 不存在: ${newtab || '(空)'}`);
}

for (const [size, rel] of Object.entries(manifest.icons || {})) {
  if (!existsSync(path.join(root, rel))) {
    fail(`icons.${size} 不存在: ${rel}`);
  }
}

const locale = manifest.default_locale;
if (!locale) {
  fail('缺少 default_locale');
} else {
  const messagesPath = path.join(root, '_locales', locale, 'messages.json');
  if (!existsSync(messagesPath)) {
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

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`manifest ${version} ok`);
