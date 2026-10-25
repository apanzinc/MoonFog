# MoonFog 项目介绍与功能逻辑

> MoonFog 朔雾 —— 一款替换 Chrome 新标签页的浏览器扩展（Manifest V3）。
> 口号：「月雾之间，新页初启」。

---

## 一、项目简介

MoonFog 把浏览器默认的新标签页替换成一个**兼具颜值与效率的个性化主页**：动态流光背景、自动取色的主题系统、问候语/时钟/每日一言、聚合搜索、快捷导航，同时坚持**零遥测、无账号、数据全本地**的隐私原则。

- **技术形态**：纯原生 HTML/CSS/JS 的 Chrome 扩展（MV3），无框架、无构建依赖
- **当前版本**：v1.1.0（manifest 版本 1.1.0.3）
- **权限极简**：API 权限仅 `fontSettings`（读取系统字体列表）；网络访问仅限必应壁纸、Hitokoto 一言、搜索引擎图标与搜索建议几个域名，**不申请 `<all_urls>`**
- **开源许可**：AGPL-3.0；内置思源宋体（OFL 1.1）与 MingCute 图标（Apache 2.0）

### 核心亮点

1. **四种背景模式**：纯色 / 流光渐变（WebGL 流光着色器）/ 本地图片 / 必应每日壁纸
2. **Material You 式动态主题**：从背景图自动提取主色调生成整套配色（基于 Google material-color-utilities）
3. **问候区五态**：问候语 / 自定义文本 / 时钟 / 日期 / 每日一言（hitokoto API + 本地兜底）
4. **聚合搜索**：6 内置引擎 + 自定义引擎 + 输入联想
5. **快捷导航**：支持多级文件夹、右键管理、HTML 书签导入、可选浏览器书签同步
6. **性能三档**：完全 / 部分 / 限制，低端设备也能流畅
7. **数据自主**：一键导出/导入 JSON 备份，全部偏好存 localStorage，不上传任何数据

---

## 二、功能逻辑

### 2.1 启动流程（防白屏的三段式首绘）

```
newtab.html <head> 同步脚本链          <body> 异步初始化
─────────────────────────────         ─────────────────────
boot-state.js    全局状态容器           app.js   编排入口
boot-utils.js   存取/校验工具           ├ 载入问候配置 → greeting.js 接管
boot-config.js  ①注入主题CSS变量        ├ renderShortcuts 渲染快捷方式
greeting-boot.js ②算出首帧问候文本      ├ initSearch 绑定搜索
boot-paint.js   ③立即上屏+触发背景入场   ├ initSettings 绑定设置面板
                                       └ initBackground + initBingCreditPop（空闲时执行）
```

设计目标：**首帧就有正确配色和问候文本**，避免新标签页闪白。

- `boot-config.js` 在 `<head>` 里同步注入：7 套色调 × 明暗两套完整 CSS 变量、字体/字号/字重变量、性能档标记、模糊参数（并按性能档折算：部分档模糊 ×0.45 上限 6px，限制档为 0）
- `greeting-boot.js` 按时间段（早安/午安/下午好/晚上好/夜深了）或时钟/一言模式算出首帧文案；一言模式优先消费本地缓存池，无缓存时先留空等 `greeting.js` 拉取
- `boot-paint.js` 打上 `boot-ready` 标记，950ms 后触发背景入场动画；重活（调色板提取等）通过 `requestIdleCallback` 延迟到入场动画结束后

### 2.2 背景系统（js/background.js）

- 模式存 `moonfog_bg_mode`（solid/grain/local/bing），每次直接读 localStorage 防缓存失真
- **流光渐变**：WebGL 着色器（paper-shaders），7 种形态（四角/波浪/点阵/嵌片/涟漪/团块/球体）；配色支持自动生成（从主题色 HSL 派生 7 色）或自定义 2–7 色槽；速度/颗粒/柔和/形变/位置可调
- **本地图片**：FileReader 读入，≤2.2MB 存 localStorage，仅保存在本机
- **必应壁纸**：拉取每日壁纸 + 维护 8 张的本地池（离线可用），「换一张」从池中轮换
- **图片调色**：canvas 降采样取色 → 按 占比×鲜艳度×明度 打分 → 生成 primary/secondary/accent 三色注入 CSS 变量（`--img-*`）；取色失败回退 Material 紫
- **模糊/压暗**：0–40px 模糊、-50~+50 压暗/提亮，合成单层 rgba 遮罩；双图层交叉淡入换图（先 preload+decode 再显示）

