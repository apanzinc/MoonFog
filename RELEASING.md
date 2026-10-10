# 发布流程

`main` 已开启分支保护（禁止直接 push），发布工作流**不再**往 `main` 推提交。
因此版本号要**先**通过 PR 落到 `main`，工作流只负责校验、打包、打 tag、发 Release。

## 步骤

### 1. 改版本号（走 PR）

新建分支，把 `manifest.json` 的 `version` 改成目标版本，提交信息与 PR 标题都写成：

```
chore: release v1.1.0.3
```

等 required checks（`hygiene` / `commits` / `version` / `pr-title`）通过后 **Squash** 合并到 `main`。

### 2. 跑发布工作流

Actions → **Release** → Run workflow → 选 `main`、版本号填 `1.1.0.3`。

工作流会：

- 校验输入版本合法、tag 未被占用、且 `manifest.json` 已经是该版本（否则提示你先做第 1 步）；
- 用 Secret `CRX_PRIVATE_KEY` 签名打包出 `.crx` / `.zip`；
- 打 tag `v1.1.0.3` 并创建 GitHub Release（附产物）。

### 3. 上架 Chrome Web Store

用上一步的 `.zip` 上传；版本必须是商店当前版本的**更高**版本。

## 为什么版本号不自动写进 main

`main` 开了分支保护后，Actions 的 `GITHUB_TOKEN` 不享受豁免，无法直接 push。
于是版本变更改由第 1 步的 PR 完成——每次版本变更都有记录、可审阅，也顺便让 `verify:version` 能校验
"tag ↔ manifest ↔ 提交信息" 三者一致。

## 密钥

`CRX_PRIVATE_KEY`（PEM 私钥）决定旁加载 `.crx` 的扩展 ID，**每次发布必须用同一把**。
生成：

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out key.pem
```

把 PEM 全文存入仓库 Secret `CRX_PRIVATE_KEY`；`key.pem` 本身已被 `.gitignore`。
