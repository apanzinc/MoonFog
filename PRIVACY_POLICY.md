# MoonFog 朔雾 — 隐私政策

生效日期：2026 年 10 月 10 日

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
| 网站图标 | `www.google.com`、`icons.duckduckgo.com`、快捷导航站点自身 | 站点 favicon 图标 |
| 作者头像 | `static.apanzinc.top`、`q.qlogo.cn` | 关于页展示的作者头像图片。头像文件从 `static.apanzinc.top` 加载，该图片由腾讯 QQ 头像服务 `q.qlogo.cn` 提供时，浏览器会再访问该域名 |
| 用户发起的搜索 | 用户所选的搜索引擎（如 `www.google.com`、`www.bing.com`） | 搜索结果页导航 |
| 搜索建议 | `search-sug.lonely.land` | 输入过程中的查询词，用于返回 Google / Bing / 百度建议。可在设置中关闭 |

说明：当您主动在搜索框发起搜索时，查询词会随网址跳转发送至您选择的搜索引擎，这是您发起的导航行为；本扩展不记录、不存储查询词。若开启搜索建议，输入时的查询词还会发给 `search-sug.lonely.land`（第三方建议接口，见 [lonely-4/search-suggestions](https://github.com/lonely-4/search-suggestions)），仅用于当次建议，本扩展不保存。秘塔、ChatGPT、Claude 与自定义引擎不会发起该请求。

## 权限用途

- `fontSettings`：读取系统已安装字体名称列表，仅用于字体选择器展示。
- 主机权限仅限：`www.bing.com`、`cn.bing.com`、`v1.hitokoto.cn`、`hitokoto.c0ffee.space`、`www.google.com`、`icons.duckduckgo.com`、`search-sug.lonely.land`。用于获取壁纸、一言、图标，以及搜索建议，不用于读取任何网页中的用户数据。
- 本扩展不申请 `<all_urls>` 或 `https://*/*`。快捷导航站点自身的 favicon、作者头像（`static.apanzinc.top`、`q.qlogo.cn`）仅作为图片地址由浏览器加载，不授予这些站点主机权限。

## 远程代码

本扩展不使用远程代码。全部 JavaScript 随扩展包分发，运行时不下载或执行任何外部 JS/Wasm。

## 第三方

本扩展不向任何第三方共享、出售或委托处理数据。上述第三方站点（必应、Google、DuckDuckGo、一言 API、`search-sug.lonely.land`、`static.apanzinc.top`、腾讯 `q.qlogo.cn`）仅作为您浏览器直接请求的资源提供方，本扩展无法接触其收到的数据。

## 儿童隐私

本扩展不面向 13 岁以下儿童收集信息，也不知悉地收集儿童信息。

## 政策变更

本政策如有更新，将发布于仓库中的本文件（含更新日期），不再另行通知。

## 联系方式

如有疑问，请在仓库提交 Issue：https://github.com/apanzinc/MoonFog/issues