### 2.3 主题系统（js/theme.js / theme-manager.js）

- 7 套预设色调（暖沙/奶油/玫瑰/青苔/晴空/薄紫/素墨）+ 自定义主题色
- 明暗三态：浅色 / 深色 / 跟随系统（matchMedia 监听）
- 纯色背景时用 material-color-utilities 从主题色生成整套 Material 色板；自定义色存 `moonfog_custom_color`
- 全局取色器组件（饱和度面板 + 色相条 + HEX + 预设）供配色/色调共用

### 2.4 问候区（js/greeting.js）

- 五种模式独立开关配置：问候语（按时段 + 自定义名字）/ 自定义文本（≤48 字）/ 时钟（24/12 时制、日期显隐）/ 日期 / 每日一言
- **每日一言**：hitokoto API（主站 + 备用站）拉句子 → 维护 8–12 条本地池（避开最近 40 条已显示）→ 超过设定字数上限自动换句（最多尝试 10 次）→ API 全挂时用内置 20 条兜底
- 首帧由 boot 链渲染，后续由 greeting.js 接管刷新

### 2.5 搜索（js/search.js）

- 6 内置引擎（Google/Bing/百度/秘塔/ChatGPT/Claude）+ 无限自定义引擎（`%s` 占位，存 localStorage，可删除）
- **输入联想**：Google/Bing/百度 时可开启，请求 `search-sug.lonely.land` 聚合接口；键入即发请求，本地不保存查询词

### 2.6 快捷导航（js/shortcuts.js）

- 数据结构支持多级文件夹；展开方向（向上/向下/自适应）处理放不下时整页让位
- 右键菜单管理（添加/编辑/删除/新建文件夹/在右侧添加…）；图标缺省时自动探测站点 favicon（Google 图标服务）
- 支持导入浏览器导出的 HTML 书签文件（追加）；「直接同步浏览器书签」需用户授权 `bookmarks` 权限后开启
- 隐私：所有书签只存本机

### 2.7 设置面板（js/settings.js，详见 docs/settings-structure.md）

- 五个一级页：外观（下设主题与背景/问候区/文字/显示与效果 4 个二级页）/ 搜索 / 导航 / 数据 / 关于
- 条件显隐统一由 `syncSettingsPanel` 驱动（如选「图片」才出现本地/在线子选项）
- 「重置设置」二次点击确认，清空 moonfog_* 偏好但保留壁纸与一言缓存，并清 OOBE 标记

### 2.8 首次引导（js/oobe.js）

- 6 步向导：欢迎 → 选背景 → 选明暗 → 选问候内容 → 设置引导 → 完成
- 完成后写 `moonfog_oobe_done`；重置设置会清掉它，下次打开重新引导

### 2.9 数据与隐私

- **所有偏好**以 `moonfog_*` 前缀存 localStorage，无遥测、无账号、无上传
- 导出：生成 `moonfog-backup-YYYY-MM-DD.json`；导入：整包覆盖并自动刷新
- 网络请求仅 4 类：必应壁纸、hitokoto 一言、搜索建议、引擎图标

---

## 三、目录速览

```
newtab.html            主页 + 设置面板 + 弹窗/右键菜单（单页）
manifest.json          MV3 清单，仅 fontSettings 权限
js/boot-*.js           首绘链（状态容器/工具/主题注入/问候首帧/上屏）
js/app.js              主编排入口
js/background.js       背景四模式 + 调色板提取
js/theme*.js           主题与明暗管理
js/greeting*.js        问候区（boot 首帧 + 运行时）
js/search.js           搜索与联想
js/shortcuts.js        快捷导航
js/settings.js         设置面板逻辑（~2300 行）
js/oobe*.js            首次引导
js/vendor/             material-color-utilities + paper-shaders
css/                   tokens/base/styles + settings 子面板样式
fonts/ icons/          思源宋体、MingCute、引擎图标
scripts/               打包/版本/发布脚本（CI 用）
docs/settings-structure.md   设置面板完整结构（逐项）
```
