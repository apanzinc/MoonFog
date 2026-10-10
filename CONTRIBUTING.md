# 贡献指南

MoonFog 是 Chrome 新标签页扩展。本文件是**人读的规范**；其中每一条都对应一个机器检查——
违反时 CI 会直接红叉并告诉你改法。**别指望"记得"，靠的是自动化。**

## 1. 提交信息：Conventional Commits

格式：

```
<type>(<scope>)!: <描述>
```

- `type` 只能是：`feat` / `fix` / `docs` / `refactor` / `perf` / `style` / `test` / `chore` / `ci` / `revert`
- **禁用**临时性类型：`debug` / `diagnostic` / `baseline` / `update` / `wip` / `tmp` 等
- `scope` 可选；`!` 表示破坏性变更
- 描述用中文，动词开头，不要以句号结尾；整个标题 ≤ 100 字符

示例：

```
feat(search): 支持多引擎切换
fix(boot): 修复首帧主题闪烁
chore: release v1.1.0.3
```

强制点：`.github/workflows/pr-title.yml`（校验 PR 标题）+ `.github/workflows/guard.yml`（校验分支提交）。

## 2. 合并策略：Squash

PR 一律用 **Squash merge**，于是 **PR 标题 = `main` 上的提交信息**。
所以 **PR 标题必须是合法的 Conventional Commit**。

## 3. 分支与 PR

- `main` 受保护：**不能直接 push**，只能走 PR。
- 分支命名：`feat/xxx`、`fix/xxx`、`chore/xxx`。
- 合并前必须通过 required checks：`hygiene` / `commits` / `version` / `pr-title`。
- 禁止 `git push --force` 到 `main`。

## 4. 版本号

见 [VERSIONING.md](./VERSIONING.md)。改 `manifest.json` 的 `version` 必须是**单独一个提交**，
且消息为 `chore: release vX.Y.Z`。

## 5. 发布

见 [RELEASING.md](./RELEASING.md)。

## 6. 文件卫生

- UTF-8、LF、文件末尾留一个换行。
- 由 [`.editorconfig`](./.editorconfig) / [`.gitattributes`](./.gitattributes) 声明，`scripts/lint-repo.mjs` 强制。
- 一次性本地修好：`npm run fix:repo`。

## 7. 代码风格

- 2 空格缩进、单引号、语句结尾分号、中文注释。
- 无构建步骤：不要引入打包器 / 框架。

## 8. 本地检查清单

提交 PR 前本地跑：

```bash
npm run check          # manifest 结构与路径
npm run lint:repo      # 文件卫生
npm run lint:commits   # 提交信息
npm run verify:version # 版本号
```

## 9. 敏感文件

`.github/`、`scripts/`、`manifest.json`、`_locales/`、`package.json`、`package-lock.json`
由 [`.github/CODEOWNERS`](./.github/CODEOWNERS) 标注为敏感路径——改动请单独说明理由。
