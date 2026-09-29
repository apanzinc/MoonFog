/**
 * Grain Gradient backgrounds powered by Paper Design's official shader.
 * Paper Shaders is vendored locally under Apache-2.0; see js/vendor/paper-shaders.
 */
import { ShaderMount } from './vendor/paper-shaders/shader-mount.js';
import { getShaderColorFromString } from './vendor/paper-shaders/get-shader-color-from-string.js';
import { getShaderNoiseTexture } from './vendor/paper-shaders/get-shader-noise-texture.js';
import {
  GrainGradientShapes,
  grainGradientFragmentShader
} from './vendor/paper-shaders/shaders/grain-gradient.js';

const DEFAULT_PALETTES = {
  light: {
    colors: ['#f4e6be', '#e8cf92', '#d8b569', '#a47b39', '#c9a227', '#e8cf92', '#d8b569'],
    colorBack: '#f6f1ea'
  },
  dark: {
    colors: ['#3b3122', '#66502d', '#a47b39', '#c9a227', '#8a6420', '#66502d', '#a47b39'],
    colorBack: '#17140f'
  }
};
const GRAIN_SETTINGS_KEY = 'moonfog_grain_settings';
const GRAIN_SHAPE_IDS = Object.keys(GrainGradientShapes);
const DEFAULT_SETTINGS = {
  shape: 'corners',
  speed: 66,
  noise: 86,
  softness: 100,
  intensity: 100,
  // 渐变色数量（不含背景色），范�?2�?
  colorCount: 4,
  // Paper Shaders offset�?100�?00 �?u_offset ±1
  offsetX: 0,
  offsetY: 0,
  light: DEFAULT_PALETTES.light,
  dark: DEFAULT_PALETTES.dark
};

function normalizeShape(value) {
  const key = String(value || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(GrainGradientShapes, key) ? key : DEFAULT_SETTINGS.shape;
}

function shapeUniform(shape = grainSettings.shape) {
  return GrainGradientShapes[normalizeShape(shape)] || GrainGradientShapes.corners;
}
const TARGETS = {
  oobe: { id: 'oobeGrain', mount: null, promise: null, active: false },
  page: { id: 'pageBgGrain', mount: null, promise: null, active: false },
  preview: { id: 'oobeMediaGrain', mount: null, promise: null, active: false }
};

let noiseTexturePromise = null;
let grainSettings = loadSettings();

function copySettings(settings = DEFAULT_SETTINGS) {
  return {
    shape: normalizeShape(settings.shape),
    speed: settings.speed,
    noise: settings.noise,
    softness: settings.softness,
    intensity: settings.intensity,
    colorCount: settings.colorCount,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    light: {
      colors: [...settings.light.colors],
      colorBack: settings.light.colorBack
    },
    dark: {
      colors: [...settings.dark.colors],
      colorBack: settings.dark.colorBack
    }
  };
}

function validHex(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

function normalizeSettings(value) {
  const next = copySettings(DEFAULT_SETTINGS);
  if (!value || typeof value !== 'object') return next;
  next.shape = normalizeShape(value.shape);
  next.speed = clampNumber(value.speed, 0, 150, next.speed);
  next.noise = clampNumber(value.noise, 0, 100, next.noise);
  next.softness = clampNumber(value.softness, 0, 100, next.softness);
  next.intensity = clampNumber(value.intensity, 0, 100, next.intensity);
  next.colorCount = clampNumber(value.colorCount, 2, 7, next.colorCount);
  next.offsetX = clampNumber(value.offsetX, -100, 100, next.offsetX);
  next.offsetY = clampNumber(value.offsetY, -100, 100, next.offsetY);
  ['light', 'dark'].forEach((mode) => {
    const palette = value[mode];
    if (!palette || typeof palette !== 'object') return;
    next[mode].colorBack = validHex(palette.colorBack, next[mode].colorBack);
    if (Array.isArray(palette.colors)) {
      // 始终保留 7 个槽位，缺失时用循环默认值补齐
      const source = palette.colors.slice(0, 7);
      const merged = [];
      for (let i = 0; i < 7; i++) {
        merged.push(validHex(source[i], next[mode].colors[i]));
      }
      next[mode].colors = merged;
    }
  });
  return next;
}

function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(GRAIN_SETTINGS_KEY) || 'null'));
  } catch (_) {
    return copySettings(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(GRAIN_SETTINGS_KEY, JSON.stringify(grainSettings));
  } catch (_) {}
}

function notifySettings() {
  window.dispatchEvent(new CustomEvent('grain-settings-change', {
    detail: copySettings(grainSettings)
  }));
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);

  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', reject, { once: true });
  });
}

