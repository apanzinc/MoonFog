import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatMegabytes,
  previewCommentBody,
  previewDownloadUrl,
  previewFileName,
} from './publish-preview.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';

test('file size uses MB with two decimals', () => {
  assert.equal(formatMegabytes(1.5 * 1024 * 1024), '1.50MB');
});

test('preview comment matches the download table', () => {
  const fileName = previewFileName(sha);
  const url = previewDownloadUrl('lonely-4/MoonFog', sha, fileName);
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
