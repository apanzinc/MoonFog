# Chrome Web Store「单一用途」整改记录（v1.1.1）

> 本文档记录 2026-10-28 收到的 Chrome Web Store「Action Required — Single Purpose」通知、
> 根因分析、v1.1.1 整改方案（WeTab 模式：chrome.search 执行 + 可关闭的联网输入联想）、
> 提交与申诉素材，供提交审核与后续维护使用。

---

## 一、通知内容（摘要）

| 项目 | 内容 |
| --- | --- |
| 收到时间 | 2026-10-28 17:24（Asia/Shanghai） |
| 商店条目 | 朔雾（MoonFog），Item ID `jnheegmemghhmbanifecnkifakjeecen` |
| 违规类型 | Single Purpose（单一用途） |
| Violation ID | 红色氩气（Red Argon） |
| 期限 | 收到后 30 天内（约 2026-11-27） |
| 后果 | 逾期未整改将下架 |

通知原文要点（中文）：

> 您的扩展对浏览器**新标签页**和**用户搜索体验**进行修改，属于同时提供多个用途。
> 单一用途政策要求扩展只能有一个明确用途；如果新标签页包含搜索体验，必须通过
> **Chrome 搜索 API** 尊重用户选择的设置。请提交新的草案版本，审核通过后将替换当前线上版本；
> 如果在警告期内未整改，扩展将从商店下架。

## 二、根因分析

MoonFog 的**代码层面**并没有使用 `chrome_settings_overrides` 覆盖默认搜索引擎，
但新标签页内的搜索框实现了：

- 自建引擎选择器（Google / Bing / 百度 / 秘塔 / ChatGPT / Claude）；
- 自定义搜索引擎（用户可添加任意 `%s` 模板）；
- 搜索执行直接用自建引擎 URL 跳转，而不是交给浏览器；
- 输入联想改为直连引擎官方联想接口（`api.bing.com` / `suggestqueries.google.com` / `suggestion.baidu.com`）。

审核据此判定为新标签页之外叠加了「修改/替换搜索体验」的第二个用途，触发了
Single Purpose 违规（Violation ID：红色氩气 / Red Argon）。

## 三、整改方案（v1.1.1，WeTab 模式）

整改目标是让**搜索执行**完全遵循浏览器设置，同时保留新标签页自身的一体化搜索体验
（与 WeTab 等已过审扩展相同的架构）。WeTab `2.2.50` 的实测结论：

- 页面本地渲染、断网可用（与 MoonFog 一致）；
- 搜索默认项使用 `chrome.search.query()` 交给浏览器默认引擎；
- 输入联想通过 host 权限直连引擎官方联想接口（`api.bing.com` / `suggestqueries.google.com` / `suggestion.baidu.com`），仅限输入建议；
- 扩展没有 `chrome_settings_overrides`，未修改默认搜索服务商。

### 3.1 搜索执行改走 `chrome.search`

- `js/env.js` 新增能力探测 `MoonFogEnv.browserSearch`：Chromium 扩展（Chrome / Edge）
  且存在 `chrome.search.query` 时为 `true`。
- `js/search.js`：
  - 「跟随浏览器」（`moonfog_engine=auto`，默认）时，`performSearch()` 在扩展环境走
    `chrome.search.query({ text, disposition: 'CURRENT_TAB' })`，由浏览器用**用户设置的默认
    搜索引擎**打开结果；不读取、不修改用户的搜索引擎设置。
  - 用户在引擎卡片列表里显式选择具体引擎时，搜索按该引擎 URL 直接打开（用户显式选择，
    扩展仍不覆盖浏览器默认搜索引擎）。
  - API 调用异常时才回退到旧的页面内引擎逻辑（`openEngineSearch`），保证可用性。
  - 网址直开（`example.com`）逻辑不变。
- 能力探测失败（Firefox / Safari / 网页版）保持原有页面内引擎选择，行为不变。

### 3.2 输入联想保留（可关闭的增强）

