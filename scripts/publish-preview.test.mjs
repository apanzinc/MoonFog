import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  choosePullRequest,
  findPreviewComment,
  findPreviewCrx,
  formatMegabytes,
  previewCommentBody,
  previewDownloadUrl,
  previewFileName,
  readPackedManifest,
} from './publish-preview.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';
const fileName = 'MoonFog-preview-0123456789abcdef0123456789abcdef01234567.crx';
const url = 'https://github.com/lonely-4/MoonFog/releases/download/preview-0123456789abcdef0123456789abcdef01234567/MoonFog-preview-0123456789abcdef0123456789abcdef01234567.crx';

test('file size uses MB with two decimals', () => {
  assert.equal(formatMegabytes(1.5 * 1024 * 1024), '1.50MB');
});

test('preview filename and release URL are fixed', () => {
  assert.equal(previewFileName(sha), fileName);
  assert.equal(previewDownloadUrl('lonely-4/MoonFog', sha, fileName), url);
});

test('preview comment matches the download table', () => {
  assert.equal(previewCommentBody({
    fileName,
    sizeLabel: '8.25MB',
    url,
    sha,
  }), `<!-- moonfog-preview:${sha} -->
### Preview Build
#### Files

| File Name | Size | Download |
| --- | --- | --- |
| [${fileName}](${url}) | 8.25MB | [Download](${url}) |
`);
});

test('choosePullRequest prefers the triggering pull request', () => {
  const candidates = [
    { number: 4, state: 'open', updated_at: '2026-01-01T00:00:00Z' },
    { number: 9, state: 'open', updated_at: '2026-02-01T00:00:00Z' },
  ];
  assert.equal(choosePullRequest(candidates, 4).number, 4);
  assert.throws(() => choosePullRequest(candidates), /多个打开的 PR/);
  assert.throws(() => choosePullRequest(candidates, 3), /PR #3/);
});

test('choosePullRequest keeps the newest closed pull request', () => {
  const chosen = choosePullRequest([
    { number: 2, state: 'closed', updated_at: '2026-01-01T00:00:00Z' },
    { number: 8, state: 'closed', updated_at: '2026-03-01T00:00:00Z' },
  ]);
  assert.equal(chosen.number, 8);
});

test('findPreviewComment ignores the marker outside the workflow bot', () => {
  const marker = `<!-- moonfog-preview:${sha} -->`;
  const comments = [
    { id: 1, user: { login: 'someone' }, body: marker },
    { id: 2, user: { login: 'github-actions[bot]' }, body: `${marker}\n### Preview Build` },
  ];
  assert.equal(findPreviewComment(comments, marker).id, 2);
  assert.equal(findPreviewComment([comments[0]], marker), undefined);
});

test('findPreviewCrx accepts one matching file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'moonfog-preview-'));
  try {
    writeFileSync(path.join(dir, fileName), 'crx');
    writeFileSync(path.join(dir, 'notes.txt'), 'nope');
    assert.equal(path.basename(findPreviewCrx(dir, fileName)), fileName);
    writeFileSync(path.join(dir, 'nested-name.txt'), '');
    writeFileSync(path.join(dir, fileName + '.bak'), 'bak');
    assert.equal(path.basename(findPreviewCrx(dir, fileName)), fileName);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readPackedManifest reads version fields from a CRX3 zip', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'moonfog-crx-'));
  const crxPath = path.join(dir, fileName);
  try {
    const packed = spawnSync('python3', ['-c', `
import json, pathlib, struct, sys, zipfile, io
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w') as zf:
    zf.writestr('manifest.json', json.dumps({
        'version': '0.0.1',
        'version_name': 'preview-${sha}',
    }))
pathlib.Path(sys.argv[1]).write_bytes(b'Cr24' + struct.pack('<II', 3, 0) + buf.getvalue())
`, crxPath], { encoding: 'utf8' });
    assert.equal(packed.status, 0, packed.stderr);
    const manifest = readPackedManifest(crxPath);
    assert.equal(manifest.version, '0.0.1');
    assert.equal(manifest.version_name, `preview-${sha}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
