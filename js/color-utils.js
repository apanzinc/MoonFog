/**
 * MoonFog Material You 色彩模块
 * 基于 @material/material-color-utilities 的 HCT 配色系统
 * 替换原有 HSL 手写 pickMonetColors + buildMonetRoles
 */
;(function () {
  'use strict'

  const MCU = window.MaterialColorUtilities
  if (!MCU) {
    console.warn('[MoonFog] MaterialColorUtilities not loaded')
    return
  }

  const { Hct, QuantizerCelebi, Score, SchemeTonalSpot, ColorUtils } = MCU

  /* ── helpers ───────────────────────────────────────────────────────────── */

  function argbToHex(argb) {
    const r = (argb >>> 16) & 0xff
    const g = (argb >>> 8) & 0xff
    const b = argb & 0xff
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  }

  function argbToRgb(argb) {
    return {
      r: (argb >>> 16) & 0xff,
      g: (argb >>> 8) & 0xff,
      b: argb & 0xff
    }
  }

  function rgba(argb, alpha) {
    const { r, g, b } = argbToRgb(argb)
    return `rgba(${r},${g},${b},${alpha})`
  }

  /* ── seed extraction ───────────────────────────────────────────────────── */

  /**
   * 从 canvas 像素数据中提取种子色
   * 返回 HCT 色彩对象（用于创建 DynamicScheme）
   */
  function extractSeedFromPixelData(data, width, height) {
    // 量化像素：取 RGBA 整数数组
    const pixels = []
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a < 200) continue // 跳过半透明
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // 跳过近白近黑
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max < 10 || min > 245) continue
      pixels.push(ColorUtils.argbFromRgb(r, g, b))
    }

    if (!pixels.length) {
      return Hct.from(250, 48, 50) // fallback: 默认紫色种子
    }

    // 量化 → 取 Top 16 色 → 评分排序
    const quantized = QuantizerCelebi.quantize(pixels, 16)
    const ranked = Score.score(quantized)
    const seedArgb = ranked[0]

    return Hct.fromInt(seedArgb)
  }

  /* ── scheme generation ─────────────────────────────────────────────────── */

  /**
   * 创建 Material You SchemeTonalSpot
   * @param {Hct} seedHct - 种子色（HCT）
   * @param {boolean} isDark - 是否深色模式
   * @param {number} contrastLevel - 对比度级别 (-1, 0, 1)
   * @returns {SchemeTonalSpot}
   */
  function createScheme(seedHct, isDark, contrastLevel) {
    return new SchemeTonalSpot(seedHct, isDark, contrastLevel || 0)
  }

  /**
   * 从 Scheme 中提取所有 Material You 角色色
   * @param {SchemeTonalSpot} scheme
   * @returns {Object} 角色色 ARGB 整数映射
   */
  function extractRoles(scheme) {
    return {
      primary: scheme.primary,
      onPrimary: scheme.onPrimary,
      primaryContainer: scheme.primaryContainer,
      onPrimaryContainer: scheme.onPrimaryContainer,
      secondary: scheme.secondary,
      onSecondary: scheme.onSecondary,
      secondaryContainer: scheme.secondaryContainer,
      onSecondaryContainer: scheme.onSecondaryContainer,
      tertiary: scheme.tertiary,
      onTertiary: scheme.onTertiary,
      tertiaryContainer: scheme.tertiaryContainer,
      onTertiaryContainer: scheme.onTertiaryContainer,
      error: scheme.error,
      onError: scheme.onError,
      errorContainer: scheme.errorContainer,
      onErrorContainer: scheme.onErrorContainer,
      background: scheme.background,
      onBackground: scheme.onBackground,
      surface: scheme.surface,
      onSurface: scheme.onSurface,
      surfaceVariant: scheme.surfaceVariant,
      onSurfaceVariant: scheme.onSurfaceVariant,
      outline: scheme.outline,
      outlineVariant: scheme.outlineVariant,
      shadow: scheme.shadow,
      scrim: scheme.scrim,
      inverseSurface: scheme.inverseSurface,
      inverseOnSurface: scheme.inverseOnSurface,
      inversePrimary: scheme.inversePrimary
    }
  }

  /* ── palette builder (drop-in for buildMonetRoles) ─────────────────────── */

  /**
   * Material You tonal roles 生成
   * 替换原有 buildMonetRoles，使用 HCT 色彩空间
   * @param {Hct} seedHct - 种子色
   * @param {boolean} userDark - 用户深色模式
   * @returns {Object} 与原有 buildMonetRoles 输出格式兼容
   */
  function buildMonetRolesNew(seedHct, userDark) {
    const scheme = createScheme(seedHct, userDark, 0)
    const roles = extractRoles(scheme)

    const seedRgb = argbToRgb(seedHct.toInt())
    const seedHex = argbToHex(seedHct.toInt())

    return {
      accent1: argbToRgb(roles.primary),
      accent1Container: argbToRgb(roles.primaryContainer),
      accent2: argbToRgb(roles.secondary),
      accent2Container: argbToRgb(roles.secondaryContainer),
      accent3: argbToRgb(roles.tertiary),
      neutral1: argbToRgb(roles.surface),
      neutral2: argbToRgb(roles.surfaceVariant),
      surface: argbToRgb(roles.surface),
      surfaceHigh: argbToRgb(roles.inverseSurface),
      surfaceBright: argbToRgb(roles.surface),
      onSurface: argbToRgb(roles.onSurface),
      onSurfaceVariant: argbToRgb(roles.onSurfaceVariant),
      outline: argbToRgb(roles.outline),
      wash: argbToRgb(roles.shadow),
      seedHex,
      _scheme: scheme,
      _roles: roles
    }
  }

  /* ── palette builder (drop-in for buildPaletteFromDominant) ─────────────── */

  /**
   * 完整 palette 生成（替换 buildPaletteFromDominant 的核心逻辑）
   * 返回格式与原有 palette 完全兼容
   */
  function buildPaletteNew(seedHct, userDark, sceneDark, sceneL) {
    const roles = buildMonetRolesNew(seedHct, userDark)
    const scheme = roles._scheme
    const r = roles._roles

    const seedH = seedHct.hue
    const seedRgb = roles.accent1

    const mix = (base, tint, t) => ({
      r: Math.round(base.r * (1 - t) + tint.r * t),
      g: Math.round(base.g * (1 - t) + tint.g * t),
      b: Math.round(base.b * (1 - t) + tint.b * t)
    })

    const midTone = sceneL >= 38 && sceneL <= 62

    // 裸露问候字：跟壁纸场景
    const bareText = sceneDark
      ? { r: 255, g: 255, b: 255 }
      : { r: 26, g: 24, b: 20 }
    const bareSecondary = sceneDark
      ? { r: 230, g: 228, b: 220 }
      : { r: 60, g: 56, b: 48 }
    const bareMuted = sceneDark
      ? { r: 200, g: 196, b: 186 }
      : { r: 90, g: 86, b: 76 }

    // 控件存/表面：跟用户浅深
    const chromeText = argbToRgb(r.onSurface)
    const chromeSecondary = argbToRgb(r.onSurfaceVariant)
    const chromeMuted = userDark
      ? argbToRgb(r.onSurfaceVariant)
      : mix(argbToRgb(r.onSurfaceVariant), argbToRgb(r.outline), 0.35)

    const surface = mix(argbToRgb(r.surface), argbToRgb(r.secondaryContainer), 0.12)
    const surfaceHover = mix(argbToRgb(r.surface), argbToRgb(r.primaryContainer), 0.16)
    const chip = mix(argbToRgb(r.surface), argbToRgb(r.surfaceVariant), userDark ? 0.2 : 0.28)
    const creditBg = mix(argbToRgb(r.surface), argbToRgb(r.surfaceVariant), 0.15)

    const surfaceAlpha = userDark ? (midTone ? 0.72 : 0.64) : (midTone ? 0.88 : 0.82)
    const chipAlpha = userDark ? 0.5 : (midTone ? 0.82 : 0.76)
    const borderAlpha = userDark ? 0.36 : 0.22

    const washAlpha = sceneDark
      ? (midTone ? 0.34 : 0.28)
      : (midTone ? 0.2 : 0.14)
    const washRgb = sceneDark
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 }

    return {
      isDarkUi: userDark,
      sceneDark,
      sceneL,
      themeStyle: 'TONAL_SPOT',
      seedHex: roles.seedHex,
      text: rgba(argbToRgb(r.onBackground).r ? r.onBackground : (sceneDark ? 0xFFFFFFFF : 0x1A181400), 0.92),
      textSecondary: rgba(sceneDark ? 0xFFE6E4DC : 0xFF3C3830, 0.84),
      textMuted: rgba(sceneDark ? 0xFFC8C4BA : 0xFF5A5548, 0.72),
      textAccent: rgba(r.primary, 0.92),
      textShadow: 'none',
      textShadowSoft: 'none',
      textGlow: 'transparent',
      chromeText: rgba(r.onSurface, 0.96),
      chromeTextSecondary: rgba(r.onSurfaceVariant, 0.88),
      chromeTextMuted: rgba(chromeMuted.r ? ColorUtils.argbFromRgb(chromeMuted.r, chromeMuted.g, chromeMuted.b) : r.onSurfaceVariant, userDark ? 0.72 : 0.7),
      surface: rgba(ColorUtils.argbFromRgb(surface.r, surface.g, surface.b), surfaceAlpha),
      surfaceHover: rgba(ColorUtils.argbFromRgb(surfaceHover.r, surfaceHover.g, surfaceHover.b), userDark ? 0.78 : 0.94),
      chip: rgba(ColorUtils.argbFromRgb(chip.r, chip.g, chip.b), chipAlpha),
      border: rgba(r.outline, borderAlpha),
      shadow: userDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)',
      creditBg: rgba(ColorUtils.argbFromRgb(creditBg.r, creditBg.g, creditBg.b), userDark ? 0.55 : 0.78),
      creditText: rgba(sceneDark ? 0xFFFFFFFF : 0x1A181400, 0.9),
      wash: rgba(ColorUtils.argbFromRgb(washRgb.r, washRgb.g, washRgb.b), washAlpha),
      accent: rgba(r.primary, 0.95),
      accentSoft: rgba(r.primary, userDark ? 0.18 : 0.12),
      accent2: rgba(r.secondary, 0.9),
      focusRing: rgba(r.primary, userDark ? 0.4 : 0.3)
    }
  }

  /* ── public API ────────────────────────────────────────────────────────── */

  window.MoonFogColor = {
    extractSeedFromPixelData,
    createScheme,
    extractRoles,
    buildMonetRolesNew,
    buildPaletteNew,
    Hct,
    argbToHex,
    argbToRgb,
    rgba
  }
})()
