# 壁纸个性化系统重写 · 契约（v1，2026-11-01，一次写死）

> ⚠️ **本契约已被新规格（背景库 + 源 + 打开策略 + 全局开关，2026-11-04）部分取代。**
> 冲突处以新规格为准。已落地的差异：
> - `catalogs.js`、`playback.js` 已删除（源改由 `sources.js` 解析，轮换由打开策略负责）；
> - L3 壁纸库页已移除，背景设置改为「主题与背景」页内的四个分栏：背景库 / 源 / 打开策略 / 全局；
> - spec schema 升级为 v2（`strategy` + `globals`，含 v1 与旧 4 模式迁移）；
> - 打开策略收敛为三种：固定一张 / 轮播 / 用某个源；轮播只发生在用户导入的图片、视频之间，
>   纯色、动效和在线源（必应 / .wdd / API）不参与轮播；
> - 设置页只保留全局开关（静音 / 性能 / 在线失败 / 缓存清理）。
> 本文其余部分（存储键、模块 API 约定）仍可参考。

> 目标：电视（新标签页）壁纸系统从「4 模式配置页」重写为「Wallpaper Spec 渲染 + 媒体库 + 播放器 + 样式」。
> 时间盒：1 小时内可运行、可打包。**所有模块必须按本契约的 API/键名/DOM id 实现，不得擅自改名。**
> 范围：媒体（图片/视频/轮换组/动态桌面 Wind）、样式（模糊/水波纹）、壁纸库 L3 页、迁移、OOBE 壁纸步骤。
> 纯色 / 流光渐变 的渲染**保留旧实现**（由 engine 委托旧 `applyBackgroundMode('solid'|'grain')`），不重写 shader。

## 0. 文件所有权（严禁越界写别人的文件）

| 归属 | 文件 |
| --- | --- |
| Lead（已/待写） | `js/wallpaper/spec.js`、`js/app.js`（init 接线）、`README.md`、`docs/project-overview.md`、`docs/wallpaper-rewrite-contract.md`（本文件） |
| RENDER 代理 | `js/wallpaper/engine.js`、`js/wallpaper/effects.js`、`js/wallpaper/playback.js`、`js/wallpaper/theme-bridge.js` |
| DATA 代理 | `js/wallpaper/library.js`、`js/wallpaper/catalogs.js`、`js/boot-utils.js`、`js/boot-config.js`、`js/oobe.js`（仅壁纸步骤）、`js/oobe-grain.js`（仅 gradient 判定） |
| UI 代理 | `newtab.html`（仅壁纸相关区块 + 新增 L3 页 + 新脚本标签）、`css/wallpaper.css`（新文件）、`js/wallpaper/settings-ui.js`、`js/settings.js`（仅背景设置段 `bindBackgroundSetting` 及其辅助函数）、`docs/settings-structure.md` |

**基线**：当前 HEAD = `47cff54`，工作区干净。先 `git status` 确认，再动手。

## 1. 存储契约（localStorage / IndexedDB）

```js
// 渲染描述（唯一真相，boot 首绘也读它）
moonfog_wallpaper_spec = {
  v: 1,
  content: { kind: 'solid'|'gradient'|'image'|'video'|'group'|'wind',
             itemId?: string,          // image/video/group/wind 时引用媒体库条目
             color?: string,           // solid 用
             frameId?: string },       // group/wind 当前帧 itemId
  style:   { blur: 0..40, effect: 'none'|'ripple', rippleAmp: 0..100, rippleSpeed: 0..100, wash: -50..50 },
  theme:   { seed: string|null, dark: boolean|null }
}

moonfog_wallpaper_items   = [ item, ... ]      // 元数据（不含 blob）
moonfog_wallpaper_current = itemId | null       // 最近使用的媒体条目
moonfog_wallpaper_playback = { mode: 'still'|'rotate'|'dynamic', intervalMin: 30, order: 'sequence'|'shuffle' }
moonfog_wallpaper_migrated = '1'
// 迁移期间仍写的旧键（仅供旧渲染器/首绘）：
moonfog_bg_mode = 'solid'|'grain'|'local'|'bing'   // 新系统: solid/gradient 时对应写 solid/grain
moonfog_bg_blur (兼容保留)
```

