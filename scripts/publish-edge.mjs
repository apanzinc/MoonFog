import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Microsoft Edge Add-ons 更新 API（v1.1：API Key + Client ID，无需换 token）
const API_ROOT = 'https://api.addons.microsoftedge.microsoft.com';
const MAX_POLLS = 60;
const POLL_INTERVAL_MS = 5000;

export function operationIdFromLocation(location) {
  if (!location) return '';
  const clean = location.split('?')[0].replace(/\/+$/, '');
  return clean.slice(clean.lastIndexOf('/') + 1);
}

export function authHeaders(apiKey, clientId) {
  return {
    Authorization: `ApiKey ${apiKey}`,
    'X-ClientID': clientId,
  };
}

export function assertZip(filePath) {
  if (!filePath || !existsSync(filePath)) {
    throw new Error(`找不到包文件: ${filePath || '(空)'}`);
  }
  const size = statSync(filePath).size;
  if (size === 0) {
    throw new Error(`包文件是空的: ${filePath}`);
  }
  const head = readFileSync(filePath).subarray(0, 2).toString('latin1');
  if (head !== 'PK') {
    throw new Error(`不是 zip 包: ${filePath}`);
  }
  return size;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function uploadPackage({ productId, apiKey, clientId, zipPath }) {
  const response = await fetch(
    `${API_ROOT}/v1/products/${productId}/submissions/draft/package`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(apiKey, clientId),
        'Content-Type': 'application/zip',
      },
      body: readFileSync(zipPath),
    },
  );
  if (response.status !== 202) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`上传失败: HTTP ${response.status} ${detail}`);
  }
  const operationId = operationIdFromLocation(response.headers.get('location'));
  if (!operationId) throw new Error('上传响应没有 Location 头');
  return operationId;
}

async function publishSubmission({ productId, apiKey, clientId, notes }) {
  const response = await fetch(
    `${API_ROOT}/v1/products/${productId}/submissions`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(apiKey, clientId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    },
  );
  if (response.status !== 202) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`提交失败: HTTP ${response.status} ${detail}`);
  }
  const operationId = operationIdFromLocation(response.headers.get('location'));
  if (!operationId) throw new Error('提交响应没有 Location 头');
  return operationId;
}

async function pollOperation({ apiKey, clientId, url, label }) {
  for (let attempt = 1; attempt <= MAX_POLLS; attempt += 1) {
    const response = await fetch(url, { headers: authHeaders(apiKey, clientId) });
    const text = await response.text();
    let payload = {};
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {};
    }
    const status = payload.status || payload.Status || '';
    if (status === 'Succeeded') return payload;
    if (status === 'Failed' || status === 'FailedWithError') {
      throw new Error(`${label}失败: ${text.slice(0, 500)}`);
    }
    if (response.status !== 202 && response.status !== 200) {
      throw new Error(`${label}状态查询失败: HTTP ${response.status} ${text.slice(0, 500)}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${label}超时（${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s）`);
}

export async function main() {
  const productId = requiredEnv('EDGE_PRODUCT_ID');
  const clientId = requiredEnv('EDGE_CLIENT_ID');
  const apiKey = requiredEnv('EDGE_API_KEY');
  const zipPath = requiredEnv('EDGE_PACKAGE');
  const version = process.env.VERSION || '';
  const notes = `MoonFog v${version} 自动提交`;

  const size = assertZip(zipPath);
  console.log(`上传 ${zipPath}（${size} 字节）到 Edge 产品 ${productId}`);

  const uploadId = await uploadPackage({ productId, apiKey, clientId, zipPath });
  await pollOperation({
    apiKey,
    clientId,
    label: '上传',
    url: `${API_ROOT}/v1/products/${productId}/submissions/draft/package/operations/${uploadId}`,
  });

  const publishId = await publishSubmission({ productId, apiKey, clientId, notes });
  await pollOperation({
    apiKey,
    clientId,
    label: '提交',
    url: `${API_ROOT}/v1/products/${productId}/submissions/operations/${publishId}`,
  });

  console.log(`Edge 已提交 v${version} 审核`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