function animationSpeed() {
  const reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const perf = document.documentElement.getAttribute('data-perf');
  // balanced/low both disable animation (UI: 关闭动画)
  return reduceMotion || perf === 'low' || perf === 'balanced' ? 0 : grainSettings.speed / 100;
}

function syncActiveSpeeds() {
  const speed = animationSpeed();
  Object.values(TARGETS).forEach((target) => {
    if (target.active) target.mount?.setSpeed(speed);
  });
}

function disposeMount(target) {
  const mount = target.mount;
  target.mount = null;
  if (target.id) {
    const el = document.getElementById(target.id);
    if (el) el.classList.remove('grain-ready');
  }
  if (!mount) return;
  try {
    mount.dispose();
  } catch (_) {}
}

function activePaletteMode() {
  const explicitMode = document.documentElement.getAttribute('data-mode');
  if (explicitMode === 'dark') return 'dark';
  if (explicitMode === 'light') return 'light';

  const systemDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return systemDark ? 'dark' : 'light';
}

function activePalette() {
  return grainSettings[activePaletteMode()];
}

function paletteUniforms() {
  const palette = activePalette();
  const count = Math.min(Math.max(Number(grainSettings.colorCount) || 4, 2), 7);
  const colors = palette.colors.slice(0, count);
  return {
    u_colorBack: getShaderColorFromString(palette.colorBack),
    u_colors: colors.map(getShaderColorFromString),
    u_colorsCount: colors.length
  };
}

function configurableUniforms() {
  return {
    ...paletteUniforms(),
    u_noise: grainSettings.noise / 100,
    u_softness: grainSettings.softness / 100,
    u_intensity: grainSettings.intensity / 100,
    u_shape: shapeUniform(),
    // X：shader �?-u_offsetX，正值图形右�?    // Y：shader �?+u_offsetY 会下移，这里取反�?UI 正�?�?    u_offsetX: grainSettings.offsetX / 100,
    u_offsetY: -grainSettings.offsetY / 100
  };
}

function getNoiseTexture() {
  if (!noiseTexturePromise) {
    const texture = getShaderNoiseTexture();
    noiseTexturePromise = waitForImage(texture).then(() => texture);
  }
  return noiseTexturePromise;
}

async function createMount(target) {
  const container = document.getElementById(target.id);
  if (!container || target.mount) return target.mount;

  const noiseTexture = await getNoiseTexture();
  if (target.mount) return target.mount;
  if (!target.active) return null;
  const liveContainer = document.getElementById(target.id);
  if (!liveContainer) return null;

  const uniforms = {
    ...configurableUniforms(),
    u_noiseTexture: noiseTexture,
    u_fit: 1,
    u_scale: 0.92,
    u_rotation: 356,
    u_originX: 0.5,
    u_originY: 0.5,
    u_worldWidth: 0,
    u_worldHeight: 0
  };

  const mount = new ShaderMount(
    liveContainer,
    grainGradientFragmentShader,
    uniforms,
    undefined,
    target.active ? animationSpeed() : 0,
    0
  );
  if (!target.active) {
    try {
      mount.dispose();
    } catch (_) {}
    return null;
  }
  target.mount = mount;
  return target.mount;
}

function ensureMount(target) {
  if (target.mount) return Promise.resolve(target.mount);
  if (!target.promise) {
    target.promise = createMount(target)
      .then((instance) => {
        target.promise = null;
        if (!target.active) {
          if (instance) {
            try {
              instance.dispose();
            } catch (_) {}
            if (target.mount === instance) target.mount = null;
          }
          return null;
        }
        // canvas 渲染就绪，添加 grain-ready 让 CSS 显示背景
        const el = document.getElementById(target.id);
        if (el) el.classList.add('grain-ready');
        return instance;
      })
      .catch((error) => {
        target.promise = null;
        return null;
      });
  }
  return target.promise;
}

function setTargetActive(name, active) {
  const target = TARGETS[name];
  if (!target) return;
  target.active = Boolean(active);

  if (!target.active) {
    disposeMount(target);
    return;
  }

  ensureMount(target).then((instance) => {
    if (instance && target.active) instance.setSpeed(animationSpeed());
  });
}

function syncPalette() {
  const uniforms = configurableUniforms();
  const fallback = activePalette().colorBack;
  Object.values(TARGETS).forEach((target) => {
    const container = document.getElementById(target.id);
    if (container) container.style.backgroundColor = fallback;
    // Only push uniforms to live mounts (inactive targets are disposed)
    if (target.mount) target.mount.setUniforms(uniforms);
  });
}

