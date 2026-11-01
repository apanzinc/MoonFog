# MoonFog 朔雾 — 隐私政策

生效日期：2026 年 10 月 31 日

MoonFog 朔雾（以下简称"本扩展"）尊重并保护用户隐私。本政策说明本扩展如何处理信息。

## 总则

**本扩展不收集、不出售任何个人数据，也没有开发者服务器。**

- 本扩展没有账号系统，不识别用户身份。
- 本扩展不含统计埋点、广告 SDK、分析组件或追踪器。
- 本扩展不会将任何输入内容或使用记录发送到开发者控制的服务器（开发者没有此类服务器）。

## 本地存储的数据

以下信息仅保存在您本机的浏览器存储（localStorage / 本地缓存）中，随时可在设置面板中导出、修改或一键清除，卸载扩展即随之删除：

- 用户名与问候语文案
- 快捷导航链接与文件夹分组
- 主题、字体、背景模式等界面偏好
- 用户选择的本地壁纸图片与提取的配色结果
- 必应每日一图的本地缓存

## 网络请求

本扩展仅在使用以下功能时发起对外请求，全部用于获取公开的展示资源，请求不携带任何用户身份信息：

| 目的 | 目标站点 | 获取内容 |
| --- | --- | --- |
| 必应每日一图 | `www.bing.com`、`cn.bing.com` | 壁纸图片与图片信息（JSON） |
| 每日一言 | `v1.hitokoto.cn`、`hitokoto.c0ffee.space` | 一言文本（JSON） |
| 网站图标 | `icons.duckduckgo.com`、快捷导航站点自身 | 站点 favicon 图标 |
| 作者头像 | `static.apanzinc.top`、`q.qlogo.cn` | 关于页展示的作者头像图片。头像文件从 `static.apanzinc.top` 加载，该图片由腾讯 QQ 头像服务 `q.qlogo.cn` 提供时，浏览器会再访问该域名 |
| 用户发起的搜索（扩展版） | 浏览器设置中的默认搜索引擎 | 扩展版通过 `chrome.search` API 将查询词交给浏览器打开搜索结果，本扩展不读取、不修改用户的搜索引擎设置 |
| 用户发起的搜索（网页版） | 网页内选择的搜索引擎（如 `www.google.com`、`www.bing.com`） | 搜索结果页导航 |
| 搜索输入联想（扩展版） | `api.bing.com` / `suggestqueries.google.com` / `suggestion.baidu.com` | 输入过程中的查询词，直接发送至对应引擎官方联想接口以返回建议；默认不申请权限，用户开启开关时授权、可随时关闭，查询词不保存在本地 |
| 搜索输入联想（网页版） | `search-sug.lonely.land` | 网页版经聚合接口获取 Google / Bing / 百度建议；默认开启、可关闭，查询词不保存在本地 |

说明：当您主动在搜索框发起搜索时，查询词会随网址跳转发送至搜索引擎，这是您发起的导航行为；本扩展不记录、不存储查询词。扩展版优先使用 `chrome.search`，由浏览器按您的默认搜索引擎设置打开结果，因此不会覆盖或改变您的搜索引擎。若开启搜索输入联想（默认开启、可关闭），扩展版会把输入过程中的查询词直接发送至对应引擎的官方联想接口（`api.bing.com` / `suggestqueries.google.com` / `suggestion.baidu.com`），网页版则发至 `search-sug.lonely.land` 聚合接口（第三方建议服务，见 [lonely-4/search-suggestions](https://github.com/lonely-4/search-suggestions)）；仅用于当次建议，本扩展不保存；关闭输入联想后不再发起该请求。秘塔、ChatGPT、Claude 与自定义引擎不会发起该请求。

## 权限用途

- `fontSettings`：读取系统已安装字体名称列表，仅用于字体选择器展示。
- `search`：扩展版搜索框通过 `chrome.search` API 将查询交给浏览器默认搜索引擎，不读取、不修改用户的搜索设置。
- 必需主机权限仅限：`www.bing.com`、`cn.bing.com`、`v1.hitokoto.cn`、`hitokoto.c0ffee.space`、`icons.duckduckgo.com`，用于获取壁纸、一言文案与快捷方式图标，不用于读取任何网页中的用户数据。
- 可选主机权限：`api.bing.com`、`suggestqueries.google.com`、`suggestion.baidu.com`，仅在用户打开「输入联想」开关时弹出一次授权，用于扩展版直连引擎官方联想接口（默认不申请、可随时关闭）；网页版输入联想因无主机权限，经 `search-sug.lonely.land` 聚合接口。
- 本扩展不申请 `<all_urls>` 或 `https://*/*`。快捷导航站点自身的 favicon、作者头像（`static.apanzinc.top`、`q.qlogo.cn`）仅作为图片地址由浏览器加载，不授予这些站点主机权限。

## 远程代码

本扩展不使用远程代码。全部 JavaScript 随扩展包分发，运行时不下载或执行任何外部 JS/Wasm。

## 第三方

本扩展不向任何第三方共享、出售或委托处理数据。上述第三方站点（必应、Google、DuckDuckGo、一言 API、`static.apanzinc.top`、腾讯 `q.qlogo.cn`，以及仅在开启输入联想时使用的引擎官方联想接口与网页版 `search-sug.lonely.land` 聚合接口）仅作为您浏览器直接请求的资源提供方，本扩展无法接触其收到的数据。

## 儿童隐私

本扩展不面向 13 岁以下儿童收集信息，也不知悉地收集儿童信息。

## 政策变更

本政策如有更新，将发布于仓库中的本文件（含更新日期），不再另行通知。

## 联系方式

如有疑问，请在仓库提交 Issue：https://github.com/apanzinc/MoonFog/issues
