/**
 * MoonFog - Wallpaper Settings UI
 * 背景库 + 源 + 打开策略 + 全局开关
 */
(function () {
  'use strict';

  const WP = (window.MoonFogWp = window.MoonFogWp || {});

  const KIND_LABEL = { image: '图片', video: '视频', effect: '动效', solid: '纯色' };
  const SOURCE_LABEL = { bing: '必应每日', wdd: '.wdd 时间表', api: '第三方 API', scheme: '用户方案' };

  let bound = false;
  let addMode = 'image';
  let sourceMode = 'bing';
  let itemMenu = null;
  let gridSig = '';

  /** 显示已选壁纸与仍在展示的背景，并为同一策略提供重试入口。 */
  function renderLoadError() {
    const panel = $('wpLoadError');
    if (!panel) return;
    const error = WP.engine?.getError();
    panel.hidden = !error;
    if (error) $('wpLoadErrorText').textContent = '「' + error.itemName + '」加载失败，仍显示「' + error.currentName + '」。请检查文件或网络后重试，也可以选择其他背景。';
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setReveal(el, show) {
    if (!el) return;
    if (typeof window.setSettingsReveal === 'function') window.setSettingsReveal(el, !!show);
    else el.hidden = !show;
  }

  function openModal(el) {
    if (!el) return;
    if (typeof window.openModal === 'function') window.openModal(el, null);
    else {
      el.classList.add('active');
      el.setAttribute('aria-hidden', 'false');
      el.removeAttribute('inert');
    }
  }

  function closeModal(el) {
    if (!el) return;
    if (typeof window.closeModal === 'function') window.closeModal(el, null);
    else {
      el.classList.remove('active');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
    }
  }

  // ==================== 背景库 ====================

  function getActiveItemId() {
    if (!WP.spec) return null;
    const spec = WP.spec.get();
    const strategy = spec && spec.strategy;
    return strategy && strategy.kind === 'fixed' ? strategy.itemId : null;
  }

  function buildItemCard(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const active = item.id === getActiveItemId();
    btn.className = 'wallpaper-item' + (active ? ' is-active' : '');
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', item.name || KIND_LABEL[item.kind] || '背景');
    if (active) btn.setAttribute('aria-pressed', 'true');

    const cover = document.createElement('span');
    cover.className = 'wallpaper-item-cover';
    if (item.kind === 'solid' && item.color) {
      cover.style.backgroundColor = item.color;
    }
    btn.appendChild(cover);

    const empty = document.createElement('span');
    empty.className = 'wallpaper-item-empty';
    const iconMap = {
      image: 'mgc_pic_2_line',
      video: 'mgc_video_fill',
      effect: 'mgc_sparkles_fill',
      solid: 'mgc_palette_fill'
    };
    empty.innerHTML = '<span class="' + (iconMap[item.kind] || 'mgc_pic_2_line') + '" aria-hidden="true"></span>';
    btn.appendChild(empty);

    const caption = document.createElement('span');
    caption.className = 'wallpaper-item-caption';
    const name = document.createElement('span');
    name.className = 'wallpaper-item-name';
    name.textContent = item.name || KIND_LABEL[item.kind] || '背景';
    const badge = document.createElement('span');
    badge.className = 'wallpaper-item-badge';
    badge.textContent = KIND_LABEL[item.kind] || '';
    caption.appendChild(name);
    caption.appendChild(badge);
    btn.appendChild(caption);

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'wallpaper-item-more';
    more.dataset.id = item.id;
    more.setAttribute('aria-label', '更多操作');
    more.innerHTML = '<span class="mgc_more_2_fill" aria-hidden="true"></span>';
    btn.appendChild(more);

    if (active) {
      const check = document.createElement('span');
      check.className = 'wallpaper-item-check';
      check.innerHTML = '<span class="mgc_check_line" aria-hidden="true"></span>';
      btn.appendChild(check);
    }

    return btn;
  }

  async function renderLibrary() {
    const grid = $('wpLibraryGrid');
    const empty = $('wpLibraryEmpty');
    if (!grid || !WP.library) return;
    const items = WP.library.listItems();
    const strategy = WP.spec ? WP.spec.get().strategy : null;
    const strategySig = strategy
      ? strategy.kind + ':' + (strategy.itemId || '') + ':' + (strategy.sourceId || '') + ':' +
        (Array.isArray(strategy.itemIds) ? strategy.itemIds.join('+') : '')
      : '';
    const sig = items.map((item) => item.id + ':' + item.name + ':' + (item.color || '')).join(',') + '|' + strategySig;
    if (sig === gridSig) return;
    gridSig = sig;

    grid.replaceChildren();
    if (empty) empty.hidden = items.length > 0;
    grid.hidden = items.length === 0;
    if (!items.length) return;

    const frag = document.createDocumentFragment();
    items.forEach((item) => frag.appendChild(buildItemCard(item)));
    grid.appendChild(frag);

    // 异步加载图片缩略
    const nodes = Array.from(grid.querySelectorAll('.wallpaper-item[data-id]'));
    await Promise.all(nodes.map(async (node) => {
      const item = WP.library.getItem(node.dataset.id);
      if (!item || (item.kind !== 'image' && item.kind !== 'video')) return;
      const url = await WP.library.resolveItemUrl(item);
      if (!url) return;
      const coverEl = node.querySelector('.wallpaper-item-cover');
      if (coverEl && item.kind === 'image') coverEl.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      const emptyEl = node.querySelector('.wallpaper-item-empty');
      if (emptyEl) emptyEl.style.display = 'none';
    }));
  }

  // ==================== 源 ====================

  function renderSources() {
    const list = $('wpSourceList');
    if (!list || !WP.library) return;
    const sources = WP.library.listSources();
    list.replaceChildren();
    if (!sources.length) {
      const tip = document.createElement('p');
      tip.className = 'setting-tip';
      tip.textContent = '还没有源，点击「添加源」';
      list.appendChild(tip);
      return;
    }
    sources.forEach((source) => {
      const row = document.createElement('div');
      row.className = 'wallpaper-source-row';
      row.dataset.id = source.id;

      const info = document.createElement('div');
      info.className = 'wallpaper-source-info';
      const name = document.createElement('span');
      name.className = 'wallpaper-source-name';
      name.textContent = source.name || SOURCE_LABEL[source.kind] || '源';
      const kind = document.createElement('span');
      kind.className = 'wallpaper-source-kind';
      const kindLabel = SOURCE_LABEL[source.kind] || source.kind;
      info.appendChild(name);
      if (kindLabel && kindLabel !== name.textContent) {
        kind.textContent = kindLabel;
        info.appendChild(kind);
      }

      const actions = document.createElement('div');
      actions.className = 'wallpaper-source-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'bg-action-btn bg-action-btn-ghost';
      del.textContent = '删除';
      del.addEventListener('click', () => {
        if (!window.confirm('删除源「' + (source.name || '') + '」？')) return;
        WP.library.removeSource(source.id);
        renderSources();
        renderStrategy();
      });
      actions.appendChild(del);

      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  // ==================== 页内分栏 ====================

  function setTab(name) {
    const nav = $('wpSubnav');
    if (!nav) return;

    const buttons = Array.from(nav.querySelectorAll('[data-wp-tab]'));
    buttons.forEach((btn) => {
      const on = btn.dataset.wpTab === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });

    document.querySelectorAll('[data-wp-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.wpPanel !== name;
    });
    // 流光/色调参数只在背景库分栏显示
    ['bgGrainGroup', 'toneGroup'].forEach((id) => {
      const el = $(id);
      if (el) el.classList.toggle('wp-hidden-tab', name !== 'library');
    });

    const activeBtn = nav.querySelector('[data-wp-tab].is-active');

    // tab 条可以横向滑动，选中项（伸长后）滚回视野中间
    if (activeBtn) {
      window.setTimeout(() => {
        const max = nav.scrollWidth - nav.clientWidth;
        if (max <= 0) return;
        const navRect = nav.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const center = nav.scrollLeft + (btnRect.left - navRect.left) - (navRect.width - btnRect.width) / 2;
        const left = Math.max(0, Math.min(max, center));
        if (Math.abs(left - nav.scrollLeft) > 2) {
          nav.scrollTo({ left: left, behavior: 'smooth' });
        }
      }, 300);
    }
  }

  function bindSubnav() {
    const nav = $('wpSubnav');
    if (!nav || nav.dataset.wpBound === '1') return;
    nav.dataset.wpBound = '1';

    nav.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-wp-tab]');
      if (!btn || btn.classList.contains('is-active')) return;
      setTab(btn.dataset.wpTab);
    });

    // 方向键 / Home / End：tablist 的键盘惯例，焦点跟着选中项走
    nav.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(nav.querySelectorAll('[data-wp-tab]'));
      if (!buttons.length) return;
      event.preventDefault();
      const idx = buttons.findIndex((b) => b.classList.contains('is-active'));
      let next = idx;
      if (event.key === 'ArrowLeft') next = (idx - 1 + buttons.length) % buttons.length;
      else if (event.key === 'ArrowRight') next = (idx + 1) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else next = buttons.length - 1;
      const target = buttons[next];
      if (!target) return;
      setTab(target.dataset.wpTab);
      target.focus();
    });
  }

  // ==================== 打开策略 ====================

  function pickerLabel(item) {
    return item.name || KIND_LABEL[item.kind] || SOURCE_LABEL[item.kind] || '条目';
  }

  function buildPicker(container, items, isActive, onPick, emptyText) {
    if (!container) return;
    container.replaceChildren();
    if (!items.length) {
      const tip = document.createElement('p');
      tip.className = 'setting-tip';
      tip.textContent = emptyText || '还没有可选内容';
      container.appendChild(tip);
      return;
    }
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wallpaper-pick-btn' + (isActive(item) ? ' is-active' : '');
      btn.dataset.id = item.id;
      btn.textContent = pickerLabel(item);
      btn.addEventListener('click', () => onPick(item.id));
      container.appendChild(btn);
    });
  }

  function renderStrategy() {
    const seg = $('wpStrategySeg');
    const params = $('wpStrategyParams');
    const fixedField = $('wpStrategyFixedField');
    const rotateField = $('wpStrategyRotateField');
    const sourceField = $('wpStrategySourceField');
    if (!WP.spec || !WP.library) return;
    const strategy = WP.spec.get().strategy;
    const kind = strategy.kind;

    if (seg) {
      seg.querySelectorAll('[data-wp-strategy]').forEach((btn) => {
        const active = btn.dataset.wpStrategy === kind;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    if (params) params.hidden = false;
    if (fixedField) fixedField.hidden = kind !== 'fixed';
    if (rotateField) rotateField.hidden = kind !== 'rotate';
    if (sourceField) sourceField.hidden = kind !== 'source';

    if (kind === 'fixed') {
      const items = WP.library.listItems();
      buildPicker($('wpFixedPicker'), items, (item) => item.id === strategy.itemId, (id) => {
        WP.spec.setStrategy(Object.assign({}, strategy, { kind: 'fixed', itemId: id }));
        if (WP.engine) WP.engine.render();
        renderStrategy();
      }, '背景库还没有内容，先去「背景库」添加');
    } else if (kind === 'rotate') {
      const items = WP.library.listItems().filter((item) => item.kind === 'image' || item.kind === 'video');
      const selected = Array.isArray(strategy.itemIds) ? strategy.itemIds : [];
      buildPicker($('wpRotatePicker'), items, (item) => !selected.length || selected.indexOf(item.id) >= 0, (id) => {
        let base = selected.length ? selected.slice() : items.map((item) => item.id);
        const idx = base.indexOf(id);
        if (idx >= 0) {
          if (base.length <= 1) return;
          base.splice(idx, 1);
        } else {
          base.push(id);
        }
        WP.spec.setStrategy(Object.assign({}, strategy, { kind: 'rotate', itemIds: base }));
        if (WP.engine) WP.engine.render();
        renderStrategy();
      }, '背景库还没有图片或视频，先去「背景库」添加');
      const interval = $('wpRotateInterval');
      if (interval) {
        interval.value = String(strategy.intervalMin || 0);
        if (interval.dataset.wpBound !== '1') {
          interval.dataset.wpBound = '1';
          interval.addEventListener('change', () => {
            const current = WP.spec.get().strategy;
            WP.spec.setStrategy(Object.assign({}, current, { kind: 'rotate', intervalMin: Number(interval.value) || 0 }));
            if (WP.engine) WP.engine.render();
          });
        }
      }
    } else if (kind === 'source') {
      const sources = WP.library.listSources();
      buildPicker($('wpSourcePicker'), sources, (item) => item.id === strategy.sourceId, (id) => {
        WP.spec.setStrategy(Object.assign({}, strategy, { kind: 'source', sourceId: id }));
        if (WP.engine) WP.engine.render();
        renderStrategy();
      }, '还没有源，先去「源」添加');
    }
  }

  // ==================== 全局开关 ====================

  function renderGlobals() {
    if (!WP.spec) return;
    const globals = WP.spec.get().globals;

    const segMap = [
      { id: 'wpMuteSeg', attr: 'wp-mute', key: 'mute' },
      { id: 'wpPerfSeg', attr: 'wp-perf', key: 'performance' },
      { id: 'wpOnlineFailSeg', attr: 'wp-online-fail', key: 'onlineFailure' }
    ];
    segMap.forEach(({ id, attr, key }) => {
      const seg = $(id);
      if (!seg) return;
      seg.querySelectorAll('[data-' + attr + ']').forEach((btn) => {
        // dataset key conversion: wp-mute -> wpMute
        const datasetKey = attr.split('-').map((s, i) => i === 0 ? s : s[0].toUpperCase() + s.slice(1)).join('');
        const val = btn.dataset[datasetKey];
        const act = val === globals[key];
        btn.classList.toggle('active', act);
        btn.setAttribute('aria-checked', act ? 'true' : 'false');
      });
    });
  }

  // ==================== 事件绑定 ====================

  function bindLibrary() {
    const grid = $('wpLibraryGrid');
    if (grid && grid.dataset.wpBound !== '1') {
      grid.dataset.wpBound = '1';
      grid.addEventListener('click', (event) => {
        const more = event.target.closest('.wallpaper-item-more');
        if (more) {
          event.stopPropagation();
          openItemMenu(more, more.dataset.id);
          return;
        }
        const item = event.target.closest('.wallpaper-item[data-id]');
        if (item) setFixed(item.dataset.id);
      });
    }
    const addBtn = $('wpAddBtn');
    if (addBtn && addBtn.dataset.wpBound !== '1') {
      addBtn.dataset.wpBound = '1';
      addBtn.addEventListener('click', () => openAddModal('image'));
    }
  }

  function setFixed(id) {
    if (!WP.spec) return;
    WP.spec.setStrategy({ kind: 'fixed', itemId: id });
    if (WP.engine) WP.engine.render();
    renderStrategy();
  }

  function bindSources() {
    const btn = $('wpAddSourceBtn');
    if (btn && btn.dataset.wpBound !== '1') {
      btn.dataset.wpBound = '1';
      btn.addEventListener('click', () => openSourceModal());
    }
  }

  function bindStrategy() {
    const seg = $('wpStrategySeg');
    if (seg && seg.dataset.wpBound !== '1') {
      seg.dataset.wpBound = '1';
      seg.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-wp-strategy]');
        if (!btn || !WP.spec) return;
        const kind = btn.dataset.wpStrategy;
        const current = WP.spec.get().strategy;
        const strategy = Object.assign({}, current, { kind });
        if (kind === 'source' && !strategy.sourceId) {
          const sources = WP.library.listSources();
          if (sources.length) strategy.sourceId = sources[0].id;
        }
        if (kind === 'rotate' && (!Array.isArray(strategy.itemIds) || !strategy.itemIds.length)) {
          strategy.itemIds = WP.library.listItems()
            .filter((item) => item.kind === 'image' || item.kind === 'video')
            .map((item) => item.id);
        }
        WP.spec.setStrategy(strategy);
        if (WP.engine) WP.engine.render();
        renderStrategy();
      });
    }
  }

  function bindGlobals() {
    const segMap = [
      { id: 'wpMuteSeg', attr: 'wp-mute', key: 'mute' },
      { id: 'wpPerfSeg', attr: 'wp-perf', key: 'performance' },
      { id: 'wpOnlineFailSeg', attr: 'wp-online-fail', key: 'onlineFailure' }
    ];
    segMap.forEach(({ id, attr, key }) => {
      const seg = $(id);
      if (!seg || seg.dataset.wpBound === '1') return;
      seg.dataset.wpBound = '1';
      seg.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-' + attr + ']');
        if (!btn || !WP.spec) return;
        const datasetKey = attr.split('-').map((s, i) => i === 0 ? s : s[0].toUpperCase() + s.slice(1)).join('');
        const value = btn.dataset[datasetKey];
        const current = WP.spec.get();
        const globals = Object.assign({}, current.globals);
        globals[key] = value;
        WP.spec.setGlobals(globals);
        if (WP.engine) WP.engine.render();
        renderGlobals();
      });
    });

    const clearBtn = $('wpClearCacheBtn');
    if (clearBtn && clearBtn.dataset.wpBound !== '1') {
      clearBtn.dataset.wpBound = '1';
      clearBtn.addEventListener('click', () => {
        try { localStorage.removeItem('moonfog_wp_source_cache'); } catch (_) {}
        clearBtn.textContent = '已清理';
        setTimeout(() => { clearBtn.textContent = '清理源缓存'; }, 1500);
      });
    }
  }

  // ==================== 条目菜单 ====================

  function closeItemMenu() {
    if (!itemMenu) return;
    itemMenu.remove();
    itemMenu = null;
  }

  function openItemMenu(anchor, id) {
    closeItemMenu();
    const item = WP.library && WP.library.getItem(id);
    if (!item) return;

    const menu = document.createElement('div');
    menu.className = 'wallpaper-item-menu';
    menu.setAttribute('role', 'menu');

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.textContent = '重命名';
    renameBtn.addEventListener('click', () => {
      closeItemMenu();
      const next = window.prompt('重命名', item.name || '背景');
      if (next === null) return;
      WP.library.renameItem(id, next);
      gridSig = '';
      refresh();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'is-danger';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', async () => {
      closeItemMenu();
      if (!window.confirm('删除「' + (item.name || '') + '」？')) return;
      await WP.library.removeItem(id);
      const spec = WP.spec && WP.spec.get();
      if (spec.strategy.kind === 'fixed' && spec.strategy.itemId === id) {
        WP.spec.setStrategy({ kind: 'fixed', itemId: null });
      }
      gridSig = '';
      refresh();
    });

    menu.appendChild(renameBtn);
    menu.appendChild(deleteBtn);
    document.body.appendChild(menu);
    itemMenu = menu;

    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth || 104;
    menu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8)) + 'px';
    menu.style.left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)) + 'px';

    const outside = (event) => {
      if (!menu.contains(event.target)) {
        closeItemMenu();
        document.removeEventListener('click', outside, true);
      }
    };
    setTimeout(() => document.addEventListener('click', outside, true), 0);
  }

  // ==================== 添加背景弹层 ====================

  function openAddModal(mode) {
    addMode = mode || 'image';
    const modal = $('wpAddModal');
    if (!modal) return;
    syncAddModal();
    openModal(modal);
  }

  function closeAddModal() {
    closeModal($('wpAddModal'));
  }

  function setAddError(message) {
    const error = $('wpAddError');
    if (!error) return;
    error.textContent = message || '';
    error.classList.toggle('is-visible', !!message);
  }

  function syncAddModal() {
    const options = $('wpAddOptions');
    if (options) {
      options.querySelectorAll('[data-wp-add]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.wpAdd === addMode);
      });
    }
    const isMedia = addMode === 'image' || addMode === 'video';
    const fileField = $('wpFileField');
    const urlField = $('wpUrlField');
    const colorField = $('wpColorField');
    const effectField = $('wpEffectField');
    const tip = $('wpAddTip');
    const confirmBtn = $('wpAddConfirm');
    const fileInput = $('wpFileInput');
    const urlInput = $('wpUrlInput');
    if (fileField) fileField.hidden = !isMedia;
    if (urlField) urlField.hidden = !isMedia;
    if (colorField) colorField.hidden = addMode !== 'solid';
    if (effectField) effectField.hidden = addMode !== 'effect';
    if (fileInput) fileInput.accept = addMode === 'video' ? 'video/*' : 'image/*';
    if (urlInput) {
      urlInput.value = '';
      urlInput.placeholder = addMode === 'video' ? 'https://…（视频直链，可留空）' : 'https://…（图片直链，可留空）';
    }
    if (confirmBtn) confirmBtn.textContent = '添加';
    if (tip) {
      tip.textContent = isMedia
        ? (addMode === 'video'
          ? '选择本地视频或填写直链；视频上限 120MB，只保存在本机'
          : '选择本地图片或填写直链；本地图片会自动压缩，只保存在本机')
        : addMode === 'effect'
          ? '动效由页面统一驱动'
          : '单一颜色背景';
    }
    setAddError('');
  }

  async function confirmAdd() {
    try {
      setAddError('');
      if (addMode === 'image' || addMode === 'video') {
        const input = $('wpUrlInput');
        const url = input ? input.value.trim() : '';
        if (!url) {
          const fileInput = $('wpFileInput');
          if (fileInput) fileInput.click();
          return;
        }
        const item = addMode === 'video'
          ? await WP.library.addVideoUrl(url)
          : await WP.library.addImageUrl(url);
        closeAddModal();
        setFixed(item.id);
        return;
      }
      if (addMode === 'solid') {
        const input = $('wpColorInput');
        const color = input ? input.value : '#F5F0E8';
        const item = WP.library.addSolid('纯色', color);
        closeAddModal();
        setFixed(item.id);
        return;
      }
      if (addMode === 'effect') {
        const select = $('wpEffectSelect');
        const effect = select ? select.value : 'grain';
        const item = WP.library.addEffect('流光渐变', effect, {});
        closeAddModal();
        setFixed(item.id);
        return;
      }
    } catch (err) {
      setAddError(err && err.message ? err.message : '添加失败');
    }
  }

  function bindAddModal() {
    const modal = $('wpAddModal');
    if (!modal || modal.dataset.wpBound === '1') return;
    modal.dataset.wpBound = '1';

    const options = $('wpAddOptions');
    if (options) {
      options.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-wp-add]');
        if (!btn) return;
        addMode = btn.dataset.wpAdd;
        syncAddModal();
      });
    }

    const closeBtn = $('wpAddClose');
    const cancelBtn = $('wpAddCancel');
    const confirmBtn = $('wpAddConfirm');
    if (closeBtn) closeBtn.addEventListener('click', closeAddModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmAdd);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAddModal();
    });

    const fileInput = $('wpFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const files = fileInput.files;
        if (!files || !files.length) return;
        try {
          setAddError('');
          const added = await WP.library.addMediaFiles(files);
          fileInput.value = '';
          closeAddModal();
          if (added && added.length) setFixed(added[0].id);
        } catch (err) {
          fileInput.value = '';
          setAddError(err && err.message ? err.message : '添加失败');
        }
      });
    }
  }

  // ==================== 添加源弹层 ====================

  function openSourceModal() {
    sourceMode = 'bing';
    const modal = $('wpSourceModal');
    if (!modal) return;
    syncSourceModal();
    openModal(modal);
  }

  function closeSourceModal() {
    closeModal($('wpSourceModal'));
  }

  function setSourceError(message) {
    const error = $('wpSourceError');
    if (!error) return;
    error.textContent = message || '';
    error.classList.toggle('is-visible', !!message);
  }

  function syncSourceModal() {
    const options = $('wpSourceOptions');
    if (options) {
      options.querySelectorAll('[data-wp-source]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.wpSource === sourceMode);
      });
    }
    const apiField = $('wpSourceApiField');
    const tip = $('wpSourceTip');
    if (apiField) apiField.hidden = sourceMode !== 'api';
    if (tip) {
      tip.textContent = sourceMode === 'bing'
        ? '使用必应每日一图，可随时换一张'
        : sourceMode === 'wdd'
          ? '按当前时间返回对应时段的图片'
          : '从接口拉取，返回 JSON 且含 url 字段';
    }
    setSourceError('');
  }

  function confirmSource() {
    try {
      setSourceError('');
      const name = SOURCE_LABEL[sourceMode] || '源';
      const config = {};
      if (sourceMode === 'api') {
        const input = $('wpSourceApiUrl');
        const url = input ? input.value.trim() : '';
        if (!url) throw new Error('请输入 API 地址');
        config.url = url;
      }
      WP.library.addSource(sourceMode, name, config);
      closeSourceModal();
      renderSources();
      renderStrategy();
    } catch (err) {
      setSourceError(err && err.message ? err.message : '添加失败');
    }
  }

  function bindSourceModal() {
    const modal = $('wpSourceModal');
    if (!modal || modal.dataset.wpBound === '1') return;
    modal.dataset.wpBound = '1';

    const options = $('wpSourceOptions');
    if (options) {
      options.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-wp-source]');
        if (!btn) return;
        sourceMode = btn.dataset.wpSource;
        syncSourceModal();
      });
    }

    const closeBtn = $('wpSourceClose');
    const cancelBtn = $('wpSourceCancel');
    const confirmBtn = $('wpSourceConfirm');
    if (closeBtn) closeBtn.addEventListener('click', closeSourceModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSourceModal);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmSource);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeSourceModal();
    });
  }

  // ==================== 初始化 ====================

  function refresh() {
    renderLibrary();
    renderSources();
    renderStrategy();
    renderGlobals();
  }

  function init() {
    if (bound) {
      refresh();
      return;
    }
    bound = true;
    bindSubnav();
    setTab('library');
    bindLibrary();
    bindSources();
    bindStrategy();
    bindGlobals();
    bindAddModal();
    bindSourceModal();
    $('wpRetryBtn')?.addEventListener('click', () => WP.engine?.render());
    window.addEventListener('moonfog-wp-render-error', renderLoadError);
    renderLoadError();

    // 弹层内按 Escape 只关闭弹层，设置面板保持打开
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const addModal = $('wpAddModal');
      if (addModal && addModal.classList.contains('active')) {
        event.stopImmediatePropagation();
        closeAddModal();
        return;
      }
      const sourceModal = $('wpSourceModal');
      if (sourceModal && sourceModal.classList.contains('active')) {
        event.stopImmediatePropagation();
        closeSourceModal();
      }
    });

    if (WP.spec && typeof WP.spec.onChange === 'function') {
      WP.spec.onChange(() => refresh());
    }
    window.addEventListener('moonfog-wp-items-change', () => {
      gridSig = '';
      refresh();
    });
    window.addEventListener('moonfog-wp-sources-change', () => refresh());
    refresh();
  }

  WP.ui = { init, refresh };
})();