item 形状：
```js
{ id, kind: 'image'|'video'|'group'|'wind',
  source: 'local'|'online'|'bing'|'group'|'catalog',
  name, cover: dataURL|blobUrl|'',  // 网格封面（可为空，UI 用首帧兜底）
  url?: string,                    // online/bing 图片/视频地址
  blobKey?: string,                // 本地文件 → IndexedDB key
  frames?: [{ itemId }] | [{ url, at }], // group: 引用条目；wind: 帧+时间窗口(at: 0..1440 分钟)
  createdAt: number }
```

IndexedDB：db 名 `moonfog-wallpaper`，object store `blobs`（key = itemId，value = Blob）。
> 本地图片仍允许压缩后再存（复用旧 `compressImageFile`，若存在）；本地视频直接存 Blob，>120MB 拒绝并提示。

## 2. 全局命名空间与 API（window.MoonFogWp）

```js
window.MoonFogWp = {
  spec: {            // spec.js（Lead）
    KEY, get(), set(spec), update(patchFn|patch), onChange(cb) // 订阅 'moonfog-wp-spec-change'
  },
  library: {         // library.js（DATA）
    init(): Promise, list(): item[], get(id), remove(id), rename(id, name),
    addFiles(files: File[]): Promise<item[]>,   // 按 type 判 image/video
    addUrl(url, kindHint): Promise<item>,        // kindHint: 'image'|'video'
    createGroup(itemIds): item,
    setCurrent(id), currentId(): string|null,
    getBlobUrl(id): Promise<string>,             // image/video 的 objectURL（缓存 + 不重复 revoke）
    getCover(item): Promise<string>              // 封面或首帧
  },
  catalogs: {        // catalogs.js（DATA）
    init(), list(): [{id:'bing', name:'必应每日', kind:'image', ok:boolean}],
    applyBing(): Promise<item>,                  // 拉取/复用必应每日，入库并返回 item
    refreshBing(): Promise<item>                 // 强制换一张
  },
  engine: {          // engine.js（RENDER）
    init(), render(spec), setPaused(bool), destroy(),
    setLegacyDelegate(fn)  // Lead 在 app.js 注入 (kind) => applyBackgroundMode(kind)
  },
  effects: {         // effects.js（RENDER）
    apply(style)     // 只操作 #wallpaperMedia 内部，不碰其他层
  },
  playback: {        // playback.js（RENDER）
    start(spec), stop(), tick(), setMode(mode), setIntervalMinutes(min), setOrder(order)
  },
  theme: {           // theme-bridge.js（RENDER）
    apply(kind, srcOrItem): Promise  // 图片/视频帧 → 旧 applyPaletteForUrl；solid/gradient → 旧 clearImagePalette
  },
  ui: {              // settings-ui.js（UI）
    init(), refresh(), openLibrary()
  }
}
```

模块加载顺序（UI 代理在 `newtab.html` 里写死）：
```
spec.js → library.js → catalogs.js → effects.js → theme-bridge.js → engine.js → playback.js → settings-ui.js
```
全部在 `js/app.js` 之前、`config.js` 之后加载；均为普通 `<script>`（非 module），挂 `window.MoonFogWp`。

## 3. 引擎行为（engine.js）

- 容器：`newtab.html` 由 UI 代理新增：
  ```html
  <div id="wallpaperMedia" class="wallpaper-media" aria-hidden="true">
    <div id="wallpaperMediaInner" class="wallpaper-media-inner"></div>
    <canvas id="wallpaperRippleCanvas" class="wallpaper-ripple-canvas"></canvas>
  </div>
  ```
  位置：主页背景层（`.page-background` 或 `page-bg-grain` 同级，位于内容之下）。z-index 低于 grain/内容，具体由 UI 代理给变量。