- `js/search.js`：`currentSuggestProviders()` 恢复引擎联想；扩展内与网页版一样通过
  各引擎官方联想接口（`api.bing.com/osjson.aspx`、`suggestqueries.google.com/complete/search`、`suggestion.baidu.com/su`）直接获取 Google / Bing / 百度的输入建议；网页版受 CORS 限制仍走 `search-sug.lonely.land` 聚合。
  第一逻辑：联想来源跟随「搜索引擎」卡片列表的选择（「跟随浏览器」时按浏览器品牌推断默认引擎：
  Chrome→Google、Edge→Bing，推断不出时用必应）。第二逻辑：所选引擎没有联想时，按固定顺序
  **Google → 必应 → 百度** 依次自动回退（切换搜索引擎后解析一次并缓存，之后每次按键直接复用，
  无需用户设置）；已成功返回过结果的来源记入 `moonfog_suggest_provider` 并置顶，
  本会话网络失败过的来源不再重试，切换引擎卡片时重置，避免每次按键都重试失效来源。
  旧版本选过引擎的用户沿用其选择。
- 联想开关 `moonfog_search_suggest` 默认开启，可在「设置 → 搜索」关闭；关闭后不再发起联想请求。
- 扩展内恢复原「搜索引擎」卡片列表（恢复全部内置引擎卡片，首位新增「跟随浏览器」并默认选中；
  自定义引擎卡片与「添加自定义」隐藏），`applyBrowserSearchSettings()` 负责切换与回填；
  选择写入 `moonfog_engine`，同时决定搜索执行（auto→chrome.search，指定引擎→该引擎）与联想来源。
- 联想只发送输入过程中的查询词，不保存、不与用户身份关联（见 PRIVACY_POLICY.md）。

### 3.3 设置页与 OOBE 文案同步

- `js/search.js` 的 `applyBrowserSearchSettings()`：扩展内恢复「搜索引擎」卡片列表
  （完整内置卡片 + 首位「跟随浏览器」默认选中，自定义引擎卡片与「添加自定义」隐藏）；
  设置项标题保持「搜索」，副标题改为「跟随浏览器或指定搜索引擎」。
- 保留「输入时显示联网联想」与「快捷方式联想」两个开关。
- `js/oobe.js`：引导页第 5 步的「搜索 / 搜索引擎与输入联想」。
- `newtab.html`：为相关容器补 `id`（不额外增加说明卡片，设置页只保留引擎卡片列表与两个联想开关）。

### 3.4 清单与权限

- `manifest.json`
  - `permissions`：`["fontSettings", "search"]`（新增 `search`，用于 `chrome.search`）；
  - `host_permissions`（必需，安装即显示）：`www.bing.com`、`cn.bing.com`、`v1.hitokoto.cn`、`hitokoto.c0ffee.space`、`icons.duckduckgo.com`；
  - `optional_host_permissions`（可选，安装时不申请）：`api.bing.com`、`suggestqueries.google.com`、`suggestion.baidu.com`，仅在用户打开「输入联想」开关时通过 `chrome.permissions.request` 弹出一次授权，拒绝则联想保持关闭；扩展内不再声明 `search-sug`；
  - 不添加 `chrome_settings_overrides`、`omnibox` 或任何其它 `chrome_url_overrides`。
- `scripts/pack-extension.mjs`：Firefox 目标剥离 `fontSettings` 与 `search`
  （Firefox 无 `chrome.search`，运行时已回退页面内引擎；联想在 Firefox 由用户按需授权站点访问）。
- `scripts/check.mjs`：单一用途与权限最小化合规断言（防止后续回退）：
  - 禁止 `chrome_settings_overrides`；
  - `chrome_url_overrides` 只允许 `newtab`；
  - `permissions` 必须包含 `search`；
  - 必需 `host_permissions` 只允许壁纸 / 一言 / 图标缓存 5 个主机，且不含 `www.google.com`；
  - 三个引擎官方联想接口主机必须位于 `optional_host_permissions`（按需授权），且不得声明 `search-sug`（不符时 `npm run check` 失败）；
  - `js/search.js` 必须调用 `chrome.search.query`，且包含 `SUGGEST_PERMISSION_ORIGINS` 与 `chrome.permissions.request` 按需授权逻辑。

### 3.5 文档同步

- `README.md`：功能、权限表与支持矩阵区分「扩展版 / 网页版」，说明 `search` 与三个官方联想接口权限用途；
- `PRIVACY_POLICY.md`：刷新网络请求与权限披露（版本日期 2026-10-31），
  明确扩展版搜索执行走 `chrome.search`、输入联想为可关闭增强；
- `docs/project-overview.md`、`docs/settings-structure.md`：同步搜索实现与设置页结构。

## 四、验证清单

```bash
npm run check     # manifest 合规断言（单一用途 / 权限 / 主机权限）
npm run pack      # 生成 dist/MoonFog-1.1.1.zip 与 .crx（本地密钥仅用于本地测试）
```