function updateSettings(patch = {}) {
  const next = copySettings(grainSettings);
  let speedChanged = false;
  let uniformsChanged = false;

  if (Object.prototype.hasOwnProperty.call(patch, 'shape')) {
    const shape = normalizeShape(patch.shape);
    if (shape !== next.shape) {
      next.shape = shape;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'speed')) {
    const speed = clampNumber(patch.speed, 0, 150, next.speed);
    if (speed !== next.speed) {
      next.speed = speed;
      speedChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'noise')) {
    const noise = clampNumber(patch.noise, 0, 100, next.noise);
    if (noise !== next.noise) {
      next.noise = noise;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'softness')) {
    const softness = clampNumber(patch.softness, 0, 100, next.softness);
    if (softness !== next.softness) {
      next.softness = softness;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'intensity')) {
    const intensity = clampNumber(patch.intensity, 0, 100, next.intensity);
    if (intensity !== next.intensity) {
      next.intensity = intensity;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'colorCount')) {
    const colorCount = clampNumber(patch.colorCount, 2, 7, next.colorCount);
    if (colorCount !== next.colorCount) {
      next.colorCount = colorCount;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'offsetX')) {
    const offsetX = clampNumber(patch.offsetX, -100, 100, next.offsetX);
    if (offsetX !== next.offsetX) {
      next.offsetX = offsetX;
      uniformsChanged = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'offsetY')) {
    const offsetY = clampNumber(patch.offsetY, -100, 100, next.offsetY);
    if (offsetY !== next.offsetY) {
      next.offsetY = offsetY;
      uniformsChanged = true;
    }
  }
  const mode = patch.mode === 'dark' ? 'dark' : patch.mode === 'light' ? 'light' : '';
  if (mode) {
    if (Object.prototype.hasOwnProperty.call(patch, 'colorBack')) {
      const colorBack = validHex(patch.colorBack, next[mode].colorBack);
      if (colorBack !== next[mode].colorBack) {
        next[mode].colorBack = colorBack;
        uniformsChanged = true;
      }
    }
    if (Array.isArray(patch.colors)) {
      const source = patch.colors.slice(0, 7);
      const colors = [];
      for (let i = 0; i < 7; i++) {
        colors.push(validHex(source[i], next[mode].colors[i]));
      }
      if (colors.some((color, index) => color !== next[mode].colors[index])) {
        next[mode].colors = colors;
        uniformsChanged = true;
      }
    }
  }

  grainSettings = next;
  saveSettings();
  if (uniformsChanged) syncPalette();
  if (speedChanged) syncActiveSpeeds();
  notifySettings();
  return copySettings(grainSettings);
}

function resetSettings() {
  grainSettings = copySettings(DEFAULT_SETTINGS);
  try {
    localStorage.removeItem(GRAIN_SETTINGS_KEY);
  } catch (_) {}
  syncPalette();
  syncActiveSpeeds();
  notifySettings();
  return copySettings(grainSettings);
}

window.OobeGrain = {
  setActive: (active) => setTargetActive('oobe', active),
  setPreviewActive: (active) => setTargetActive('preview', active),
  /** 关闭动画前停帧，方便 toDataURL 定格 */
  _pause: () => {
    Object.values(TARGETS).forEach((target) => {
      try {
        target.mount?.setSpeed?.(0);
      } catch (_) {}
    });
  },
  syncPalette
};
window.GrainBackground = {
  setActive: (active) => setTargetActive('page', active),
  syncPalette,
  getSettings: () => copySettings(grainSettings),
  getShapes: () => GRAIN_SHAPE_IDS.slice(),
  updateSettings,
  resetSettings
};

const rootObserver = new MutationObserver((records) => {
  let modeChanged = false;
  let perfChanged = false;
  for (const record of records) {
    if (record.attributeName === 'data-mode') modeChanged = true;
    if (record.attributeName === 'data-perf') perfChanged = true;
  }
  if (modeChanged) {
    syncPalette();
    notifySettings();
  }
  if (perfChanged) syncActiveSpeeds();
});
rootObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-mode', 'data-perf']
});

// Covers cases where UI state was applied before this deferred module loaded.
const oobeRoot = document.getElementById('oobe');
if (
  oobeRoot?.classList.contains('is-visible') &&
  oobeRoot.classList.contains('is-welcome-step')
) {
  setTargetActive('oobe', true);
}
const grainSelected =
  document.documentElement.classList.contains('boot-has-grain') ||
  document.body?.classList.contains('has-grain-bg') ||
  (() => {
    try {
      return localStorage.getItem('moonfog_bg_mode') === 'grain';
    } catch (_) {
      return false;
    }
  })();
setTargetActive(
  'page',
  grainSelected && !document.documentElement.classList.contains('boot-oobe-pending')
);

const previewFrame = document.querySelector('.oobe-media-frame');
if (previewFrame?.classList.contains('is-grain-preview')) {
  setTargetActive('preview', true);
}
syncPalette();
