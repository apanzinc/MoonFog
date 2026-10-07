import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const crx3 = require('crx3');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['manifest.json', 'newtab.html', 'css', 'js', 'icons', 'fonts', '_locales'];

function parseArgs(argv) {
  const args = { key: '', out: 'dist', name: '', keepKey: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--key') args.key = argv[++i] || '';
    else if (arg === '--out') args.out = argv[++i] || 'dist';
    else if (arg === '--name') args.name = argv[++i] || '';
    else if (arg === '--keep-key') args.keepKey = true;
    else throw new Error(`未知参数: ${arg}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const version = String(manifest.version || '');
const base = args.name || `MoonFog-${version}`;
const outDir = path.resolve(args.out);
mkdirSync(outDir, { recursive: true });

const keyPath = args.key ? path.resolve(args.key) : path.join(outDir, `${base}.pem`);
if (args.key && !existsSync(keyPath)) {
  console.error(`私钥不存在: ${keyPath}`);
  process.exit(1);
}
const generatedKey = !existsSync(keyPath);

const stage = mkdtempSync(path.join(tmpdir(), 'moonfog-'));
try {
  for (const item of INCLUDE) {
    cpSync(path.join(root, item), path.join(stage, item), {
      recursive: true,
      filter: (src) => path.basename(src) !== '.DS_Store',
    });
  }

  await crx3([stage], {
    keyPath,
    crxPath: path.join(outDir, `${base}.crx`),
    zipPath: path.join(outDir, `${base}.zip`),
  });
} finally {
  rmSync(stage, { recursive: true, force: true });
  if (generatedKey && !args.keepKey) {
    rmSync(keyPath, { force: true });
  }
}

console.log(`${path.join(outDir, `${base}.crx`)}`);
console.log(`${path.join(outDir, `${base}.zip`)}`);
