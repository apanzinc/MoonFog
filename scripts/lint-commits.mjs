#!/usr/bin/env node
// 提交信息 / PR 标题校验：必须符合 Conventional Commits，且禁用临时性类型。
//   - 校验一段提交区间：node scripts/lint-commits.mjs
//     （区间取 env RANGE，或 BASE_SHA..HEAD_SHA，或默认 origin/main..HEAD）
//   - 校验单条标题：node scripts/lint-commits.mjs --message "feat: xxx"
import { execFileSync } from 'node:child_process';

const ALLOWED = ['feat', 'fix', 'docs', 'refactor', 'perf', 'style', 'test', 'chore', 'ci', 'revert'];
const BANNED = ['debug', 'diagnostic', 'baseline', 'update', 'wip', 'tmp', 'minor', 'patch', 'hotfix', 'misc', 'cleanup'];
const SUBJECT_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^()\s]+)\))?(?<bang>!)?: (?<subject>\S.*)$/;
const MAX_LENGTH = 100;

function lint(message) {
  const errors = [];
  const title = String(message || '').trim();
  if (!title) return ['标题为空'];
  const m = title.match(SUBJECT_RE);
  if (!m) {
    errors.push('不是 Conventional Commits 格式（应为 "type(scope): 描述"）');
    return errors;
  }
  const { type } = m.groups;
  if (BANNED.includes(type)) {
    errors.push(`类型 "${type}" 被禁用，请改用：${ALLOWED.join(' / ')}`);
  } else if (!ALLOWED.includes(type)) {
    errors.push(`未知类型 "${type}"，允许：${ALLOWED.join(' / ')}`);
  }
  if (title.length > MAX_LENGTH) errors.push(`标题过长（${title.length} > ${MAX_LENGTH}）`);
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function resolveRange() {
  if (process.env.RANGE) return process.env.RANGE;
  const { BASE_SHA, HEAD_SHA } = process.env;
  if (BASE_SHA && HEAD_SHA) return `${BASE_SHA}..${HEAD_SHA}`;
  try {
    git(['rev-parse', '--verify', 'origin/main']);
    return 'origin/main..HEAD';
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf('--message');

  if (mi >= 0) {
    const errors = lint(args[mi + 1]);
    if (errors.length === 0) {
      console.log('lint-commits: 标题 OK');
      process.exit(0);
    }
    console.error(`lint-commits: 标题 ${JSON.stringify(args[mi + 1])} 不合规\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const range = resolveRange();
  if (!range) {
    console.log('lint-commits: 无法确定提交区间，跳过');
    process.exit(0);
  }

  let raw = '';
  try {
    raw = git(['log', '--no-merges', '--format=%h%x09%s', range]);
  } catch {
    console.log(`lint-commits: 区间 ${range} 不可用，跳过`);
    process.exit(0);
  }

  const bad = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [sha, ...rest] = line.split('\t');
    const subject = rest.join('\t');
    if (/^Merge /i.test(subject)) continue;
    const errors = lint(subject);
    if (errors.length) bad.push([sha, subject, errors]);
  }

  if (bad.length === 0) {
    console.log(`lint-commits: OK（区间 ${range}）`);
    process.exit(0);
  }

  console.error(`lint-commits: ${bad.length} 条提交不合规\n`);
  for (const [sha, subject, errors] of bad) {
    console.error(`  ${sha}  ${subject}`);
    for (const e of errors) console.error(`      - ${e}`);
  }
  console.error(`\n允许的类型：${ALLOWED.join(' / ')}；禁用：${BANNED.join(' / ')}`);
  process.exit(1);
}

main();
