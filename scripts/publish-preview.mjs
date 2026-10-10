import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_RE = /^[0-9a-f]{40}$/;

export function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export function previewFileName(sha) {
  return `MoonFog-preview-${sha}.crx`;
}

export function previewDownloadUrl(repository, sha, fileName) {
  return `https://github.com/${repository}/releases/download/preview-${sha}/${fileName}`;
}

export function previewCommentBody({ fileName, sizeLabel, url, sha }) {
  return [
    `<!-- moonfog-preview:${sha} -->`,
    '### Preview Build',
    '#### Files',
    '',
    '| File Name | Size | Download |',
    '| --- | --- | --- |',
    `| [${fileName}](${url}) | ${sizeLabel} | [Download](${url}) |`,
    '',
  ].join('\n');
}

export function findPreviewCrx(dir, expectedName) {
  const root = realpathSync(dir);
  const matches = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === expectedName) {
        matches.push(full);
      }
    }
  };
  walk(root);
  if (matches.length !== 1) {
    throw new Error(`预期恰好 1 个 ${expectedName}，实际 ${matches.length} 个`);
  }
  const real = realpathSync(matches[0]);
  const relative = path.relative(root, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('crx 路径超出预览目录');
  }
  return real;
}

function gh(args, input) {
  const result = spawnSync('gh', args, {
    input,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = `${result.stderr || ''}${result.stdout || ''}`.trim();
    throw new Error(detail || `gh ${args[0]} failed`);
  }
  return result.stdout;
}

function readPackedManifest(crxPath) {
  const script = `
import json, struct, sys, zipfile, io
data = open(sys.argv[1], 'rb').read()
if data[:4] != b'Cr24' or struct.unpack('<I', data[4:8])[0] != 3:
    raise SystemExit('不是 CRX3')
header_len = struct.unpack('<I', data[8:12])[0]
with zipfile.ZipFile(io.BytesIO(data[12 + header_len:])) as zf:
    sys.stdout.write(zf.read('manifest.json').decode())
`;
  const result = spawnSync('python3', ['-c', script, crxPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || '读取 crx manifest 失败').trim());
  }
  return JSON.parse(result.stdout);
}

