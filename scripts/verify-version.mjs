#!/usr/bin/env node
// 版本号校验：
//   1. manifest.json 的 version 必须是合法的 Chrome 扩展版本（1–4 段）；
//   2. 打 tag 时，tag 与 manifest.version 必须一致；
//   3. PR 里若改了版本号，必须只涨不退，且提交/PR 标题为 "chore: release v<新版本>"。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseChromeVersion, compareChromeVersions } from './extension-version.mjs';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function manifestVersionWorktree() {
  return String(JSON.parse(readFileSync('manifest.json', 'utf8')).version || '');
}

function manifestVersionAt(rev) {
  try {
    return String(JSON.parse(git(['show', `${rev}:manifest.json`])).version || '');
  } catch {
    return null;
  }
}

const errors = [];
const head = manifestVersionWorktree();
const headParsed = parseChromeVersion(head);
if (!headParsed) {
  errors.push(`manifest.json 的 version 不是合法扩展版本：${head}`);
}

// 2. tag ↔ manifest
const ref = process.env.REF || '';
let tag = process.env.TAG || '';
if (!tag && ref.startsWith('refs/tags/v')) tag = ref.slice('refs/tags/v'.length);
if (tag) {
  const tagParsed = parseChromeVersion(tag);
  if (!tagParsed) {
    errors.push(`tag 版本不合法：${tag}`);
  } else if (headParsed && compareChromeVersions(tagParsed, headParsed) !== 0) {
    errors.push(`tag v${tag} 与 manifest.json 的 ${head} 不一致`);
  }
}

// 3. PR 中的版本变更
const baseRev = process.env.BASE_SHA || '';
if (baseRev) {
  const base = manifestVersionAt(baseRev);
  if (base && base !== head) {
    const baseParsed = parseChromeVersion(base);
    if (baseParsed && headParsed && compareChromeVersions(headParsed, baseParsed) <= 0) {
      errors.push(`版本号不能回退或原地不动：${base} -> ${head}`);
    }
    const expected = `chore: release v${head}`;
    const headSubject = process.env.HEAD_SHA ? git(['log', '-1', '--format=%s', process.env.HEAD_SHA]) : '';
    const prTitle = process.env.PR_TITLE || '';
    if (headSubject !== expected && prTitle !== expected) {
      errors.push(`改动了版本号，但提交/PR 标题不是 "${expected}"（当前提交标题 "${headSubject || '?'}"）`);
    }
  }
}

if (errors.length === 0) {
  console.log(`verify-version: OK（manifest ${head}）`);
  process.exit(0);
}

console.error('verify-version: 版本号校验失败\n');
for (const e of errors) console.error(`  - ${e}`);
console.error(`\n规则见 VERSIONING.md：tag 与 manifest 必须一致；版本只能递增；版本变更需 "chore: release vX" 提交。`);
process.exit(1);
