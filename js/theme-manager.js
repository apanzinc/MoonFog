/**
 * MoonFog - ThemeManager
 * 统一主题管理：单一数据源 + 统一 apply()
 * 解决 boot/runtime 变量不一致、设置面板白字白底等问题
 *
 * 用法:
 *   window.__MOONFOG_THEME_MANAGER__.apply({ tone, mode, imagePalette, grainPalette })
 *   window.__MOONFOG_THEME_MANAGER__.on('change', (state) => { ... })
 *   window.__MOONFOG_THEME_MANAGER__.getSnapshot()  // 调试 / 预设导出
 */
;(function () {
  'use strict'

  /* =============================================
     1. 主题色板（与 boot-config.js THEMES 一致）
     ============================================= */
  const THEMES = {
    sand: {
      light: { '--bg-warm':'#F5F0E8','--bg-warm-alt':'#EDE8E0','--card-bg':'#FFFFFF','--text-primary':'#1A1A1A','--text-secondary':'#6B6B6B','--text-tertiary':'#9A9A9A','--border':'rgba(0,0,0,0.08)','--border-strong':'rgba(0,0,0,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.06)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.1)' },
      dark:  { '--bg-warm':'#1E1C18','--bg-warm-alt':'#2A2720','--card-bg':'#332F28','--text-primary':'#E5DFD0','--text-secondary':'#9A9485','--text-tertiary':'#6A6558','--accent':'#D4A855','--accent-hover':'#C49A45','--accent-glow':'rgba(212,168,85,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    cream: {
      light: { '--bg-warm':'#FDF6EC','--bg-warm-alt':'#F5ECD8','--card-bg':'#FFFEFA','--text-primary':'#2C1810','--text-secondary':'#7A6555','--text-tertiary':'#A89888','--border':'rgba(80,50,20,0.08)','--border-strong':'rgba(80,50,20,0.15)','--shadow':'0 4px 20px rgba(80,50,20,0.06)','--shadow-hover':'0 8px 30px rgba(80,50,20,0.1)' },
      dark:  { '--bg-warm':'#1E1A14','--bg-warm-alt':'#2A2418','--card-bg':'#332C1E','--text-primary':'#E8DCC8','--text-secondary':'#9A8A70','--text-tertiary':'#6A6048','--accent':'#D4A855','--accent-hover':'#C49A45','--accent-glow':'rgba(212,168,85,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    rose: {
      light: { '--bg-warm':'#F8EDE8','--bg-warm-alt':'#F0E0D8','--card-bg':'#FFFCFB','--text-primary':'#2D1B18','--text-secondary':'#7A5550','--text-tertiary':'#A88882','--border':'rgba(100,50,40,0.08)','--border-strong':'rgba(100,50,40,0.15)','--shadow':'0 4px 20px rgba(100,50,40,0.06)','--shadow-hover':'0 8px 30px rgba(100,50,40,0.1)' },
      dark:  { '--bg-warm':'#1E1818','--bg-warm-alt':'#2A2020','--card-bg':'#332828','--text-primary':'#E8D8D0','--text-secondary':'#9A7A72','--text-tertiary':'#6A5550','--accent':'#D4725E','--accent-hover':'#C46050','--accent-glow':'rgba(212,114,94,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    sage: {
      light: { '--bg-warm':'#ECEEE5','--bg-warm-alt':'#E0E3D5','--card-bg':'#FAFBF8','--text-primary':'#1E2018','--text-secondary':'#5D6050','--text-tertiary':'#8B8E80','--border':'rgba(50,60,30,0.08)','--border-strong':'rgba(50,60,30,0.15)','--shadow':'0 4px 20px rgba(50,60,30,0.06)','--shadow-hover':'0 8px 30px rgba(50,60,30,0.1)' },
      dark:  { '--bg-warm':'#181C16','--bg-warm-alt':'#222820','--card-bg':'#2A3228','--text-primary':'#D8E0D0','--text-secondary':'#889878','--text-tertiary':'#5E6A50','--accent':'#7AB85E','--accent-hover':'#6AA84E','--accent-glow':'rgba(122,184,94,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    sky: {
      light: { '--bg-warm':'#E8F0F5','--bg-warm-alt':'#D8E4ED','--card-bg':'#FAFCFE','--text-primary':'#15202B','--text-secondary':'#4A6275','--text-tertiary':'#8098A8','--border':'rgba(20,50,80,0.08)','--border-strong':'rgba(20,50,80,0.15)','--shadow':'0 4px 20px rgba(20,50,80,0.06)','--shadow-hover':'0 8px 30px rgba(20,50,80,0.1)' },
      dark:  { '--bg-warm':'#161B20','--bg-warm-alt':'#20282E','--card-bg':'#283238','--text-primary':'#D0DAE5','--text-secondary':'#7898B0','--text-tertiary':'#506878','--accent':'#4EA4F0','--accent-hover':'#3A90D8','--accent-glow':'rgba(78,164,240,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    lavender: {
      light: { '--bg-warm':'#EDE8F0','--bg-warm-alt':'#E0D8E6','--card-bg':'#FCFAFD','--text-primary':'#1E1828','--text-secondary':'#5E5470','--text-tertiary':'#8C82A0','--border':'rgba(50,30,70,0.08)','--border-strong':'rgba(50,30,70,0.15)','--shadow':'0 4px 20px rgba(50,30,70,0.06)','--shadow-hover':'0 8px 30px rgba(50,30,70,0.1)' },
      dark:  { '--bg-warm':'#1A1620','--bg-warm-alt':'#241E2A','--card-bg':'#2C2833','--text-primary':'#DAD0E5','--text-secondary':'#8A7CA0','--text-tertiary':'#5E5570','--accent':'#A080D0','--accent-hover':'#8E6EC0','--accent-glow':'rgba(160,128,208,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    },
    slate: {
      light: { '--bg-warm':'#E8E9EC','--bg-warm-alt':'#DCDEE3','--card-bg':'#F8F9FA','--text-primary':'#1A1C20','--text-secondary':'#555960','--text-tertiary':'#8A8E95','--border':'rgba(30,30,40,0.1)','--border-strong':'rgba(30,30,40,0.18)','--shadow':'0 4px 20px rgba(30,30,40,0.08)','--shadow-hover':'0 8px 30px rgba(30,30,40,0.12)' },
      dark:  { '--bg-warm':'#1A1B1E','--bg-warm-alt':'#24262A','--card-bg':'#2A2C30','--text-primary':'#E0E0E0','--text-secondary':'#9A9A9A','--text-tertiary':'#6A6A6A','--accent':'#8AB0C8','--accent-hover':'#7A9EB8','--accent-glow':'rgba(138,176,200,0.15)','--border':'rgba(255,255,255,0.08)','--border-strong':'rgba(255,255,255,0.15)','--shadow':'0 4px 20px rgba(0,0,0,0.3)','--shadow-hover':'0 8px 30px rgba(0,0,0,0.4)' }
    }
  }

  /* =============================================
     2. 自定义色板生成
     ============================================= */
  const CUSTOM_TONE_KEY = 'moonfog_custom_color'

  function generateCustomPalette(hex, isDark) {
    const MCU = window.MaterialColorUtilities
    if (!MCU || !MCU.Hct) return null
    try {
      const argb = MCU.ColorUtils.argbFromHex(hex)
      const hct = MCU.Hct.fromInt(argb)
      const scheme = new MCU.SchemeTonalSpot(hct, isDark)
      const role = (fn) => {
        const argb = fn(scheme)
        const r = (argb >>> 16) & 0xff
        const g = (argb >>> 8) & 0xff
        const b = argb & 0xff
        return `rgb(${r},${g},${b})`
      }
      const hexFrom = (fn) => {
        const argb = fn(scheme)
        return '#' + ((1 << 24) | ((argb >>> 16) & 0xff) << 16 | ((argb >>> 8) & 0xff) << 8 | (argb & 0xff)).toString(16).slice(1)
      }
      const rgba = (fn, a) => {
        const argb = fn(scheme)
        const r = (argb >>> 16) & 0xff
        const g = (argb >>> 8) & 0xff
        const b = argb & 0xff
        return `rgba(${r},${g},${b},${a})`
      }
      const accent = hexFrom(s => s.primary)
      const accentHover = hexFrom(s => s.primary)
      const accentGlow = rgba(s => s.primary, 0.15)

      return {
        '--bg-warm': isDark ? '#1E1C18' : '#F5F0E8',
        '--bg-warm-alt': isDark ? '#2A2720' : '#EDE8E0',
        '--card-bg': role(s => s.surfaceContainerLow),
        '--text-primary': isDark ? '#E5DFD0' : '#1A1A1A',
        '--text-secondary': isDark ? 'rgba(229,223,208,0.75)' : 'rgba(26,26,26,0.65)',
        '--text-tertiary': isDark ? 'rgba(229,223,208,0.5)' : 'rgba(26,26,26,0.45)',
        '--accent': accent,
        '--accent-hover': accentHover,
        '--accent-glow': accentGlow,
        '--border': isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        '--border-strong': isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        '--shadow': isDark ? '0 4px 20px rgba(0,0,0,0.3)' : `0 4px 20px rgba(0,0,0,0.06)`,
        '--shadow-hover': isDark ? '0 8px 30px rgba(0,0,0,0.4)' : `0 8px 30px rgba(0,0,0,0.1)`
      }
    } catch (e) {
      console.warn('[MoonFog] generateCustomPalette failed:', e)
      return null
    }
  }

  /* =============================================
     3. 状态
     ============================================= */
  const state = {
    tone: 'sand',
    mode: 'light',
    modePref: 'system',
    // 图片壁纸
    imageBg: false,
    imagePalette: null,
    imageUiDark: false,
    // 流光渐变
    grainActive: false,
    grainPalette: null,
    // 字体 / 粗细
    fontKey: 'sourcehanserif',
    weight: '700',
    // 模糊
    panelBlur: 10,
    searchBlur: 40,
    bgBlur: 20,
    // 性能
    perfMode: 'full'
  }

  /* =============================================
     3. 事件系统
     ============================================= */
  const listeners = new Set()

  function emit (changeKeys) {
    const snapshot = Object.assign({}, state)
    listeners.forEach(function (fn) {
      try { fn(snapshot, changeKeys) } catch (_) {}
    })
  }

  /* =============================================
     4. 核心: apply() — 单一入口写入所有 CSS 变量
     ============================================= */
  function apply (patch) {
    const changeKeys = []
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        if (state[k] !== patch[k]) {
          changeKeys.push(k)
          state[k] = patch[k]
        }
      })
    }

    const root = document.documentElement
    if (!root) return

    console.log('[MoonFog] ThemeManager.apply() called, imageBg:', state.imageBg, 'imagePalette:', !!state.imagePalette, 'patch:', patch ? Object.keys(patch) : 'none')

    // --- 4a. 主题色板 ---
    const isDark = state.mode === 'dark'
    let palette
    if (state.tone === 'custom') {
      const customColor = localStorage.getItem(CUSTOM_TONE_KEY)
      palette = customColor ? generateCustomPalette(customColor, isDark) : null
      palette = palette || THEMES.sand[isDark ? 'dark' : 'light']
    } else {
      const tone = THEMES[state.tone] ? state.tone : 'sand'
      palette = (THEMES[tone] && THEMES[tone][isDark ? 'dark' : 'light']) || THEMES.sand.light
    }

    // 图片/流光模式：跳过基础色板，避免无 !important 的值先写入后被覆盖
    if (!(state.imageBg && state.imagePalette) && !(state.grainActive && state.grainPalette)) {
      Object.keys(palette).forEach(function (k) {
        root.style.setProperty(k, palette[k])
      })
    }

    // --- 4b. color-scheme ---
    root.style.colorScheme = isDark ? 'dark' : 'light'
    root.setAttribute('data-mode', state.mode)
    root.setAttribute('data-tone', state.tone)
    root.setAttribute('data-mode-pref', state.modePref)

    // --- 4c. 图片壁纸 surface tokens ---
    if (state.imageBg && state.imagePalette) {
      var ip = state.imagePalette
      var imp = 'important'
      // 取舍原则：--bg-warm / --card-bg / --text-* 用中性色保证对比度；--accent / --border / --shadow 可提取种子色
      root.style.setProperty('--bg-warm', ip.isDarkUi ? '#1E1C18' : '#F5F0E8', imp)
      root.style.setProperty('--bg-warm-alt', ip.isDarkUi ? '#252320' : '#F8F4ED', imp)
      // 面板文字颜色固定跟 isDarkUi（ip.text 跟壁纸场景亮度，不跟用户模式）
      root.style.setProperty('--card-bg', ip.isDarkUi ? 'rgba(40,42,50,0.85)' : 'rgba(255,255,255,0.82)', imp)
      root.style.setProperty('--text-primary', ip.isDarkUi ? '#E5DFD0' : '#1A1A1A', imp)
      root.style.setProperty('--text-secondary', ip.isDarkUi ? 'rgba(229,223,208,0.75)' : 'rgba(26,26,26,0.65)', imp)
      root.style.setProperty('--text-tertiary', ip.isDarkUi ? 'rgba(229,223,208,0.5)' : 'rgba(26,26,26,0.45)', imp)
      // 种子色只用于装饰元素（accent/border/shadow），不影响可读性
      root.style.setProperty('--border', ip.border || 'rgba(255,255,255,0.2)', imp)
      root.style.setProperty('--border-strong', ip.border || 'rgba(255,255,255,0.3)', imp)
      root.style.setProperty('--shadow', ip.shadow || '0 4px 20px rgba(0,0,0,0.3)', imp)
      root.style.setProperty('--shadow-hover', ip.shadow || '0 8px 30px rgba(0,0,0,0.4)', imp)
      if (ip.accent) root.style.setProperty('--accent', ip.accent, imp)
      if (ip.accentSoft) root.style.setProperty('--accent-glow', ip.accentSoft, imp)
      if (ip.accent2) root.style.setProperty('--accent-hover', ip.accent2, imp)
      root.style.setProperty('--surface-text-primary', ip.isDarkUi ? '#E5DFD0' : '#1A1A1A', imp)
      root.style.setProperty('--surface-text-secondary', ip.isDarkUi ? 'rgba(229,223,208,0.75)' : 'rgba(26,26,26,0.65)', imp)
      root.style.setProperty('--surface-text-muted', ip.isDarkUi ? 'rgba(229,223,208,0.5)' : 'rgba(26,26,26,0.45)', imp)
      root.style.setProperty('--surface-bg', ip.isDarkUi ? 'rgba(40,42,50,0.85)' : 'rgba(255,255,255,0.80)', imp)
      root.style.setProperty('--surface-bg-hover', ip.isDarkUi ? 'rgba(55,57,65,0.88)' : 'rgba(255,255,255,0.88)', imp)
      root.style.setProperty('--surface-border', 'rgba(255,255,255,0.2)', imp)
      root.style.setProperty('--surface-chip', ip.chip || 'transparent', imp)
    } else if (state.grainActive && state.grainPalette) {
      // 流光模式：surface-text 跟随主题文字色（白色）
      root.style.setProperty('--surface-text-primary', '#FFFFFF')
      root.style.setProperty('--surface-text-secondary', 'rgba(255,255,255,0.75)')
      root.style.setProperty('--surface-text-muted', 'rgba(255,255,255,0.5)')
      root.style.setProperty('--surface-bg', palette['--card-bg'] || '#FFFFFF')
      root.style.setProperty('--surface-bg-hover', palette['--bg-warm-alt'] || '#EDE8E0')
      root.style.setProperty('--surface-border', palette['--border'] || 'rgba(0,0,0,0.08)')
      root.style.setProperty('--surface-chip', 'transparent')
    } else {
      // 纯色模式：surface-text 跟随主题文字色
      root.style.setProperty('--surface-text-primary', palette['--text-primary'] || '#1A1A1A')
      root.style.setProperty('--surface-text-secondary', palette['--text-secondary'] || '#6B6B6B')
      root.style.setProperty('--surface-text-muted', palette['--text-tertiary'] || '#9A9A9A')
      root.style.setProperty('--surface-bg', palette['--bg-warm'] || '#F5F0E8')
      root.style.setProperty('--surface-bg-hover', palette['--bg-warm-alt'] || '#EDE8E0')
      root.style.setProperty('--surface-border', palette['--border'] || 'rgba(0,0,0,0.08)')
      root.style.setProperty('--surface-chip', 'transparent')
    }

    // --- 4d. 模糊 ---
    var perfMode = state.perfMode
    var visualPanelBlur = state.panelBlur
    var visualSearchBlur = state.searchBlur
    var visualBgBlur = state.bgBlur
    if (perfMode === 'low') {
      visualPanelBlur = 0; visualSearchBlur = 0; visualBgBlur = 0
    } else if (perfMode === 'balanced') {
      visualPanelBlur = Math.min(6, Math.round(state.panelBlur * 0.45))
    }
    root.style.setProperty('--panel-blur', visualPanelBlur + 'px')
    root.style.setProperty('--search-blur', visualSearchBlur + 'px')
    root.style.setProperty('--chrome-blur', Math.min(40, Math.max(0, Math.round((visualSearchBlur + visualPanelBlur) / 2))) + 'px')

    // --- 4e. themeColor meta ---
    try {
      var meta = document.getElementById('themeColorMeta')
      if (meta) meta.setAttribute('content', palette['--bg-warm'] || '#F5F0E8')
    } catch (_) {}

    // --- 4f. body classes ---
    if (document.body) {
      document.body.classList.toggle('has-image-bg', state.imageBg)
      document.body.classList.toggle('img-ui-dark', state.imageBg && state.imageUiDark)
      document.body.classList.toggle('img-ui-light', state.imageBg && !state.imageUiDark)
      document.body.classList.toggle('img-scene-dark', state.imageBg)
      document.body.classList.toggle('has-grain-bg', state.grainActive)
    }

    // --- 4g. html classes ---
    root.classList.toggle('boot-has-image', state.imageBg)

    // --- 4h. 触发事件 ---
    if (changeKeys.length) emit(changeKeys)
  }

  /* =============================================
     5. 快捷方法
     ============================================= */
  function setImagePalette (palette) {
    state.imagePalette = palette
    state.imageBg = !!palette
    // 同步 DOM 上的 data-mode，防止旧 state.mode 覆盖
    var dm = document.documentElement.getAttribute('data-mode')
    if (dm) state.mode = dm
    apply()
  }

  function clearImagePalette () {
    state.imagePalette = null
    state.imageBg = false
    var dm = document.documentElement.getAttribute('data-mode')
    if (dm) state.mode = dm
    apply()
  }

  function setGrainPalette (palette) {
    state.grainPalette = palette
    state.grainActive = !!palette
    apply()
  }

  function getSnapshot () {
    return Object.assign({}, state)
  }

  function onChange (fn) {
    listeners.add(fn)
    return function () { listeners.delete(fn) }
  }

  /* =============================================
     6. 导出
     ============================================= */
  var api = {
    apply: apply,
    setImagePalette: setImagePalette,
    clearImagePalette: clearImagePalette,
    setGrainPalette: setGrainPalette,
    getSnapshot: getSnapshot,
    onChange: onChange,
    THEMES: THEMES,
    state: state
  }

  window.__MOONFOG_THEME_MANAGER__ = api
})()
