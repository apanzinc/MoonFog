/**
 * MoonFog - 问候文案首屏生成（�?boot-config.js 提取�? * 依赖 boot-config.js 设置�?window.__MOONFOG_BOOT__ �?localStorage
 */
(function () {
  'use strict';

  function get(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  let boot = window.__MOONFOG_BOOT__ || {};
  let greetingMode = boot.greetingMode || 'greeting';

  let bootDateFmt = null;
  let bootClock24Fmt = null;
  let bootClock12Fmt = null;

  function buildGreetingText() {
    let now = new Date();
    let mode = greetingMode;
    let name = get('moonfog_username') || '朋友';

    if (!bootDateFmt) {
      bootDateFmt = new Intl.DateTimeFormat('zh-CN', {
        month: 'long', day: 'numeric', weekday: 'short'
      });
    }
    let dateLabel = bootDateFmt.format(now).replace(/[\u202f\u00a0\u2009]/g, ' ').trim();

    if (mode === 'clock') {
      let hour12 = get('moonfog_clock_hour12') === '1';
      let showDate = get('moonfog_clock_show_date');
      if (showDate == null || showDate === '') showDate = '1';
      let titleClock;
      if (hour12) {
        if (!bootClock12Fmt) {
          bootClock12Fmt = new Intl.DateTimeFormat('zh-CN', {
            hour: 'numeric', minute: '2-digit', hourCycle: 'h12'
          });
        }
        titleClock = bootClock12Fmt.format(now).replace(/[\u202f\u00a0\u2009\u2007]/g, ' ').trim();
      } else {
        if (!bootClock24Fmt) {
          bootClock24Fmt = new Intl.DateTimeFormat('zh-CN', {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
          });
        }
        titleClock = bootClock24Fmt.format(now).replace(/[\u202f\u00a0\u2009\u2007]/g, ' ').trim();
      }
      return { mode: mode, title: titleClock, sub: showDate === '0' ? '' : dateLabel };
    }
    if (mode === 'date') {
      return { mode: mode, title: dateLabel, sub: '' };
    }
    if (mode === 'quote') {
      let qMax = parseInt(get('moonfog_quote_max_len'), 10);
      if (!isFinite(qMax)) qMax = 32;
      qMax = Math.min(48, Math.max(16, qMax));
      let lastText = '';
      try {
        let lastRaw = get('moonfog_daily_quote');
        if (lastRaw) {
          let lastObj = JSON.parse(lastRaw);
          lastText = lastObj && String(lastObj.content || lastObj.hitokoto || '').trim();
        }
      } catch (e0) {}
      try {
        let poolRaw = get('moonfog_quote_pool');
        let pool = poolRaw ? JSON.parse(poolRaw) : [];
        if (Array.isArray(pool) && pool.length) {
          let pickIdx = -1;
          let pick = null;
          for (var qi = 0; qi < pool.length; qi++) {
            let item = pool[qi];
            let t = item
              ? (typeof item === 'string' ? item : String(item.content || '')).trim()
              : '';
            if (!t || t.length < 4 || t.length > qMax) continue;
            if (lastText && t === lastText) continue;
            pickIdx = qi;
            pick = {
              content: t,
              author: item && typeof item === 'object' ? String(item.author || '').trim() : '',
              source: (item && item.source) || 'pool'
            };
            break;
          }
          if (pick) {
            pool.splice(pickIdx, 1);
            set('moonfog_quote_pool', JSON.stringify(pool.slice(0, 5)));
            set('moonfog_daily_quote', JSON.stringify({
              content: pick.content, author: pick.author, source: pick.source, at: Date.now()
            }));
            window.__MOONFOG_BOOT_QUOTE__ = pick;
            return { mode: mode, title: pick.content, sub: pick.author ? ('\u2014 ' + pick.author) : '', fromPool: true };
          }
        }
      } catch (e1) {}
      try {
        let qRaw = get('moonfog_daily_quote');
        if (qRaw) {
          let qObj = JSON.parse(qRaw);
          let qText = qObj && String(qObj.content || qObj.hitokoto || '').trim();
          if (qText && qText.length >= 4 && qText.length <= qMax) {
            let qAuthor = qObj && String(qObj.author || '').trim();
            let held = { content: qText, author: qAuthor, source: 'cache' };
            window.__MOONFOG_BOOT_QUOTE__ = held;
            return { mode: mode, title: qText, sub: qAuthor ? ('\u2014 ' + qAuthor) : '', fromCache: true };
          }
        }
      } catch (e2) {}
      return { mode: mode, title: '', sub: '', waiting: true };
    }
    if (mode === 'custom') {
      let custom = (get('moonfog_custom_text') || '').replace(/\s+/g, ' ').trim();
      if (custom.length > 48) custom = custom.slice(0, 48);
      return { mode: mode, title: custom || '\u5199\u4e0b\u4e00\u53e5\u6b22\u8fce\u8bed\u2026', sub: '', placeholder: !custom };
    }

    let h = now.getHours();
    let greeting = '\u4f60\u597d\uff0c' + name;
    if (h >= 6 && h < 12) greeting = '\u65e9\u5b89\uff0c' + name;
    else if (h >= 12 && h < 14) greeting = '\u5348\u5b89\uff0c' + name;
    else if (h >= 14 && h < 19) greeting = '\u4e0b\u5348\u597d\uff0c' + name;
    else if (h >= 19 && h < 22) greeting = '\u665a\u4e0a\u597d\uff0c' + name;
    else greeting = '\u591c\u6df1\u4e86\uff0c' + name;
    return { mode: mode, title: greeting, sub: '' };
  }

  let greetingPainted = false;
  function paintGreeting() {
    let title = document.getElementById('greeting');
    let sub = document.getElementById('greetingSub');
    let section = document.getElementById('greetingSection');
    if (!title) return false;

    let data = buildGreetingText();
    if (section) section.dataset.mode = data.mode;

    title.classList.toggle('is-clock', data.mode === 'clock');
    title.classList.toggle('is-quote', data.mode === 'quote');
    title.classList.toggle('is-custom', data.mode === 'custom');
    title.classList.toggle('is-custom-placeholder', !!(data.mode === 'custom' && data.placeholder));

    if (data.mode === 'quote' && data.waiting) {
      title.textContent = '';
      if (sub) { sub.textContent = ''; sub.hidden = true; }
    } else {
      title.textContent = data.title || '';
      if (sub) {
        if (data.sub) { sub.textContent = data.sub; sub.hidden = false; }
        else { sub.textContent = ''; sub.hidden = true; }
      }
    }

    greetingPainted = true;
    return true;
  }

  window.__MOONFOG_PAINT_GREETING__ = paintGreeting;
  window.__MOONFOG_GREETING_PAINTED__ = function () { return greetingPainted; };
})();