手动验证（Chrome，加载已解压的扩展目录）：

1. 打开新标签页 → 输入查询词回车 → 默认「跟随浏览器」时打开的是**浏览器默认搜索引擎**的结果页；
2. 在 `chrome://settings/search` 更换默认搜索引擎 → 再搜索（仍选中「跟随浏览器」）→ 结果跟随新引擎；
3. 设置 → 「搜索」页：显示引擎卡片列表
   （首位「跟随浏览器」默认选中，其后 Google / Bing / 百度 / 秘塔AI搜索 / ChatGPT / Claude；
   自定义引擎卡片与「添加自定义」在扩展内隐藏）+「输入时显示联网联想」+「快捷方式联想」；
4. 点选 Bing 等具体引擎卡片后搜索 → 结果由该引擎打开；点回「跟随浏览器」→ 回到浏览器默认引擎；
5. 搜索框输入时出现输入联想（DevTools Network 可见引擎官方联想接口请求（如 `api.bing.com/osjson.aspx`），
   `with` 参数跟随所选引擎，「跟随浏览器」时按浏览器品牌推断、为空回退 `with=bing`）；
   所选引擎不支持联想时按 Google → 必应 → 百度 自动回退（切换引擎卡片后自动生效，无需设置）；
   关闭「输入时显示联网联想」后不再发请求、无联想；
6. 输入 `example.com` 回车 → 直接打开网址（行为不变）；
7. 网页版（`npm run build:web` 后本地预览）：引擎选择、自定义引擎、输入联想均正常。

### 4.1 本机实测记录（Edge，2026-10-31）

本机 Chrome 安装前，先用同内核的 Edge 156.0.4314.50（Chromium 156）验证：

- 用 CDP `Extensions.loadUnpacked` 加载仓库根目录（等价「加载已解压的扩展」）；
- 新标签页实际渲染为 `chrome-extension://<id>/newtab.html`，`MoonFogEnv.host === "edge"`、
  `MoonFogEnv.browserSearch === true`；
- 设置页：引擎卡片列表恢复（首位「跟随浏览器」默认选中，可选 Google / Bing / 百度 / 秘塔AI搜索 /
  ChatGPT / Claude；自定义引擎卡片与「添加自定义」隐藏）；
- 提交搜索（「跟随浏览器」）后页面跳转到 `https://cn.bing.com/search?q=...`（Edge 默认搜索引擎
  Bing），说明 `chrome.search.query` 在 Edge 上正常工作。

### 4.2 本机实测记录（Chrome，2026-10-31）

本机安装 Chrome 156.0.8078.80 后复核：

- 用 CDP `Extensions.loadUnpacked` 加载仓库根目录后，新标签页渲染为
  `chrome-extension://<id>/newtab.html`，`MoonFogEnv.host === "chrome"`、
  `MoonFogEnv.browserSearch === true`；
- 真实鼠标点击 × 键盘输入 × 回车：查询交给 `chrome.search.query` 打开，
  结果页 URL 随默认搜索引擎变化（Google 环境曾落入 /sorry 风控页，属网络环境问题）；
- v1.1.1 初期版本曾隐藏输入联想；按本方案恢复联想后，扩展内输入时可见联想下拉，
  请求目标为对应引擎官方联想接口（「跟随浏览器」：Chrome 推断 Google、
  Edge 推断 `with=bing`；所选引擎不支持联想时按固定顺序 Google → 必应 → 百度 依次回退并记住可用来源），
  关闭「输入时显示联网联想」后请求立即消失；
- 设置 →「搜索」：扩展版恢复「搜索引擎」引擎卡片列表（首位「跟随浏览器」默认选中，其后
  Google / Bing / 百度 / 秘塔AI搜索 / ChatGPT / Claude；自定义引擎卡片与「添加自定义」隐藏），
  切换卡片后联想请求的 `with` 参数跟随（「跟随浏览器」按品牌推断、为空自动回退）；选择写入
  `moonfog_engine` 并在重新打开设置时回填；选择具体引擎时搜索由该引擎打开，选「跟随浏览器」时
  仍走 `chrome.search`；
- 真实回车：默认「跟随浏览器」时查询经 `chrome.search` 落到默认搜索引擎结果页（本机新 profile
  默认 Google，结果页 URL 为 `google.com.hk/search?q=...`；随后 Google 对自动化 IP 的风控
  `/sorry` 跳转属网络环境问题，与扩展行为无关）；页面无 JS 运行时异常。

