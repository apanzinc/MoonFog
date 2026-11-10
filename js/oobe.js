/** 首次引导：草稿与主页隔离，完成时一次保存，不在卸载事件中回滚设置。 */
(function () {
  'use strict';

  const DONE_KEY = 'moonfog_oobe_done';
  const STEPS = [
    ['欢迎', '让每次打开，都刚刚好', '用三个小选择，布置属于你的新标签页。'],
    ['背景', '从喜欢的背景开始', '选择安静的纯色，或让风景和流光陪伴你。'],
    ['明暗', '找到舒服的光线', '跟随系统，或固定为你喜欢的明暗。'],
    ['问候', '给新的一页，一句开场白', '显示名字、时间，或一句想对自己说的话。']
  ];
  const BACKGROUNDS = [
    ['solid', '纯色', '简洁，轻量', 'mgc_palette_line'],
    ['grain', '流光渐变', '柔和的动态色彩', 'mgc_sparkles_line'],
    ['bing', '必应每日', '每天一张风景，需联网', 'mgc_sun_line'],
    ['local', '本地图片', '使用自己的照片', 'mgc_pic_2_line']
  ];
  const MODES = [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色'], ['wallpaper', '跟随壁纸']];
  const GREETINGS = [['greeting', '问候语'], ['clock', '当前时间'], ['date', '今日日期'], ['quote', '每日一言'], ['custom', '自定义']];
  const TONES = [
    ['sand', '暖沙', '#F5F0E8', '#1E1C18'], ['cream', '奶油', '#FDF6EC', '#1E1A14'],
    ['rose', '玫瑰', '#F8EDE8', '#1E1818'], ['sage', '青苔', '#ECEEE5', '#181C16'],
    ['sky', '晴空', '#E8F0F5', '#161B20'], ['lavender', '薄紫', '#EDE8F0', '#1A1620'],
    ['slate', '素墨', '#E8E9EC', '#1A1B1E']
  ];
  const $ = id => document.getElementById(id);
  const read = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch (_) { return fallback; } };
  const valid = (value, choices) => choices.some(choice => choice[0] === value);
  let draft;
  let step = 0;
  let session = 0;
  let fileToken = 0;
  let loading = false;
  let saving = false;
  let stageAnimation;
  let opener;

  function isOobeActive() { return !!$('oobe')?.open; }
  function isOobeDone() { return read(DONE_KEY) === '1'; }
  function reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      ['low', 'balanced'].includes(document.documentElement.dataset.perf);
  }
  function setStatus(text) {
    $('oobeStatus').textContent = text;
    $('oobeStatus').hidden = !text;
  }
  function choiceGroup(name, label, choices, selected) {
    const field = document.createElement('fieldset');
    field.className = 'oobe-choices';
    const legend = document.createElement('legend');
    legend.textContent = label;
    field.append(legend);
    for (const [value, title, tip, icon] of choices) {
      const item = document.createElement('label');
      item.className = 'oobe-choice';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = name; input.value = value; input.checked = value === selected;
      const copy = document.createElement('span');
      copy.className = 'oobe-choice-copy';
      const text = document.createElement('strong'); text.textContent = title;
      copy.append(text);
      if (tip) { const sub = document.createElement('small'); sub.textContent = tip; copy.append(sub); }
      if (icon) { const glyph = document.createElement('span'); glyph.className = 'oobe-choice-icon ' + icon; glyph.setAttribute('aria-hidden', 'true'); item.append(glyph); }
      item.append(input, copy); field.append(item);
    }
    return field;
  }
  function syncButtons() {
    $('oobeFields').querySelectorAll('input').forEach(input => { input.disabled = saving; });
    $('oobeBackBtn').hidden = step === 0;
    $('oobeBackBtn').disabled = saving;
    $('oobeNextBtn').textContent = saving ? '正在保存…' : step === 0 ? '开始设置' : step === STEPS.length - 1 ? '开始使用' : '下一步';
    $('oobeNextBtn').disabled = saving || (step === 1 && (loading || (draft.bgMode === 'local' && !draft.localUrl)));
    $('oobeSkipBtn').disabled = saving;
  }
  function syncFields() {
    const local = $('oobeLocalField');
    if (local) local.hidden = draft.bgMode !== 'local';
    const tones = $('oobeToneField');
    if (tones) tones.hidden = draft.bgMode !== 'solid';
    const name = $('oobeNameField');
    if (name) name.hidden = draft.greeting !== 'greeting';
    const custom = $('oobeCustomField');
    if (custom) custom.hidden = draft.greeting !== 'custom';
    syncButtons();
  }
  function preview() {
    const mode = draft.mode;
    const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const tone = TONES.find(t => t[0] === draft.tone) || TONES[0];
    const card = $('oobePreview');
    card.dataset.background = draft.bgMode;
    card.dataset.mode = dark ? 'dark' : 'light';
    card.style.setProperty('--preview-bg', tone[dark ? 3 : 2]);
    const url = draft.bgMode === 'local' ? draft.localUrl : draft.bgMode === 'bing' ? draft.bingUrl : '';
    $('oobePreviewImage').hidden = !url;
    if (url && $('oobePreviewImage').getAttribute('src') !== url) $('oobePreviewImage').src = url;
    else if (!url) $('oobePreviewImage').removeAttribute('src');
    const now = new Date();
    const name = draft.name.trim() || '朋友';
    let text = typeof getTimeGreeting === 'function' ? getTimeGreeting(name, now.getHours()) : '你好，' + name;
    if (draft.greeting === 'clock') text = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (draft.greeting === 'date') text = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    if (draft.greeting === 'quote') text = '慢慢来，比较快';
    if (draft.greeting === 'custom') text = draft.custom.trim() || '写下一句想对自己说的话';
    $('oobePreviewGreeting').textContent = text;
    $('oobePreviewNote').textContent = mode === 'wallpaper' ? '示意预览 · 完成后根据壁纸自动取色' : '示意预览 · 完成后应用到主页';
  }
  function render(focus = true) {
    stageAnimation?.cancel();
    const stage = $('oobeStage');
    const body = $('oobeFields');
    body.replaceChildren();
    $('oobeKicker').textContent = step === 0 ? 'MoonFog 朔雾' : '为你定制 · ' + step + ' / 3';
    $('oobeTitle').textContent = STEPS[step][1];
    $('oobeDesc').textContent = STEPS[step][2];
    $('oobeProgress').replaceChildren(...STEPS.map(([label], index) => {
      const item = document.createElement('li'); item.textContent = label;
      if (index === step) item.setAttribute('aria-current', 'step');
      if (index < step) item.classList.add('is-done');
      return item;
    }));
    if (step === 0) {
      body.innerHTML = '<p class="oobe-welcome-note">背景、明暗、问候，按自己的节奏选择。<br>其余选项都在主页右下角的设置里。</p><p class="oobe-privacy">偏好只保存在本机，无需账号。</p>';
    } else if (step === 1) {
      body.append(choiceGroup('oobeBackground', '主页背景', BACKGROUNDS, draft.bgMode));
      const tones = document.createElement('div'); tones.id = 'oobeToneField';
      tones.append(choiceGroup('oobeTone', '纯色色调', TONES.map(([id, label]) => [id, label]), draft.tone));
      body.append(tones);
      const local = document.createElement('div'); local.id = 'oobeLocalField'; local.className = 'oobe-input-field';
      local.innerHTML = '<label for="oobeLocalInput">选择图片</label><input id="oobeLocalInput" type="file" accept="image/*"><p class="oobe-help">支持本机图片，最大 25 MB。未完成前只在这里预览。</p>';
      body.append(local);
    } else if (step === 2) {
      const modes = MODES.filter(([id]) => id !== 'wallpaper' || ['local', 'bing'].includes(draft.bgMode));
      if (!valid(draft.mode, modes)) draft.mode = 'system';
      body.append(choiceGroup('oobeMode', '界面明暗', modes, draft.mode));
    } else {
      body.append(choiceGroup('oobeGreeting', '问候内容', GREETINGS, draft.greeting));
      const fields = document.createElement('div');
      fields.innerHTML = '<div class="oobe-input-field" id="oobeNameField"><label for="oobeNameInput">如何称呼你（选填）</label><input id="oobeNameInput" type="text" maxlength="20" autocomplete="nickname" placeholder="例如：小陈"></div><div class="oobe-input-field" id="oobeCustomField"><label for="oobeCustomInput">自定义欢迎语</label><input id="oobeCustomInput" type="text" maxlength="48" autocomplete="off" placeholder="写下一句想对自己说的话"></div>';
      body.append(fields);
      $('oobeNameInput').value = draft.name;
      $('oobeCustomInput').value = draft.custom;
    }
    setStatus(''); syncFields(); preview();
    $('oobeScroll').scrollTop = 0;
    if (!reduced()) stageAnimation = stage.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    if (focus) $('oobeTitle').focus({ preventScroll: true });
  }

  async function loadLocal(file) {
    if (!file) return; // 取消文件选择保留先前的有效图片。
    const token = ++fileToken;
    const currentSession = session;
    loading = true; setStatus('正在读取图片…'); syncButtons();
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('图片超过 25 MB，请选择较小的图片。');
      if (file.type && !file.type.startsWith('image/')) throw new Error('请选择图片文件。');
      const url = await compressImageFile(file);
      if (token !== fileToken || currentSession !== session || !isOobeActive()) return;
      draft.localUrl = url; draft.localName = file.name;
      setStatus('已选择：' + file.name); preview();
    } catch (error) {
      if (token === fileToken && currentSession === session) setStatus(error.message || '图片读取失败，请重试。');
    } finally {
      if (token === fileToken && currentSession === session) { loading = false; syncButtons(); }
    }
  }
  async function loadBing() {
    if (draft.bingUrl) return;
    const currentSession = session;
    setStatus('正在加载每日一图…');
    try {
      const meta = await fetchBingDailyMeta();
      if (currentSession !== session || !isOobeActive()) return;
      draft.bingUrl = meta?.images?.[0]?.url || '';
      if (draft.bgMode === 'bing') { preview(); setStatus(draft.bingUrl ? '每日一图将在主页自动更新。' : '暂时无法加载，联网后会自动重试。'); }
    } catch (_) {
      if (currentSession === session && draft.bgMode === 'bing' && isOobeActive()) setStatus('暂时无法加载，联网后会自动重试。也可以选择其他背景。');
    }
  }

  async function save() {
    const wp = window.MoonFogWp;
    await wp.library.init();
    const keys = ['moonfog_tone', 'moonfog_mode', 'moonfog_mode_pref', 'moonfog_username', 'moonfog_greeting_mode', 'moonfog_custom_text', 'moonfog_bg_mode', 'moonfog_wallpaper_items', 'moonfog_wallpaper_sources', 'moonfog_wallpaper_spec', DONE_KEY];
    const before = new Map(keys.map(key => [key, localStorage.getItem(key)]));
    let added;
    try {
      localStorage.setItem('moonfog_tone', draft.tone);
      localStorage.setItem('moonfog_mode_pref', draft.mode);
      localStorage.setItem('moonfog_username', draft.name.trim());
      localStorage.setItem('moonfog_greeting_mode', draft.greeting);
      localStorage.setItem('moonfog_custom_text', draft.custom.trim());
      if (draft.backgroundChanged) {
        let strategy = { kind: 'fixed', itemId: null };
        if (draft.bgMode === 'local') {
          added = await wp.library.addPreparedImage(draft.localUrl, draft.localName || '本地图片');
          strategy.itemId = added.id;
        } else if (draft.bgMode === 'grain') {
          const item = wp.library.listItems('effect').find(item => item.effect === 'grain') || wp.library.addEffect('流光渐变', 'grain', {});
          if (!wp.library.getItem(item.id)) throw new Error('背景未能保存');
          strategy.itemId = item.id;
        } else if (draft.bgMode === 'bing') {
          const source = wp.library.listSources().find(source => source.kind === 'bing');
          strategy = { kind: 'source', sourceId: source.id };
        }
        localStorage.setItem('moonfog_bg_mode', draft.bgMode);
        wp.spec.setStrategy(strategy);
        const stored = JSON.parse(localStorage.getItem('moonfog_wallpaper_spec'))?.strategy;
        if (stored?.kind !== strategy.kind || (stored.itemId || null) !== (strategy.itemId || null) || (stored.sourceId || null) !== (strategy.sourceId || null)) throw new Error('背景设置未能保存');
      }
      localStorage.setItem(DONE_KEY, '1');
    } catch (error) {
      if (added) await wp.library.removeItem(added.id);
      for (const [key, value] of before) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (_) {} }
      wp.engine.render();
      throw error;
    }
    applyTheme(draft.tone, draft.mode, { persist: false, animate: false });
    currentUsername = draft.name.trim() || DEFAULT_USERNAME;
    currentCustomText = draft.custom.trim();
    applyGreetingMode(draft.greeting, false);
    if (draft.greeting === 'quote') prefetchDailyQuoteOnLoad();
    updateGreetingDisplay();
    if (draft.backgroundChanged) wp.engine.render();
  }
  async function finish(commit) {
    if (saving) return;
    saving = true; syncButtons();
    try {
      if (commit) await save();
      else { try { localStorage.setItem(DONE_KEY, '1'); } catch (_) {} }
    } catch (_) {
      saving = false; syncButtons(); setStatus('无法保存设置，请检查本机存储空间后重试，或选择「暂不设置」。');
      return;
    }
    session++; fileToken++;
    const root = $('oobe');
    if (!reduced()) { try { await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).finished; } catch (_) {} }
    root.close(); root.hidden = true;
    document.body.classList.remove('oobe-active');
    document.documentElement.classList.remove('boot-oobe-pending');
    // 引导期间主页流光为节省资源保持停用；退出后恢复，不只更新策略值。
    if (typeof currentBgMode === 'string' && currentBgMode === 'grain') setGrainBackgroundActive(true);
    startBootEnter();
    // 桌面保留搜索快捷输入；手机不因引导完成自动弹出键盘。
    if (!window.matchMedia('(hover: none)').matches) (opener?.isConnected ? opener : $('searchInput'))?.focus({ preventScroll: true });
    saving = false;
  }
  function next() {
    if (saving || $('oobeNextBtn').disabled) return;
    if (step === STEPS.length - 1) {
      if (draft.greeting === 'custom' && !draft.custom.trim()) { setStatus('请写一句欢迎语，或选择其他问候内容。'); $('oobeCustomInput').focus(); return; }
      finish(true);
    } else { step++; render(); }
  }
  function openOobe() {
    const root = $('oobe');
    if (!root || isOobeActive()) return !!root;
    const background = read('moonfog_bg_mode', 'solid');
    const mode = read('moonfog_mode_pref', 'system');
    const greeting = read('moonfog_greeting_mode', 'greeting');
    draft = {
      bgMode: valid(background, BACKGROUNDS) ? background : 'solid', backgroundChanged: false,
      mode: valid(mode, MODES) ? mode : 'system', tone: valid(read('moonfog_tone'), TONES) ? read('moonfog_tone') : 'sand',
      greeting: valid(greeting, GREETINGS) ? greeting : 'greeting', name: read('moonfog_username'), custom: read('moonfog_custom_text'),
      localUrl: read('moonfog_bg_local'), localName: '', bingUrl: ''
    };
    step = 0; session++; loading = saving = false;
    opener = document.activeElement;
    if (opener === document.body || opener === document.documentElement || opener?.id === 'searchInput') opener = null;
    document.body.classList.add('oobe-active');
    document.documentElement.classList.add('boot-oobe-pending');
    root.hidden = false; root.showModal(); render(false);
    $('oobeNextBtn').focus({ preventScroll: true });
    return true;
  }
  const root = $('oobe');
  root?.addEventListener('click', event => {
    if (event.target.closest('#oobeNextBtn')) next();
    if (event.target.closest('#oobeBackBtn') && !saving && step > 0) { step--; render(); }
    if (event.target.closest('#oobeSkipBtn')) finish(false);
  });
  root?.addEventListener('cancel', event => { event.preventDefault(); if (!saving && step > 0) { step--; render(); } });
  root?.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(root.querySelectorAll('button:not(:disabled), input:not(:disabled)'))
      .filter(el => el.getClientRects().length && (el.type !== 'radio' || el.checked));
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('oobeTitle'))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  root?.addEventListener('change', event => {
    const { name, value, files } = event.target;
    if (saving) return;
    setStatus('');
    if (name === 'oobeBackground') {
      draft.bgMode = value; draft.backgroundChanged = true;
      if (value === 'bing') loadBing();
    }
    if (name === 'oobeTone') draft.tone = value;
    if (name === 'oobeMode') draft.mode = value;
    if (name === 'oobeGreeting') draft.greeting = value;
    if (event.target.id === 'oobeLocalInput') loadLocal(files[0]);
    syncFields(); preview();
  });
  root?.addEventListener('input', event => {
    if (saving) return;
    if (event.target.id === 'oobeNameInput') draft.name = event.target.value;
    if (event.target.id === 'oobeCustomInput') draft.custom = event.target.value;
    preview();
  });
  $('oobePreviewImage')?.addEventListener('error', () => {
    $('oobePreviewImage').hidden = true;
    if (isOobeActive() && draft.bgMode === 'bing') setStatus('图片暂时无法显示，联网后主页会自动重试。');
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (isOobeActive()) preview(); });
  window.isOobeActive = isOobeActive;
  window.isOobeDone = isOobeDone;
  window.openOobe = openOobe;
  window.maybeShowOobe = () => isOobeDone() ? false : openOobe();
})();
