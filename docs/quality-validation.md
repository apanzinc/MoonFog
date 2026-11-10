# 修复与验证记录

本轮基于 `d471414`，按 bug → 性能 → Edge 手机扩展 → OOBE 的顺序处理。提交沿用 `fix/perf/feat/test/docs: 中文说明` 的风格。

## 修复范围

| 问题与触发方式 | 结果 | 回归覆盖 |
| --- | --- | --- |
| 搜索建议请求还没返回就关闭面板，旧结果重新弹出；打开动画排帧后立即关闭 | 关闭 / 改输入时取消请求、作废序号，旧动画与关闭回调不再影响新状态 | `tests/runtime.test.mjs` |
| 粘贴带查询参数、片段或端口的 URL 被当成搜索词；旧 URL 正则有重复量词 | 使用 URL 解析，支持长域名后缀、localhost、IPv4 / IPv6；普通关键词仍搜索 | `tests/runtime.test.mjs` |
| 跨域地址与本网站域名前缀相同，被错误放行 | 只比较解析后的 origin，包括端口 | `tests/runtime.test.mjs` |
| 旧视频地址解析 / 加载较慢，切换后移除新背景或在后台播放 | 校验请求版本后才替换画面；取消等待、释放候选视频；候选视频不自动播放 | `tests/browser/runtime.spec.mjs` |
| 切回纯色后，旧图片取色成功或失败回退仍把旧色板应用回来 | 清理时作废取色版本；延后取样也校验当前壁纸；明暗按当前模式重建 | `tests/browser/runtime.spec.mjs` |
| 同一媒体调整全局开关，复用条目时遗漏静音与性能属性 | 复用时同步全局属性 | `tests/browser/runtime.spec.mjs` |
| 窗口缩小 / 引导输入时被误判成主页键盘，过渡锁吞掉对话框点击 | 只在手机主页搜索跟踪键盘；锁避开引导与设置等模态层 | 小屏实际点击、输入缩小视口与搜索键盘恢复测试 |
| Edge 安卓被 `EdgA` UA 识别成 Chrome，回调 API / 缺失字体 API 兼容不足 | 补齐 UA、回调 / Promise、lastError 降级；手机取消搜索框自动聚焦 | 单元测试、手机模拟、实际扩展协议加载 |

## 性能

环境：本机 Playwright Chromium `158.0.8127.18`，1440 × 900，纯色背景、远程请求阻断。页面稳定 3.5 秒后取 2 秒样本；新版设置完成标记，比较相同主页。结果仅代表这个可复现的空闲场景。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 空闲 rAF 回调 / 秒 | 60 | 0 |
| 两秒内问候主文案 DOM 重写 | 2 | 0 |
| OOBE JS + CSS 原始字节 | 119,518 | 27,199 |
| OOBE JS + CSS gzip 字节 | 25,946 | 8,879 |

纯色不再返回空 `render`，流光帧由已有 ShaderMount 驱动，消除重复循环。时钟只显示时分，刷新改为分钟边界；后台停止定时刷新，回到前台立即同步，文字不变时不重写 DOM。本地图预览压缩后直接写入 IndexedDB，不再重复读取原文件和压缩。

没有生产环境的 Core Web Vitals / Lighthouse 数据，也没有把上述空闲计数换算成整站速度或电量提升。

## Edge 安卓

`npm run pack:edge-mobile` 生成专用 CRX / zip：保留 MV3 service worker 与 `search`，移除桌面专用 `fontSettings` 权限。扩展菜单图标可以在新标签页接管行为不同的宿主版本中直接打开 MoonFog，不增加 `tabs` 权限。

API 平台范围以 [Microsoft Edge 支持的 API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support) 为依据：`action`、`runtime`、`search`、`tabs` 支持 Android，`fontSettings` 仅列桌面平台。

自动化以 Pixel 7 尺寸、触控和 Edge 安卓 UA 跑界面；专用 zip 解包后还会实际加载进 Chromium 的扩展环境，验证 CSP、宿主检测、字体降级与设置入口。未连接 Android 真机；安装渠道、具体 Edge 版本与实体软键盘的设备差异仍需真机验证。Firefox 做打包结构校验，未宣称完成 Firefox 浏览器端到端测试。

## OOBE

重写为欢迎 → 背景 → 明暗 → 问候。预览和主页隔离，完成才保存；跳过保留当前配置。同步新壁纸库策略与旧背景键，避免选择只在当次生效。保存失败回滚部分偏好、保留草稿并允许重试；本地图必选有效图片。每日壁纸离线不会阻断流程。

使用原生 dialog 与显式 Tab 循环管理模态焦点。输入框使用原生编辑按键，步骤动画取消后同步渲染，不用延迟回调替换旧步骤。手机内容滚动、操作栏保留在视口，覆盖 320 × 568、844 × 390 和压缩到 360 × 360 的窗口。减少动效与性能档均生效，退出引导后恢复主页流光画布。

## 验证命令

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run pack
npm run pack:firefox
npm run pack:edge-mobile
```

`test:e2e` 自动构建网页版，并单独从产物目录服务，避免源码目录意外补齐缺失资源。另验证原始文件入口、开发合并入口、MV3 扩展 CSP。测试覆盖首次完成 / 刷新、放弃草稿、跳过、本地图与流光实际恢复、断网、存储失败重试、快速切页、减少动效、焦点、触屏入口、媒体切换、过期取色与空闲帧。

最终本地结果：18 项单元测试通过；浏览器 38 项通过，2 项仅触屏行为在桌面项目中按设计跳过；静态自检及三类打包通过。CI 运行同一套检查，并校验 CRX3 头和 Firefox / Edge 安卓清单。