打包产物检查：解压 `dist/MoonFog-1.1.1.zip` 后确认：

- `manifest.json`：`permissions` 为 `["fontSettings","search"]`，无 `chrome_settings_overrides`；
  必需 `host_permissions` 为 5 个（bing×2 / hitokoto×2 / duckduckgo 图标）、不含 `www.google.com`；
  `optional_host_permissions` 恰为三个官方联想接口主机（api.bing.com / suggestqueries.google.com / suggestion.baidu.com）、不含 search-sug；
- `js/search.js` 含 `chrome.search.query` 与 `currentSuggestProviders` 联想逻辑，
  `js/oobe.js` 含 `browserSearch` 文案分支。

### 4.3 「搜索引擎卡片列表：跟随浏览器」记录（2026-10-31）

- 行为：默认「跟随浏览器」（`moonfog_engine=auto`，引擎卡片列表首位默认选中）；
  Chrome 不向扩展暴露默认搜索引擎，按浏览器品牌推断（Chrome/Firefox/Safari → Google，Edge → Bing）；
  所选引擎不支持联想时按固定顺序 Google → 必应 → 百度 依次回退，成功来源记住并置顶、失败来源本会话
  不再重试；候选链在切换引擎卡片后解析一次并缓存（`moonfog_suggest_chain`），之后每次按键直接复用；
  推断不出浏览器默认引擎时用必应。用户也可手动固定任意内置搜索引擎（此时搜索直接由该引擎打开）；
  旧版本选过引擎的用户沿用其选择。
- 自动化验证（2026-10-31 晚）：用 Node `vm` 加载真实 `js/search.js` + `js/config.js` 执行 52 项断言，
  全部通过；除上述逻辑外，还用假 DOM 驱动 `applyBrowserSearchSettings()` 验证：引擎卡片列表显示、
  引擎卡片组恢复且标题为「搜索引擎」、「跟随浏览器」卡片显示、「添加自定义」隐藏、首次进入写入
  `moonfog_engine=auto`、导航/页头文案更新；并用桩对象验证 `performSearch()`：auto → 仅调用
  `chrome.search` 不跳转、指定 Bing → 直接跳转 `bing.com/search`、未存值默认 auto、网页版按所选引擎
  跳转；`newtab.html`/`css/settings/controls.css` 静态检查确认无旧下拉残留、含 `.engine-item[hidden]`
  规则且无 `is-suggest-mode` 限制。
- 环境限制：本轮 DSH 会话沙箱限制下，本机 Chrome / Edge 启动均被拒绝（crashpad 0x5），
  故本轮未做真实浏览器 E2E；建议按第四节「手动验证」在真实 Chrome/Edge 复核
  「引擎卡片列表默认跟随浏览器 / 切换后搜索结果与联想来源跟随」。

## 五、提交流程（给维护者）

1. **构建**：`npm run pack`。CI 发布请继续使用 GitHub Actions
   （`Release` workflow 会用仓库 secret `CRX_PRIVATE_KEY` 打包，不要把 `.pem` 入库）。
2. **开发者控制台** → 选择「朔雾」→ **软件包** → 上传 `dist/MoonFog-1.1.1.zip`；
3. **隐私权规范（Privacy practices）** 页填写：
   - Single purpose description（见第 6 节英文素材）；
   - `fontSettings`、`search`、三个官方联想接口主机权限用途说明（联想主机位于 `optional_host_permissions`，安装时不申请，仅在用户打开联想开关时请求一次授权）；
4. **商店信息（Store listing）**：描述强调「只替换新标签页」，搜索表述为
   「使用浏览器默认搜索引擎；输入联想可选、可关闭」，不要写「覆盖/替换默认搜索引擎」；
5. **提交审核**。审核通过后，批准的草案会替换当前线上版本，违规记录随之清除；
6. 若再次被拒：在开发者控制台该扩展的 **状态（Status）** 页查看违规详情并
   **申诉（Appeal）**，附第 6 节说明与验证步骤；仍被拒则按第 7 节回退方案处理。

> 宽限期内务必完成提交与审核。若逾期被下架，仍可整改后重新提交，但会影响已有用户更新。

## 六、提交与申诉英文素材

**Single purpose description（Dashboard → Privacy practices）：**

