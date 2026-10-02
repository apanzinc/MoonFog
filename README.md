<h1 align="center"><img src="assets/logo.png" width="38" alt="MoonFog logo" align="top"> MoonFog 朔雾</h1>

![MoonFog banner](assets/banner.png)

月雾之间，新页初启。MoonFog 是一款基于 Manifest V3 的 Chrome 扩展，把浏览器默认新标签页替换成安静、可定制的起始页。

## 功能

- **背景**
  - 本地壁纸（自选图片，动态取色自动配色）
  - 必应每日一图（自动缓存，离线可用）
  - 流光模式（Paper Shaders 渐变动画，可调颜色/噪点/偏移）
  - 纯色背景
- **动态主题**：基于 Material Color Utilities（MCU）从壁纸提取种子色，生成整套明暗配色；支持手动浅色/深色
- **问候语**：按时段（早/午/晚）、用户名自定义文案，字号/粗细/字体可调
- **搜索**：内置 Google / Bing / 百度 / 秘塔 AI / ChatGPT / Claude，支持添加自定义搜索引擎
- **快捷导航**：自定义站点图标，支持导入浏览器书签（Netscape HTML）
- **字体**：内置思源宋体，也可选系统字体；正文/问候语可分别设置
- **性能档**：完全 / 部分 / 限制三档，统一控制背景与表面模糊
- **数据**：设置导入/导出，一键重置


## 权限说明

| 权限 | 用途 |
| --- | --- |
| `fontSettings` | 读取系统字体设置 |
| `bing.com` | 获取每日一图与图片署名 |
| `hitokoto.cn` / `hitokoto.c0ffee.space` | 一言问候文案 |
| `google.com` / `duckduckgo.com` | 搜索跳转与站点图标抓取 |
| `<all_urls>` | 自定义快捷导航的站点图标（favicon）抓取 |

所有偏好仅存储在本地 `localStorage`，不上传、无遥测、无账号。

## 目录结构

```
newtab.html          入口页面（设置面板与主页同页）
manifest.json        MV3 清单
css/                 样式（含 settings/ 子目录）
js/
  background.js      壁纸/流光渲染、必应图与一言缓存（页面脚本）
  theme-manager.js   主题引擎（含图片模式色板）
  theme.js / color-utils.js / material-color-utilities.js
  settings.js / search.js / shortcuts.js / greeting.js ...
  boot-*.js          首屏无闪启动链（在 body 解析时同步执行）
  vendor/            第三方库（MCU、Paper Shaders）
icons/               扩展图标与内置搜索引擎图标
fonts/               内置思源宋体
assets/              README 配图（banner、logo）
```

## 许可

Copyright (c) 2026 apanzinc。本项目基于 GNU Affero General Public License v3.0 获得许可。