- `render(spec)` 按 content.kind：
  - `solid` / `gradient`：清空 `#wallpaperMediaInner`，隐藏 media 层，调用 `engine.__legacy('solid'|'grain')`（由 app.js 注入），并在 spec 里同步 `style.blur=0`（这两类不走 blur）。
  - `image`：`<img>` fill；`video`：`<video muted loop autoplay playsinline>`；`group`/`wind`：取当前帧 itemId/url 后同上（frame 由 playback 决定）。
  - 任何 media 内容：`__legacy('solid')` 先把旧背景切到纯色底，再画媒体；成功后 `theme.apply(...)`；失败（URL 失效等）保留上一帧并 dispatch `moonfog-wp-error`。
- 性能：`isLowPerfMode?.()` 为 true 时 video 不自动播放、ripple 效果禁用（dispatch 警告事件）。
- 统一在 `#wallpaperMedia` 上加 `is-visible` 控制透明度过渡。

## 4. 效果（effects.js）

- `blur`：`#wallpaperMediaInner { filter: blur(Npx) }`；模糊时媒体层超出 1.1 倍避免边缘。
- `ripple`：canvas 覆盖层，WebGL 或 2D 波纹（若时间紧用 2D 余弦波纹 + requestAnimationFrame；跟随 `isLowPerfMode` 停用）。参数 `rippleAmp`、`rippleSpeed`。
- `wash`：压暗/提亮蒙层（rgba 黑/白，0.01×wash alpha）。
- 视频项附加 `video { object-fit: cover }`。

## 5. 设置 UI 契约（UI 代理）

### 背景页（L2「主题与背景」内）替换旧卡片 B–F：
```html
<!-- 卡片 B：三入口，data-value 保持 solid/grain/media -->
<div id="bgModeGrid">… solid/grain/media …</div>

<!-- 卡片 E：媒体摘要（media 选中时显示，无媒体时显示引导） -->
<div class="setting-item settings-reveal" id="bgMediaSummaryItem" hidden>
  <div class="bg-media-summary">
    <div class="bg-media-thumb" id="bgMediaSummaryThumb"></div>
    <div class="bg-media-summary-text">
      <span class="bg-extra-title" id="bgMediaSummaryTitle">未选择媒体</span>
      <span class="bg-extra-meta" id="bgMediaSummaryMeta">图片 / 视频 / 轮换 / 动态</span>
    </div>
    <button class="bg-action-btn" id="bgMediaLibraryBtn" type="button">打开壁纸库</button>
  </div>
</div>
```
- 旧 `#bgMediaSourceItem` / `#bgLocalActions` / `#bgBingGroup` / `#bgBlurSetting` / `#bgWashSetting` 从背景页移除（blur/wash 移到 L3 的「样式」区；水波纹新增）；纯色卡（颜色）、流光卡（`#bgGrainGroup` 整体）保留，media 选中时隐藏。
- 卡片 B 点击：solid/grain → `Wp.spec.set({content:{kind}})`（由 engine 渲染）+ 保留旧 applyBackgroundMode 兼容；media → 切到摘要卡 + 默认取 `Wp.library.currentId()`，无则用 `catalogs.applyBing()`。