> MoonFog replaces the browser's New Tab page with a quiet, customizable start page
> (wallpaper, greeting, shortcuts). Replacing the New Tab page is its only purpose.
> The search box on the New Tab page hands every query to the browser's default search
> engine through the `chrome.search` API: the extension neither reads nor overrides the
> user's search engine settings, and provides no custom search provider, no
> `chrome_settings_overrides`, no homepage/startup override, and no ads. Typing in the
> search box can optionally show input suggestions (on by default, user-toggleable); the
> typed query is sent by the extension directly to the selected engine's official suggestion
> endpoint (`api.bing.com`, `suggestqueries.google.com` or `suggestion.baidu.com`) only for that
> purpose, is not stored, and no request is made when the toggle is off. This in-page convenience is part of the New Tab page experience,
> like the suggestion dropdown other New Tab extensions provide.

**Permission justification — `search`：**

> The search box on the New Tab page calls `chrome.search.query({ text, disposition:
> 'CURRENT_TAB' })` so that queries open in the browser's default search engine. The extension
> neither reads nor changes the user's search engine setting. This API is used only when the
> user submits a query.

**Permission justification — `api.bing.com`, `suggestqueries.google.com`, `suggestion.baidu.com`（optional）：**

> Declared as optional host permissions and requested only when the user switches on the
> "input suggestions" toggle (no permission prompt at install). Used solely to fetch input
> suggestions while the user types in the New Tab page search box (direct requests to the
> selected engine's official suggestion endpoint). The query text is sent only when the user
> is actively typing, is not stored and is not linked to any identity; the feature can be
> switched off in Settings, after which no request is made.

**Permission justification — `fontSettings`：**

> Reads the list of installed system font names to populate the font picker on the New Tab
> page. No font setting is modified.

**Reviewer note（提交时附言）：**

> This release (1.1.1) fixes the Single Purpose violation (item ID
> `jnheegmemghhmbanifecnkifakjeecen`, violation ID Red Argon). The New Tab page remains the
> only purpose. As requested, the in-page search now uses `chrome.search`, so it respects the
> browser's default search engine instead of offering a custom search provider. The extension
> does not use `chrome_settings_overrides`; there is no default-search-provider override, no
> homepage/startup override and no ad injection. The optional input-suggestion toggle is part
> of the New Tab page UI (similar to WeTab's suggestion dropdown) and can be turned off. Test
> steps: load unpacked, open a new tab, type a query and press Enter — results open in the
> browser's default search engine; typing also shows suggestions, and switching the toggle off
> stops all suggestion requests.

## 七、被拒时的回退方案（B 计划）

若审核仍判定「输入联想属于搜索体验修改」，按以下顺序回退（每步都是小改动，可快速重提）：

1. 关闭联想：`currentSuggestProviders()` 在扩展内直接返回空、隐藏联想开关；
2. 移除三个官方联想接口主机权限（`scripts/check.mjs` 断言同步调整）；
3. 更新隐私政策 / README / 商店描述；
4. 重新打包提交（版本号 +1），并在申诉中引用本轮验证说明。

回退后与「纯 chrome.search」版本等价，只剩「本地页面 + 浏览器默认引擎搜索」。

## 八、不要采用的做法

- ❌ 新增 `chrome_settings_overrides.search_provider`（或拆一个「改默认搜索引擎」的扩展）：
  政策明确把「替换默认搜索服务提供商」列为独立目的，同样会被判定违规；
- ❌ 用「另一个扩展 / 首页劫持 / 启动页重定向」绕过单一用途限制：
  同样属于第二用途或欺骗性行为，风险更高；
- ❌ 在扩展里用 `<all_urls>` 掩盖联想请求：能过审也不建议，权限面过大反而提高复审风险；
- ❌ 扩大权限或新增 `web_accessible_resources` 来「打补丁」：只会让复审更严格。

## 九、后续注意

- 任何「新标签页之外」的功能（如 omnibox、书签同步、右键菜单接管、启动页）都要先评估
  是否会被视为独立用途；书签同步目前需用户手动授权 `bookmarks` 权限，仍属于「快捷导航」的
  可选增强，提交前建议在审核说明中主动解释。
- `scripts/check.mjs` 已加入断言：如果后续 PR 想重新引入 `chrome_settings_overrides`，
  或移除联想主机权限却不同步移除联想逻辑，`npm run check` 会直接失败。
- 发布新版本时同步更新本文档的版本号与日期。