function choosePullRequest(candidates) {
  const open = candidates.filter((pr) => pr.state === 'open');
  const pool = open.length > 0 ? open : candidates;
  if (pool.length === 1) return pool[0];
  if (open.length > 1) {
    throw new Error(`多个打开的 PR 对应同一提交: ${open.map((pr) => `#${pr.number}`).join(', ')}`);
  }
  pool.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  return pool[0];
}

function pullRequestMatches(pr, { sha, branch, headRepository }) {
  return pr.head?.sha === sha
    && pr.head?.ref === branch
    && pr.head?.repo?.full_name === headRepository;
}

function findPullRequest(repository, expected) {
  let summaries = [];
  try {
    summaries = JSON.parse(gh([
      'api',
      '-H',
      'Accept: application/vnd.github+json',
      `repos/${repository}/commits/${expected.sha}/pulls`,
    ]));
  } catch {
    summaries = [];
  }
  const fromCommit = summaries.filter((pr) => pullRequestMatches(pr, expected));
  if (fromCommit.length > 0) return choosePullRequest(fromCommit);

  const query = `repo:${repository} is:pr sha:${expected.sha}`;
  const search = JSON.parse(gh([
    'api',
    `search/issues?q=${encodeURIComponent(query)}&per_page=20`,
  ]));
  const loaded = [];
  for (const item of search.items || []) {
    const pr = JSON.parse(gh(['api', `repos/${repository}/pulls/${item.number}`]));
    if (pullRequestMatches(pr, expected)) loaded.push(pr);
  }
  if (loaded.length === 0) {
    throw new Error(`找不到与 ${expected.sha} 对应的 PR`);
  }
  return choosePullRequest(loaded);
}

function releaseExists(repository, tag) {
  const result = spawnSync('gh', [
    'release', 'view', tag, '--repo', repository, '--json', 'tagName',
  ], { encoding: 'utf8', env: process.env });
  return result.status === 0;
}

function publishRelease({ repository, tag, sha, fileName, crxPath, notes, defaultBranch }) {
  const title = `preview-${sha}`;
  if (!releaseExists(repository, tag)) {
    const attempt = (target) => spawnSync('gh', [
      'release', 'create', tag, crxPath,
      '--repo', repository,
      '--prerelease',
      '--latest=false',
      '--target', target,
      '--title', title,
      '--notes', notes,
    ], { encoding: 'utf8', env: process.env });
    let created = attempt(sha);
    if (created.status !== 0) created = attempt(defaultBranch);
    if (created.status !== 0 && !releaseExists(repository, tag)) {
      throw new Error((created.stderr || created.stdout || '创建 preview release 失败').trim());
    }
  }
  const uploaded = spawnSync('gh', [
    'release', 'upload', tag, crxPath, '--repo', repository, '--clobber',
  ], { encoding: 'utf8', env: process.env });
  if (uploaded.status !== 0) {
    throw new Error((uploaded.stderr || uploaded.stdout || '上传 crx 失败').trim());
  }
  const view = JSON.parse(gh([
    'release', 'view', tag, '--repo', repository, '--json', 'assets',
  ]));
  if (!view.assets?.some((asset) => asset.name === fileName)) {
    throw new Error(`release 中没有 ${fileName}`);
  }
}

function upsertComment(repository, number, sha, body) {
  const marker = `<!-- moonfog-preview:${sha} -->`;
  const comments = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = JSON.parse(gh([
      'api',
      `repos/${repository}/issues/${number}/comments?per_page=100&page=${page}`,
    ]));
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const existing = comments.find((comment) => comment.body?.includes(marker));
  const payload = JSON.stringify({ body });
  if (existing) {
    gh(['api', '--method', 'PATCH', `repos/${repository}/issues/comments/${existing.id}`, '--input', '-'], payload);
    return;
  }
  gh(['api', '--method', 'POST', `repos/${repository}/issues/${number}/comments`, '--input', '-'], payload);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

export function main() {
  const repository = requiredEnv('GITHUB_REPOSITORY');
  const sha = requiredEnv('WORKFLOW_HEAD_SHA');
  const branch = requiredEnv('WORKFLOW_HEAD_BRANCH');
  const headRepository = requiredEnv('WORKFLOW_HEAD_REPOSITORY');
  const defaultBranch = requiredEnv('DEFAULT_BRANCH');
  const previewDir = requiredEnv('PREVIEW_DIR');
  if (!SHA_RE.test(sha)) throw new Error(`无效的 commit: ${sha}`);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error(`无效的仓库: ${repository}`);

  const fileName = previewFileName(sha);
  const crxPath = findPreviewCrx(previewDir, fileName);
  const manifest = readPackedManifest(crxPath);
  if (manifest.version !== '0.0.1') {
    throw new Error(`version 必须是 0.0.1，实际是 ${manifest.version}`);
  }
  if (manifest.version_name !== `preview-${sha}`) {
    throw new Error(`version_name 必须是 preview-${sha}，实际是 ${manifest.version_name}`);
  }

  const pr = findPullRequest(repository, { sha, branch, headRepository });
  const tag = `preview-${sha}`;
  const url = previewDownloadUrl(repository, sha, fileName);
  const sizeLabel = formatMegabytes(statSync(crxPath).size);
  publishRelease({
    repository,
    tag,
    sha,
    fileName,
    crxPath,
    defaultBranch,
    notes: `PR #${pr.number} 的预览构建。扩展 version 为 0.0.1，version_name 为 preview-${sha}。这不是正式发布。`,
  });
  upsertComment(
    repository,
    pr.number,
    sha,
    previewCommentBody({ fileName, sizeLabel, url, sha }),
  );
  console.log(`preview ${fileName} -> PR #${pr.number} ${sizeLabel}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