### L3 壁纸库页（`#settingsViewSub` 内新增）：
```html
<section class="settings-page" data-page="wallpaper" hidden aria-labelledby="sec-wallpaper">
  <h4 class="settings-section-title" id="sec-wallpaper" hidden>壁纸库</h4>
  <div class="settings-page-head"><div class="settings-page-head-icon"><span class="mgc_photo_library_fill"></span></div>
    <div><h3 class="settings-page-title">壁纸库</h3><p class="settings-page-desc">图片、视频、轮换与动态壁纸</p></div></div>
  <div class="settings-card"> 预览卡 #wallpaperPreview（img/video 缩略 + #wallpaperPreviewMeta + 换一张按钮 #wallpaperShuffleBtn） </div>
  <div class="settings-card"> tabs #wallpaperTabs（全部/图片/视频/轮换/动态/在线源）+ 网格 #wallpaperGrid + 空态 #wallpaperEmpty + 添加按钮 #wallpaperAddBtn </div>
  <div class="settings-card"> 播放方式 #wallpaperPlaybackSeg（静止/轮换/动态）+ 条件行 #wallpaperPlaybackParams </div>
  <div class="settings-card"> 样式 #wallpaperStyleSeg（无/模糊/水波纹）+ 参数 #wallpaperStyleParams（blur 滑杆 #wallpaperBlurSlider、ripple 幅度/速度） </div>
</section>
```
- 注册到 `SETTINGS_CHILDREN`：`appearance-bg → wallpaper`（`js/settings.js` 里已有该常量，按现有格式加）。
- 添加弹层：复用 `.modal`/`.modal-container` 样式，id `wallpaperAddModal`，选项：本地文件（`<input type="file" accept="image/*,video/*" multiple>`）、在线链接（input + 类型 radio）、在线源-必应每日、新建轮换组（勾选已有条目）。
- 网格条目：2 列；点击=设为当前；右上角「…」打开条目菜单（重命名/删除）；空态给「添加第一张壁纸 + 必应每日」。

## 6. 播放器（playback.js）

- `still`：不轮换。
- `rotate`：若当前 content 是 group（或库中 ≥2 项且用户选择轮换），每 `intervalMin` 分钟把 `content.frameId` 推进（sequence/shuffle），`spec.set` 触发重渲染。
- `dynamic`（wind）：按本地时间取 `frames[].at` 最近的帧；每 5 分钟校一次。
- 换新标签页时：`start()` 读 spec；rotate 的序号持久化在 sessionStorage `moonfog_wp_rotate_idx`。

## 7. 迁移（spec.js 内实现，DATA 代理无需重复）

首次运行（无 `moonfog_wallpaper_spec`）：
1. `moonfog_bg_local`（dataURL）存在 → 建 image 条目（source=local, url=dataURL），spec.content={kind:'image',itemId}；
2. `moonfog_bg_bing` 缓存存在 → 建 bing 条目（source=bing, url=imageUrl），spec.content 同；
3. 否则按旧 `moonfog_bg_mode`：solid → {kind:'solid'}；grain → {kind:'gradient'}；
4. 旧 `moonfog_bg_blur` → style.blur；写 `moonfog_wallpaper_migrated='1'`。
迁移后 spec 的 solid/gradient 仍写回 `moonfog_bg_mode`，保证旧渲染器一致。

## 8. 首绘（boot-utils/boot-config，DATA 代理）

- `boot-config.js` 已有背景首绘（solid/grain/local/bing）。新增：若 `moonfog_wallpaper_spec` 存在且 kind 为 image/video/group/wind，读 itemId → items 数组 → 取 url（或 group 首帧 url / bing url）作为首绘背景；失败回退旧逻辑。
- `boot-utils.js` 同理，取 spec 背景 url 写 CSS 变量（保持现有函数签名）。

## 9. 验收（Lead 最后统一跑）

```powershell
node --check js/wallpaper/*.js
npm run check
node scripts/build-web.mjs
npm run pack
npm run pack:firefox
```
+ 静态检查：`newtab.html` 含 `#wallpaperMedia`、L3 页；`js/wallpaper/*` 均被 newtab.html 引入；spec 键名一致。
+ 实机 smoke（可选，沙箱允许时）：Chrome/Edge 加载已解压，主页可渲染必应每日、切换纯色/流光、壁纸库可见。

## 10. 时间与协作

- 30 分钟内交付第一版（允许 TODO 注释，但节点 --check 必须过、功能可跑）。
- 完成后回报：改了哪些文件、对外 API 是否按契约、已知未完成点。
- 不要 `git commit`（Lead 统一提交）。
