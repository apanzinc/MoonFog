/**
 * MoonFog - 问候区
 */

/** 当前会话的一言 Promise（fetch / promise 共用） */
let sessionQuotePromise = null;

/**
 * 规范化问候模式
 */
function normalizeGreetingMode(mode) {
  if (mode && Object.values(GREETING_MODES).includes(mode)) return mode;
  return DEFAULT_GREETING_MODE;
}

/** 模式切换动画序号，防止连点乱度*/
let greetingModeAnimId = 0;

/**
 * 应用问候模式；refresh 时若模式变化则播与每日一言同款过渡
 */
function applyGreetingMode(mode, refresh = true) {
  const next = normalizeGreetingMode(mode);
  const prev = currentGreetingMode;
  const modeChanged = prev !== next;

  const runCommit = (withReveal) => {
    currentGreetingMode = next;
    const section = document.getElementById("greetingSection");
    if (section) section.dataset.mode = currentGreetingMode;

    const title = document.getElementById("greeting");
    if (title) {
      title.classList.toggle("is-clock", currentGreetingMode === GREETING_MODES.clock);
      title.classList.toggle("is-quote", currentGreetingMode === GREETING_MODES.quote);
      title.classList.toggle("is-custom", currentGreetingMode === GREETING_MODES.custom);
      if (currentGreetingMode === GREETING_MODES.quote && !quoteBootLoading) {
        title.title = "\u70b9\u51fb\u6362\u4e00\u53e5";
        title.setAttribute("role", "button");
        title.setAttribute("tabindex", "0");
      } else {
        title.removeAttribute("title");
        title.removeAttribute("role");
        title.removeAttribute("tabindex");
        title.classList.remove("is-switching");
      }
    }

    updateGreetingSettingsVisibility();
    updateGreetingPreview();

    if (refresh && next === GREETING_MODES.quote && prev !== GREETING_MODES.quote) {
      prefetchDailyQuoteOnLoad();
      // 已有缓存句时补一reveal；骨架加载走自己的动画
      if (withReveal) {
        const t = document.getElementById("greeting");
        const s = document.getElementById("greetingSub");
        if (t && !t.classList.contains("is-quote-loading")) {
          playQuoteReveal(t, s);
        }
      }
      return;
    }
    if (next !== GREETING_MODES.quote && prev === GREETING_MODES.quote) {
      quoteCommitId += 1;
      quoteBusy = false;
      quoteSwitching = false;
      quoteBootLoading = false;
      sessionQuotePromise = null;
    }
    if (refresh) {
      updateGreetingDisplay();
      if (withReveal) {
        const t = document.getElementById("greeting");
        const s = document.getElementById("greetingSub");
        playQuoteReveal(t, s);
      }
    }
  };

  // 用户切换模式：先淡出，再换内容并上浮淡入（与每日一言同款）
  if (refresh && modeChanged && typeof shouldAnimateQuoteTransition === "function" && shouldAnimateQuoteTransition()) {
    const title = document.getElementById("greeting");
    const sub = document.getElementById("greetingSub");
    if (title) {
      const animId = ++greetingModeAnimId;
      title.classList.remove("is-quote-reveal", "is-greeting-reveal");
      if (sub) sub.classList.remove("is-quote-reveal", "is-greeting-reveal");
      title.classList.add("is-switching");
      if (sub) sub.classList.add("is-switching");
      window.setTimeout(() => {
        if (animId !== greetingModeAnimId) return;
        title.classList.remove("is-switching");
        if (sub) sub.classList.remove("is-switching");
        runCommit(true);
      }, 180);
      return;
    }
  }

  runCommit(false);
}

/**
 * 更新问候区设置项的显示与隐藏
 */
function updateGreetingSettingsVisibility() {
  const usernameEl = document.getElementById("usernameSetting");
  const customEl = document.getElementById("customTextSetting");
  const textGroup = document.getElementById("greetingCopyGroup");
  const clockGroup = document.getElementById("clockOptionsGroup");
  const quoteGroup = document.getElementById("quoteOptionsGroup");
  const showName = currentGreetingMode === GREETING_MODES.greeting;
  const showCustom = currentGreetingMode === GREETING_MODES.custom;
  const showGroup = showName || showCustom;
  const showClock = currentGreetingMode === GREETING_MODES.clock;
  const showQuote = currentGreetingMode === GREETING_MODES.quote;

  if (typeof setSettingsReveal === "function") {
    setSettingsReveal(usernameEl, showName);
    setSettingsReveal(customEl, showCustom);
    setSettingsReveal(textGroup, showGroup);
    setSettingsReveal(clockGroup, showClock);
    setSettingsReveal(quoteGroup, showQuote);
  } else {
    if (usernameEl) usernameEl.hidden = !showName;
    if (customEl) customEl.hidden = !showCustom;
    if (textGroup) textGroup.hidden = !showGroup;
    if (clockGroup) clockGroup.hidden = !showClock;
    if (quoteGroup) quoteGroup.hidden = !showQuote;
  }
  if (typeof updateClockOptionsUI === "function") updateClockOptionsUI();
  if (typeof updateQuoteMaxLenUI === "function") updateQuoteMaxLenUI();
}


/** @deprecated 已合并到 updateGreetingSettingsVisibility */
function updateUsernameSettingVisibility() {
  updateGreetingSettingsVisibility();
}

/**
 * 规范化自定义欢迎语文本
 */
function normalizeCustomText(text) {
  const max = typeof CUSTOM_TEXT_MAX_LEN === "number" ? CUSTOM_TEXT_MAX_LEN : 48;
  return String(text || "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * 读取自定义欢迎语
 */
function loadCustomText() {
  try {
    const raw = localStorage.getItem(CUSTOM_TEXT_KEY);
    currentCustomText = normalizeCustomText(raw || DEFAULT_CUSTOM_TEXT);
  } catch {
    currentCustomText = DEFAULT_CUSTOM_TEXT;
  }
  return currentCustomText;
}

/**
 * ??
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * ?? key
 */
function getDayKey(date = new Date()) {
  return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
}

/**
 * 根据当前时间获取问候语
 */
function getTimeGreeting(name, hour) {
  let greetingFunc = GREETING_TEMPLATES.morning;
  if (hour >= 12 && hour < 14) greetingFunc = GREETING_TEMPLATES.afternoon;
  else if (hour >= 14 && hour < 19) greetingFunc = GREETING_TEMPLATES.evening;
  else if (hour >= 19 && hour < 22) greetingFunc = GREETING_TEMPLATES.night;
  else if (hour >= 22 || hour < 6) greetingFunc = GREETING_TEMPLATES.lateNight;
  return greetingFunc(name);
}

/** 时钟偏好（运行时） */
let currentClockHour12 =
  typeof DEFAULT_CLOCK_HOUR12 === "boolean" ? DEFAULT_CLOCK_HOUR12 : false;
let currentClockShowDate =
  typeof DEFAULT_CLOCK_SHOW_DATE === "boolean" ? DEFAULT_CLOCK_SHOW_DATE : true;

function normalizeClockHour12(value) {
  if (value === true || value === "1" || value === 1 || value === "true") return true;
  if (value === false || value === "0" || value === 0 || value === "false") return false;
  return typeof DEFAULT_CLOCK_HOUR12 === "boolean" ? DEFAULT_CLOCK_HOUR12 : false;
}

function normalizeClockShowDate(value) {
  if (value === true || value === "1" || value === 1 || value === "true") return true;
  if (value === false || value === "0" || value === 0 || value === "false") return false;
  return typeof DEFAULT_CLOCK_SHOW_DATE === "boolean" ? DEFAULT_CLOCK_SHOW_DATE : true;
}

function loadClockOptions() {
  try {
    currentClockHour12 = normalizeClockHour12(
      localStorage.getItem(
        typeof CLOCK_HOUR12_KEY === "string" ? CLOCK_HOUR12_KEY : "moonfog_clock_hour12"
      )
    );
  } catch {
    currentClockHour12 =
      typeof DEFAULT_CLOCK_HOUR12 === "boolean" ? DEFAULT_CLOCK_HOUR12 : false;
  }
  try {
    const raw = localStorage.getItem(
      typeof CLOCK_SHOW_DATE_KEY === "string" ? CLOCK_SHOW_DATE_KEY : "moonfog_clock_show_date"
    );
    // 缺省显示日期
    currentClockShowDate =
      raw == null || raw === ""
        ? typeof DEFAULT_CLOCK_SHOW_DATE === "boolean"
          ? DEFAULT_CLOCK_SHOW_DATE
          : true
        : normalizeClockShowDate(raw);
  } catch {
    currentClockShowDate =
      typeof DEFAULT_CLOCK_SHOW_DATE === "boolean" ? DEFAULT_CLOCK_SHOW_DATE : true;
  }
  return { hour12: currentClockHour12, showDate: currentClockShowDate };
}

function saveClockHour12(value) {
  currentClockHour12 = normalizeClockHour12(value);
  try {
    localStorage.setItem(
      typeof CLOCK_HOUR12_KEY === "string" ? CLOCK_HOUR12_KEY : "moonfog_clock_hour12",
      currentClockHour12 ? "1" : "0"
    );
  } catch (_) {}
  return currentClockHour12;
}

function saveClockShowDate(value) {
  currentClockShowDate = normalizeClockShowDate(value);
  try {
    localStorage.setItem(
      typeof CLOCK_SHOW_DATE_KEY === "string" ? CLOCK_SHOW_DATE_KEY : "moonfog_clock_show_date",
      currentClockShowDate ? "1" : "0"
    );
  } catch (_) {}
  return currentClockShowDate;
}

function updateClockOptionsUI() {
  const hourSeg = document.getElementById("clockHour12Segment");
  if (hourSeg) {
    hourSeg.querySelectorAll("[data-clock-hour12]").forEach((btn) => {
      const on = btn.getAttribute("data-clock-hour12") === "1";
      const active = on === !!currentClockHour12;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });
  }
  const dateSeg = document.getElementById("clockShowDateSegment");
  if (dateSeg) {
    dateSeg.querySelectorAll("[data-clock-show-date]").forEach((btn) => {
      const on = btn.getAttribute("data-clock-show-date") === "1";
      const active = on === !!currentClockShowDate;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });
  }
}

/**
 * 格式化时钟：固定单行 HH:MM4 时）h:MM 上午/下午2 时）
 * 使用 Intl.DateTimeFormat；缓存格式化器避免反复构造 * 部分系统会在 12 时制插入窄空/ 不换行空格，统一替换为普通空格，保持单行 */
let clockFmt24 = null;
let clockFmt12 = null;

function formatClock(now) {
  const hour12 = !!currentClockHour12;
  let s;
  if (!hour12) {
    if (!clockFmt24) {
      clockFmt24 = new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      });
    }
    s = clockFmt24.format(now);
  } else {
    if (!clockFmt12) {
      clockFmt12 = new Intl.DateTimeFormat('zh-CN', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: 'h12'
      });
    }
    s = clockFmt12.format(now);
  }
  return s.replace(/[\u202f\u00a0\u2009\u2007]/g, ' ').trim();
}

/**
 * 时钟选项变更时刷新并播过渡动 */
function applyClockOptionsChange() {
  if (typeof updateClockOptionsUI === "function") updateClockOptionsUI();
  if (typeof updateGreetingDisplay === "function") updateGreetingDisplay();
  else if (typeof updateGreetingPreview === "function") updateGreetingPreview();

  // 仅在当前时间模式下播与模式切换同reveal
  if (currentGreetingMode !== GREETING_MODES.clock) return;
  if (typeof shouldAnimateQuoteTransition === "function" && !shouldAnimateQuoteTransition()) return;
  const title = document.getElementById("greeting");
  const sub = document.getElementById("greetingSub");
  if (title && typeof playQuoteReveal === "function") {
    playQuoteReveal(title, sub);
  }
}

/**
 * 格式化日期副标题
 */
function formatDateLabel(now) {
  try {
    const datePart = new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric"
    }).format(now);
    const weekdayPart = new Intl.DateTimeFormat("zh-CN", {
      weekday: "short"
    }).format(now);
    return datePart + " " + weekdayPart;
  } catch {
    const weekdays = ["\u5468\u65e5", "\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d"];
    return (now.getMonth() + 1) + "\u6708" + now.getDate() + "\u65e5 " + weekdays[now.getDay()];
  }
}

/**
 * 规范化一言文本（去除空白字符）
 */
function normalizeQuoteText(text) {
  return String(text || "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/**
 * 一言字数上限：规范化
 */
function normalizeQuoteMaxLen(value) {
  const min =
    typeof QUOTE_MAX_LEN_MIN === "number" ? QUOTE_MAX_LEN_MIN : 16;
  const max =
    typeof QUOTE_MAX_LEN_MAX === "number" ? QUOTE_MAX_LEN_MAX : 48;
  const fb =
    typeof DEFAULT_QUOTE_MAX_LEN === "number" ? DEFAULT_QUOTE_MAX_LEN : 32;
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fb));
  return Math.min(max, Math.max(min, Math.round(n)));
}

function getQuoteMaxLen() {
  if (typeof currentQuoteMaxLen === "number" && Number.isFinite(currentQuoteMaxLen)) {
    return normalizeQuoteMaxLen(currentQuoteMaxLen);
  }
  return normalizeQuoteMaxLen(
    typeof DEFAULT_QUOTE_MAX_LEN === "number" ? DEFAULT_QUOTE_MAX_LEN : 32
  );
}

function loadQuoteMaxLen() {
  try {
    const raw = localStorage.getItem(
      typeof QUOTE_MAX_LEN_KEY === "string" ? QUOTE_MAX_LEN_KEY : "moonfog_quote_max_len"
    );
    if (raw != null && raw !== "") {
      currentQuoteMaxLen = normalizeQuoteMaxLen(raw);
      return currentQuoteMaxLen;
    }
  } catch (_) {}
  currentQuoteMaxLen = normalizeQuoteMaxLen(
    typeof DEFAULT_QUOTE_MAX_LEN === "number" ? DEFAULT_QUOTE_MAX_LEN : 32
  );
  return currentQuoteMaxLen;
}

function saveQuoteMaxLen(value) {
  currentQuoteMaxLen = normalizeQuoteMaxLen(value);
  try {
    localStorage.setItem(
      typeof QUOTE_MAX_LEN_KEY === "string" ? QUOTE_MAX_LEN_KEY : "moonfog_quote_max_len",
      String(currentQuoteMaxLen)
    );
  } catch (_) {}
  return currentQuoteMaxLen;
}

function updateQuoteMaxLenUI() {
  const slider = document.getElementById("quoteMaxLenSlider");
  const label = document.getElementById("quoteMaxLenValue");
  const maxLen = getQuoteMaxLen();
  if (slider && String(slider.value) !== String(maxLen)) {
    slider.value = String(maxLen);
  }
  if (label) label.textContent = maxLen + " 字符";
}

/**
 * 解析 Hitokoto JSON
 */
function parseHitokotoPayload(data) {
  if (!data || typeof data !== "object") return null;
  const content = String(data.hitokoto || data.content || "").trim();
  if (!content) return null;

  const who = String(data.from_who || "").trim();
  const from = String(data.from || data.author || "").trim();
  let author = "";
  if (who && from && who !== from) author = who + " \u00b7 " + from;
  else author = who || from;

  return { content, author, source: "api" };
}

/**
 * 一言是否可用：只卡字+ 可选避开当前/ 最近几 * （过严过滤会导致几乎全拒，看起来像「缓存没/ 一直失败」）
 */
function isQuoteAcceptable(quote, options = {}) {
  if (!quote || !quote.content) return false;
  const text = String(quote.content).trim();
  const norm = normalizeQuoteText(text);
  if (!norm) return false;
  const len = text.length;
  const maxLen =
    options.maxLen != null
      ? normalizeQuoteMaxLen(options.maxLen)
      : getQuoteMaxLen();
  if (len < 4 || len > maxLen) return false;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) return false;

  if (options.avoidContent) {
    const avoid = normalizeQuoteText(options.avoidContent);
    if (avoid && norm === avoid) return false;
  }

  if (options.avoidRecent) {
    const recent = getRecentQuoteContents();
    // 只避开最近 5 条，避免接口几乎全被过滤
    const slice = recent.slice(0, 5);
    if (slice.some((s) => normalizeQuoteText(s) === norm)) return false;
  }

  return true;
}

/**
 * 获取最近展示的一言列表
 */
function getRecentQuoteContents() {
  try {
    const raw = localStorage.getItem(QUOTE_RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string" && s.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * 记住已展示的一言
 */
function rememberQuoteContent(content) {
  if (!content) return;
  try {
    const norm = normalizeQuoteText(content);
    const list = getRecentQuoteContents().filter((s) => normalizeQuoteText(s) !== norm);
    list.unshift(String(content).trim());
    localStorage.setItem(QUOTE_RECENT_KEY, JSON.stringify(list.slice(0, QUOTE_RECENT_MAX)));
  } catch (_) {}
}

/**
 * 获取当日内置一言
 */
function getBuiltinQuoteForDay(dayKey) {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  const quote = BUILTIN_QUOTES[hash % BUILTIN_QUOTES.length] || BUILTIN_QUOTES[0];
  return { content: quote.content, author: quote.author || "", source: "builtin" };
}

/**
 * 随机获取一条内置一言（避免重复）
 */
function getRandomBuiltinQuote(avoidContent = "") {
  const recentNorm = new Set(getRecentQuoteContents().map(normalizeQuoteText));
  const avoidNorm = normalizeQuoteText(avoidContent);
  const maxLen = getQuoteMaxLen();

  const fresh = BUILTIN_QUOTES.filter((q) => {
    if (!q || !q.content) return false;
    if (String(q.content).trim().length > maxLen) return false;
    const n = normalizeQuoteText(q.content);
    if (avoidNorm && n === avoidNorm) return false;
    if (recentNorm.has(n)) return false;
    return true;
  });

  const softer = BUILTIN_QUOTES.filter((q) => {
    if (!q || !q.content) return false;
    if (String(q.content).trim().length > maxLen) return false;
    const n = normalizeQuoteText(q.content);
    if (avoidNorm && n === avoidNorm) return false;
    return true;
  });

  const list = fresh.length ? fresh : softer.length ? softer : BUILTIN_QUOTES;
  if (!list.length) return null;
  const pick = list[Math.floor(Math.random() * list.length)] || list[0];
  return { content: pick.content, author: pick.author || "", source: "builtin" };
}

/**
 * 读取一言预加载池
 */
function loadQuotePool() {
  try {
    const raw = localStorage.getItem(QUOTE_POOL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return { content: item, author: "", source: "pool" };
        const content = String(item.content || "").trim();
        if (!content) return null;
        return {
          content,
          author: String(item.author || "").trim(),
          source: item.source || "pool"
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 保存一言预加载池
 */
function saveQuotePool(list) {
  try {
    const next = (Array.isArray(list) ? list : [])
      .filter((q) => q && q.content)
      .slice(0, QUOTE_POOL_MAX)
      .map((q) => ({
        content: String(q.content).trim(),
        author: String(q.author || "").trim(),
        source: q.source || "pool"
      }));
    localStorage.setItem(QUOTE_POOL_KEY, JSON.stringify(next));
  } catch (_) {}
}

/**
 * 持久化「当前展示句」——新标签页秒开 */
function persistDailyQuoteCache(quote) {
  if (!quote || !quote.content) return;
  try {
    const payload = {
      content: String(quote.content).trim(),
      author: String(quote.author || "").trim(),
      source: quote.source || "api",
      dayKey: typeof getDayKey === "function" ? getDayKey() : "",
      at: Date.now()
    };
    localStorage.setItem(
      typeof DAILY_QUOTE_KEY === "string" ? DAILY_QUOTE_KEY : "moonfog_daily_quote",
      JSON.stringify(payload)
    );
  } catch (_) {}
}

/**
 * 读取上次展示句（跨标签页 */
function loadDailyQuoteCache() {
  try {
    const raw = localStorage.getItem(
      typeof DAILY_QUOTE_KEY === "string" ? DAILY_QUOTE_KEY : "moonfog_daily_quote"
    );
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data) return null;
    const content = String(data.content || data.hitokoto || "").trim();
    if (!content) return null;
    return {
      content,
      author: String(data.author || data.from || "").trim(),
      source: data.source || "cache",
      dayKey: data.dayKey || ""
    };
  } catch {
    return null;
  }
}

/**
 * 从预加载池中取一条一言
 */
function takeQuoteFromPool(avoidContent = "") {
  const pool = loadQuotePool();
  if (!pool.length) return null;
  const avoidNorm = normalizeQuoteText(avoidContent);
  const maxLen = getQuoteMaxLen();
  // 池内句入库时已筛过：这里只卡字数 + avoid，避免二次过滤把池掏空
  let index = pool.findIndex((q) => {
    if (!q || !q.content) return false;
    const t = String(q.content).trim();
    if (t.length < 4 || t.length > maxLen) return false;
    if (avoidNorm && normalizeQuoteText(t) === avoidNorm) return false;
    return true;
  });
  if (index < 0) {
    const kept = pool.filter((q) => {
      if (!q || !q.content) return false;
      const t = String(q.content).trim();
      return t.length >= 4 && t.length <= maxLen;
    });
    if (kept.length !== pool.length) saveQuotePool(kept);
    return null;
  }
  const [picked] = pool.splice(index, 1);
  const next = pool.filter((q) => {
    if (!q || !q.content) return false;
    const t = String(q.content).trim();
    return t.length >= 4 && t.length <= maxLen;
  });
  saveQuotePool(next);
  return picked || null;
}

function buildHitokotoUrls(maxLen) {
  const len = normalizeQuoteMaxLen(maxLen);
  const bases = Array.isArray(HITOKOTO_API_BASES)
    ? HITOKOTO_API_BASES
    : Array.isArray(HITOKOTO_API_URLS)
      ? HITOKOTO_API_URLS
      : [];
  return bases.map((base) => {
    const s = String(base || "");
    if (!s) return s;
    if (/[?&]max_length=/.test(s)) {
      return s.replace(/([?&]max_length=)\d+/i, "$1" + len);
    }
    return s + (s.indexOf("?") >= 0 ? "&" : "?") + "max_length=" + len;
  }).filter(Boolean);
}

/**
 * 单次请求一言（不循环 */
async function fetchHitokotoOnce(options = {}) {
  const maxLen = options.maxLen != null ? normalizeQuoteMaxLen(options.maxLen) : getQuoteMaxLen();
  const urls = buildHitokotoUrls(maxLen);
  for (const url of urls) {
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);
      if (!res || !res.ok) continue;
      const data = await res.json();
      const quote = parseHitokotoPayload(data);
      if (quote) return quote;
    } catch (_) {
      // try next mirror
    }
  }
  return null;
}

/**
 * 拉取可用一言：超不合格则换下一句，最多尝N  * 返回 { ok, quote, attempts, reason }
 */
async function fetchAcceptableQuote(options = {}) {
  const defaultMax =
    typeof QUOTE_FETCH_MAX_ATTEMPTS === "number" ? QUOTE_FETCH_MAX_ATTEMPTS : 10;
  const maxAttempts =
    options.maxAttempts != null
      ? Math.max(1, Math.min(20, Number(options.maxAttempts) || defaultMax))
      : defaultMax;
  const maxLen = options.maxLen != null ? normalizeQuoteMaxLen(options.maxLen) : getQuoteMaxLen();
  const acceptOpts = {
    maxLen,
    avoidContent: options.avoidContent || "",
    avoidRecent: options.avoidRecent !== false
  };
  let attempts = 0;
  let networkMisses = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    const quote = await fetchHitokotoOnce({ maxLen });
    if (!quote) {
      // 全镜像失败：连续几次直接放弃，避免空度无限
      networkMisses += 1;
      if (networkMisses >= 3) {
        return { ok: false, quote: null, attempts, reason: "network" };
      }
      continue;
    }
    networkMisses = 0;
    if (isQuoteAcceptable(quote, acceptOpts)) {
      return { ok: true, quote, attempts, reason: "" };
    }
    // 超长或不合格：继续下一回合
  }
  return { ok: false, quote: null, attempts, reason: "max_attempts" };
}

/**
 * 兼容旧调用：成功返回 quote，失败返null
 */
async function fetchHitokotoQuote(options = {}) {
  const result = await fetchAcceptableQuote(options);
  return result && result.ok ? result.quote : null;
}

/**
 * 预加载池补货
 */
function refillQuotePool(force = false) {
  if (quotePoolRefillPromise) return quotePoolRefillPromise;
  const pool = loadQuotePool();
  if (!force && pool.length >= QUOTE_POOL_MIN) return Promise.resolve(pool);

  quotePoolRefillPromise = (async () => {
    const maxLen = getQuoteMaxLen();
    const currentNorm = normalizeQuoteText(
      cachedDailyQuote && cachedDailyQuote.content
    );
    let list = loadQuotePool().filter((q) => {
      if (!q || !q.content) return false;
      const t = String(q.content).trim();
      if (t.length < 4 || t.length > maxLen) return false;
      if (currentNorm && normalizeQuoteText(t) === currentNorm) return false;
      return true;
    });
    const seen = new Set(list.map((q) => normalizeQuoteText(q.content)));
    if (currentNorm) seen.add(currentNorm);
    let guard = 0;
    while (list.length < QUOTE_POOL_TARGET && guard < QUOTE_POOL_TARGET + 5) {
      guard += 1;
      const result = await fetchAcceptableQuote({
        avoidContent: cachedDailyQuote ? cachedDailyQuote.content : "",
        avoidRecent: false,
        maxAttempts: 4
      });
      if (!result || !result.ok || !result.quote) break;
      const quote = result.quote;
      const norm = normalizeQuoteText(quote.content);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      list.push(quote);
      saveQuotePool(list);
    }
    return list;
  })()
    .catch(() => loadQuotePool())
    .finally(() => {
      quotePoolRefillPromise = null;
    });

  return quotePoolRefillPromise;
}

/**
 * 展示获取失败（超过尝试次数）
 */
function showQuoteFetchError(options = {}) {
  if (options.commitId != null && options.commitId !== quoteCommitId) return false;
  if (currentGreetingMode !== GREETING_MODES.quote && options.force !== true) return false;

  const msg =
    typeof QUOTE_FETCH_ERROR_TEXT === "string" && QUOTE_FETCH_ERROR_TEXT
      ? QUOTE_FETCH_ERROR_TEXT
      : "获取一言失败，请稍后点击重试";

  cachedDailyQuote = null;
  quoteSessionReady = false;
  quoteBusy = false;
  quoteSwitching = false;
  sessionQuotePromise = null;
  quoteBootLoading = false;

  const title = document.getElementById("greeting");
  if (!title) return false;
  stopQuoteSeekingCycle();
  title.classList.remove("is-quote-loading", "is-quote-seeking-swap", "is-switching");
  title.classList.add("is-quote-error");
  title.removeAttribute("aria-busy");
  title.textContent = msg;
  title.title = "点击重试";
  title.setAttribute("role", "button");
  title.setAttribute("tabindex", "0");
  title.setAttribute("aria-label", msg);
  setGreetingSub("");
  clearQuoteReveal();
  updateGreetingPreview();
  return true;
}

/**
 * 是否应该播放一言切换动画
 */
function shouldAnimateQuoteTransition() {
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * 问一言内容 reveal：淡入上 */
function playQuoteReveal(title, sub) {
  if (!title || !shouldAnimateQuoteTransition()) return;
  title.classList.remove("is-quote-reveal", "is-greeting-reveal");
  if (sub) sub.classList.remove("is-quote-reveal", "is-greeting-reveal");
  void title.offsetWidth;
  title.classList.add("is-quote-reveal", "is-greeting-reveal");
  if (sub && !sub.hidden) sub.classList.add("is-quote-reveal", "is-greeting-reveal");
}

/**
 * 清除 reveal class
 */
function clearQuoteReveal() {
  const title = document.getElementById("greeting");
  const sub = document.getElementById("greetingSub");
  if (title) title.classList.remove("is-quote-reveal", "is-greeting-reveal");
  if (sub) sub.classList.remove("is-quote-reveal", "is-greeting-reveal");
}

/**
 * 设置副标题
 */
function setGreetingSub(text) {
  const sub = document.getElementById("greetingSub");
  if (!sub) return;
  if (text) {
    sub.textContent = text;
    sub.hidden = false;
  } else {
    sub.textContent = "";
    sub.hidden = true;
  }
}

/** 加载时轮换的文案（偏文气、轻一点） */
const QUOTE_SEEKING_LINES = [
  "正在寻一句好话",
  "墨未干，句将至",
  "于字里行间拣一句",
  "静候一句可心的话",
  "风过书页，句在途中",
  "且听一句未完的话"
];

let quoteSeekingTimer = null;
let quoteSeekingIndex = 0;

function stopQuoteSeekingCycle() {
  if (quoteSeekingTimer) {
    clearInterval(quoteSeekingTimer);
    quoteSeekingTimer = null;
  }
  quoteSeekingIndex = 0;
}

function startQuoteSeekingCycle(title) {
  if (!title) return;
  stopQuoteSeekingCycle();
  // 均衡/极致：固定一句，不轮换动画
  const perf = document.documentElement.getAttribute("data-perf") ||
    (document.documentElement.classList.contains("low-perf") ? "low" : "full");
  if (perf === "low" || perf === "balanced") {
    title.textContent = QUOTE_SEEKING_LINES[0];
    return;
  }
  quoteSeekingIndex = Math.floor(Math.random() * QUOTE_SEEKING_LINES.length);
  const paint = () => {
    if (!title.classList.contains("is-quote-loading")) return;
    const line = QUOTE_SEEKING_LINES[quoteSeekingIndex % QUOTE_SEEKING_LINES.length];
    title.classList.remove("is-quote-seeking-swap");
    void title.offsetWidth;
    title.textContent = line;
    title.classList.add("is-quote-seeking-swap");
    quoteSeekingIndex += 1;
  };
  paint();
  quoteSeekingTimer = setInterval(paint, 2200);
}

/**
 * 每日一言加载态：文气轮换文案 + 轻呼吸微 */
function setQuoteLoading(loading, options = {}) {
  const title = document.getElementById("greeting");
  if (!title) return;
  const showSkeleton =
    options.showSkeleton !== false && currentGreetingMode === GREETING_MODES.quote;

  if (loading && showSkeleton) {
    quoteBootLoading = true;
    title.classList.add("is-quote-loading");
    title.classList.remove("is-quote-reveal", "is-switching");
    title.setAttribute("aria-busy", "true");
    title.setAttribute("aria-label", "正在加载每日一言");
    title.removeAttribute("title");
    title.removeAttribute("role");
    title.removeAttribute("tabindex");
    startQuoteSeekingCycle(title);
    setGreetingSub("");
  } else {
    quoteBootLoading = false;
    stopQuoteSeekingCycle();
    title.classList.remove("is-quote-loading", "is-quote-seeking-swap");
    if (!quoteSwitching) title.classList.remove("is-switching");
    title.removeAttribute("aria-busy");
    // 错误态由 showQuoteFetchError 托管，这里别盖掉
    if (title.classList.contains("is-quote-error")) return;
    title.removeAttribute("aria-label");
    if (currentGreetingMode === GREETING_MODES.quote) {
      title.title = "点击换一";
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
    }
  }
}

/**
 * 提交每日一言到界面
 */
function commitDailyQuote(quote, options = {}) {
  if (!quote || !quote.content) return false;
  if (options.commitId != null && options.commitId !== quoteCommitId) return false;
  if (currentGreetingMode !== GREETING_MODES.quote && options.force !== true) return false;

  cachedDailyQuote = {
    content: String(quote.content).trim(),
    author: String(quote.author || "").trim(),
    source: quote.source || "api"
  };
  cachedQuoteDayKey = getDayKey();
  quoteSessionReady = true;
  quoteBusy = false;
  quoteSwitching = false;
  sessionQuotePromise = null;
  persistDailyQuoteCache(cachedDailyQuote);

  const title = document.getElementById("greeting");
  const sub = document.getElementById("greetingSub");
  if (title) title.classList.remove("is-quote-error");
  const prevText = title ? title.textContent : "";
  forceShowQuote(cachedDailyQuote);

  if (options.animate !== false && shouldAnimateQuoteTransition()) {
    if (normalizeQuoteText(prevText) !== normalizeQuoteText(cachedDailyQuote.content)) {
      playQuoteReveal(title, sub);
    }
  } else {
    clearQuoteReveal();
  }

  updateGreetingPreview();
  // 后台补池，保证下次打开 / 换句有货
  refillQuotePool(true);
  return true;
}

/**
 * 强制显示一言
 */
function forceShowQuote(quote) {
  const title = document.getElementById("greeting");
  if (!title || !quote) return;
  quoteBootLoading = false;
  quoteBusy = false;
  quoteSwitching = false;
  title.classList.remove(
    "is-quote-loading",
    "is-quote-reveal",
    "is-switching",
    "is-quote-error"
  );
  title.removeAttribute("aria-busy");
  title.removeAttribute("aria-label");
  if (normalizeQuoteText(title.textContent) !== normalizeQuoteText(quote.content)) {
    title.textContent = quote.content;
  }
  setGreetingSub(quote.author || "");
  if (currentGreetingMode === GREETING_MODES.quote) {
    title.title = "\u70b9\u51fb\u6362\u4e00\u53e5";
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
  }
  rememberQuoteContent(quote.content);
  updateGreetingPreview();
}

/**
 * 缓存句能否展示：只卡字数
 */
function isCachedQuoteDisplayable(quote, maxLen) {
  if (!quote || !quote.content) return false;
  const text = String(quote.content).trim();
  const limit = maxLen != null ? normalizeQuoteMaxLen(maxLen) : getQuoteMaxLen();
  return text.length >= 4 && text.length <= limit;
}

/**
 * 应用一句到内存 + 磁盘（可选是否写盘）
 */
function adoptQuote(quote, options = {}) {
  if (!quote || !quote.content) return null;
  const adopted = {
    content: String(quote.content).trim(),
    author: String(quote.author || "").trim(),
    source: quote.source || "api"
  };
  cachedDailyQuote = adopted;
  cachedQuoteDayKey = getDayKey();
  quoteSessionReady = true;
  if (options.persist !== false) persistDailyQuoteCache(adopted);
  return adopted;
}

/**
 * 打开 / 刷新 / 新标签：立刻出字
 * - boot 已从缓存画好 直接接管，后台补 * - 否则同步吃池；池空先闪磁盘句/内置，再后台拉下一 */
function prefetchDailyQuoteOnLoad() {
  if (currentGreetingMode !== GREETING_MODES.quote) return sessionQuotePromise;
  if (typeof loadQuoteMaxLen === "function") loadQuoteMaxLen();

  // 同页已完成一次不重复换
  if (cachedDailyQuote && quoteSessionReady && !sessionQuotePromise) {
    forceShowQuote(cachedDailyQuote);
    refillQuotePool(false);
    return Promise.resolve(cachedDailyQuote);
  }

  // boot 已同步展示（池下一句或缓存）→ 立刻接管内存，不再等网络
  const bootQ = window.__MOONFOG_BOOT_QUOTE__;
  if (bootQ && bootQ.content) {
    try { delete window.__MOONFOG_BOOT_QUOTE__; } catch (_) {}
    const commitId = ++quoteCommitId;
    adoptQuote(bootQ, { persist: true });
    forceShowQuote(cachedDailyQuote);
    quoteSessionReady = true;
    quoteBusy = false;
    const wasOnlyCache = !bootQ.source || bootQ.source === "cache";
    if (wasOnlyCache) {
      const next = takeQuoteFromPool(bootQ.content);
      if (next) {
        commitDailyQuote(next, { commitId: ++quoteCommitId, animate: false });
      } else {
        sessionQuotePromise = (async () => {
          try {
            const result = await fetchAcceptableQuote({
              avoidContent: cachedDailyQuote ? cachedDailyQuote.content : "",
              avoidRecent: false,
              maxAttempts: 3
            });
            if (result && result.ok && result.quote) {
              const same = cachedDailyQuote &&
                normalizeQuoteText(cachedDailyQuote.content) === normalizeQuoteText(result.quote.content);
              if (!same) {
                commitDailyQuote(result.quote, { commitId: ++quoteCommitId, animate: false });
              }
            }
          } catch (e) { console.warn("[MoonFog] boot quote fetch failed:", e); }
          sessionQuotePromise = null;
        })();
      }
    } else {
      refillQuotePool(false);
    }
    refillQuotePool(true);
    return Promise.resolve(cachedDailyQuote);
  }

  // boot 没有提供缓存句 → 先从池/磁盘取立刻展示，后台补池
  const fromPool = takeQuoteFromPool("");
  if (fromPool) {
    adoptQuote(fromPool, { persist: true });
    forceShowQuote(cachedDailyQuote);
  } else {
    const disk = loadDailyQuoteCache();
    if (disk && disk.content && isCachedQuoteDisplayable(disk, getQuoteMaxLen())) {
      adoptQuote(disk, { persist: false });
      forceShowQuote(cachedDailyQuote);
    } else {
      const fb = resolveQuoteFallback("");
      adoptQuote(fb, { persist: true });
      forceShowQuote(cachedDailyQuote);
    }
  }
  quoteSessionReady = true;
  quoteBusy = false;
  refillQuotePool(true);

  return Promise.resolve(cachedDailyQuote);
}

/**
 * 推进下一句：池（同步秒开）→ 网络（可hold 当前句）内置
 */
function advanceToNextQuote(options = {}) {
  if (sessionQuotePromise) return sessionQuotePromise;

  const animate = options.animate === true;
  const silentHold = options.silentHold === true;
  let avoid = "";
  if (cachedDailyQuote && cachedDailyQuote.content) {
    avoid = cachedDailyQuote.content;
  } else {
    const disk = loadDailyQuoteCache();
    if (disk && disk.content) avoid = disk.content;
  }

  const commitId = ++quoteCommitId;
  quoteBusy = true;

  // 1) 预取池：同步，零等待
  const fromPool = takeQuoteFromPool(avoid);
  if (fromPool) {
    commitDailyQuote(fromPool, { commitId, animate });
    return Promise.resolve(fromPool);
  }

  // 2) 无池：立刻先画磁盘句/内置，避免空白等网络
  if (!silentHold && !cachedDailyQuote) {
    const disk = loadDailyQuoteCache();
    if (disk && isCachedQuoteDisplayable(disk, getQuoteMaxLen())) {
      adoptQuote(disk, { persist: false });
      forceShowQuote(cachedDailyQuote);
    } else {
      const fb = resolveQuoteFallback(avoid);
      adoptQuote(fb, { persist: true });
      forceShowQuote(cachedDailyQuote);
    }
  }

  // 3) 网络补「真正下一句」（不挡首屏  // 点击换句时需loading；打开时若已有展示句则静默
  const needSkeleton = animate || !cachedDailyQuote;
  if (needSkeleton) setQuoteLoading(true, { showSkeleton: true });

  sessionQuotePromise = (async () => {
    let result = await fetchAcceptableQuote({
      avoidContent: avoid || (cachedDailyQuote && cachedDailyQuote.content) || "",
      avoidRecent: true,
      maxAttempts: 6
    });
    if (!result || !result.ok) {
      result = await fetchAcceptableQuote({
        avoidContent: avoid || (cachedDailyQuote && cachedDailyQuote.content) || "",
        avoidRecent: false,
        maxAttempts: 4
      });
    }
    if (result && result.ok && result.quote) {
      // 打开静默换：有下一句再换；点击始终换
      const same =
        cachedDailyQuote &&
        normalizeQuoteText(cachedDailyQuote.content) ===
          normalizeQuoteText(result.quote.content);
      if (!same || animate) {
        commitDailyQuote(result.quote, {
          commitId,
          animate: animate || !silentHold
        });
      } else {
        refillQuotePool(false);
      }
      return result.quote;
    }
    // 网络失败：已有展示句则保留；否则内置
    if (!cachedDailyQuote) {
      const fallback = resolveQuoteFallback(avoid);
      commitDailyQuote(fallback, { commitId, animate: true });
      return fallback;
    }
    quoteSessionReady = true;
    refillQuotePool(true);
    return cachedDailyQuote;
  })()
    .catch(() => {
      if (!cachedDailyQuote) {
        const fallback = resolveQuoteFallback(avoid);
        commitDailyQuote(fallback, { commitId, animate: true });
        return fallback;
      }
      quoteSessionReady = true;
      return cachedDailyQuote;
    })
    .finally(() => {
      if (quoteCommitId === commitId || !sessionQuotePromise) {
        setQuoteLoading(false);
        quoteBusy = false;
        quoteSwitching = false;
        sessionQuotePromise = null;
        quoteSessionReady = true;
      }
    });

  return sessionQuotePromise;
}

/**
 * API 失败后的本地回退
 */
function resolveQuoteFallback(avoidContent) {
  const maxLen = getQuoteMaxLen();
  const avoidNorm = normalizeQuoteText(avoidContent || "");
  if (Array.isArray(BUILTIN_QUOTES)) {
    const list = BUILTIN_QUOTES.filter((q) => {
      if (!q || !q.content) return false;
      const t = String(q.content).trim();
      if (t.length < 4 || t.length > maxLen) return false;
      if (avoidNorm && normalizeQuoteText(t) === avoidNorm) return false;
      return true;
    });
    if (list.length) {
      const pick = list[Math.floor(Math.random() * list.length)];
      return { content: pick.content, author: pick.author || "", source: "builtin" };
    }
    // 再放宽：任意不超过长度限制的
    const any = BUILTIN_QUOTES.find((q) => {
      const t = q && String(q.content || "").trim();
      return t && t.length <= maxLen;
    });
    if (any) {
      return { content: any.content, author: any.author || "", source: "builtin" };
    }
  }
  return { content: "慢慢来，比较快", author: "李宗盛", source: "builtin" };
}

/**
 * 点击换一= 与刷新同一条推进逻辑
 */
async function switchDailyQuote() {
  if (currentGreetingMode !== GREETING_MODES.quote) return;
  const titleEl = document.getElementById("greeting");
  const isError = titleEl && titleEl.classList.contains("is-quote-error");
  if (!isError && (quoteSwitching || quoteBootLoading || sessionQuotePromise)) return;

  quoteSwitching = true;
  if (titleEl) {
    titleEl.classList.remove("is-quote-error");
    titleEl.classList.add("is-switching");
  }
  // 允许同页再次推进：清 session 就绪标记，走 advance
  quoteSessionReady = false;
  return advanceToNextQuote({ animate: true, reason: "click" });
}

/**
 * 获取当前一言
 */
function getDailyQuote() {
  return cachedDailyQuote || null;
}

/**
 * 初始化 / 换一句
 */
function initQuoteClick() {
  const title = document.getElementById("greeting");
  if (!title || title.dataset.quoteBound === "1") return;
  title.dataset.quoteBound = "1";

  title.addEventListener("click", () => {
    if (currentGreetingMode !== GREETING_MODES.quote) return;
    switchDailyQuote();
  });

  title.addEventListener("keydown", (e) => {
    if (currentGreetingMode !== GREETING_MODES.quote) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    switchDailyQuote();
  });
}

/**
 * 更新自定义欢迎语字数统计
 */
function updateCustomTextCount(rawText) {
  const countEl = document.getElementById("customTextCount");
  if (!countEl) return;
  const max = typeof CUSTOM_TEXT_MAX_LEN === "number" ? CUSTOM_TEXT_MAX_LEN : 48;
  const source =
    rawText != null
      ? String(rawText)
      : document.getElementById("customTextInput")?.value ?? currentCustomText ?? "";
  const len = Math.min(String(source).length, max);
  countEl.textContent = len + " / " + max;
}

/**
 * 解析问候区预览内容（主文案/副标题）
 */
function resolveGreetingPreviewContent(now = new Date()) {
  const mode = currentGreetingMode;

  if (mode === GREETING_MODES.clock) {
    return {
      title: formatClock(now),
      sub: currentClockShowDate ? formatDateLabel(now) : "",
      isClock: true,
      isQuote: false,
      isCustom: false,
      isPlaceholder: false,
      isLoading: false
    };
  }

  if (mode === GREETING_MODES.date) {
    return {
      title: formatDateLabel(now),
      sub: "",
      isClock: false,
      isQuote: false,
      isCustom: false,
      isPlaceholder: false,
      isLoading: false
    };
  }

  if (mode === GREETING_MODES.quote) {
    const quote = getDailyQuote();
    if (quote && quote.content) {
      return {
        title: quote.content,
        sub: quote.author || "",
        isClock: false,
        isQuote: true,
        isCustom: false,
        isPlaceholder: false,
        isLoading: false
      };
    }
    try {
      const mainTitle = document.getElementById("greeting");
      if (mainTitle && mainTitle.classList.contains("is-quote-error")) {
        return {
          title:
            typeof QUOTE_FETCH_ERROR_TEXT === "string"
              ? QUOTE_FETCH_ERROR_TEXT
              : "获取一言失败，请稍后点击重试",
          sub: "",
          isClock: false,
          isQuote: true,
          isCustom: false,
          isPlaceholder: false,
          isLoading: false
        };
      }
    } catch (_) {}
    return {
      title: "正在寻一句好话",
      sub: "",
      isClock: false,
      isQuote: true,
      isCustom: false,
      isPlaceholder: false,
      isLoading: true
    };
  }

  if (mode === GREETING_MODES.custom) {
    const custom = normalizeCustomText(currentCustomText);
    return {
      title: custom || "\u5199\u4e0b\u4e00\u53e5\u6b22\u8fce\u8bed\u2026",
      sub: "",
      isClock: false,
      isQuote: false,
      isCustom: true,
      isPlaceholder: !custom,
      isLoading: false
    };
  }

  return {
    title: getTimeGreeting(currentUsername, now.getHours()),
    sub: "",
    isClock: false,
    isQuote: false,
    isCustom: false,
    isPlaceholder: false,
    isLoading: false
  };
}

/**
 * 更新问候区预览
 */
function updateGreetingPreview(now = new Date()) {
  const titleEl = document.getElementById("greetingPreviewTitle");
  const subEl = document.getElementById("greetingPreviewSub");
  const preview = document.getElementById("greetingPreview");
  if (!titleEl || !preview) return;

  const content = resolveGreetingPreviewContent(now);
  const nextTitle = content.title || "";
  const nextSub = content.sub || "";
  const prevTitle = titleEl.textContent || "";
  const prevSub = subEl ? subEl.textContent || "" : "";
  const prevHidden = subEl ? !!subEl.hidden : true;
  const nextHidden = !nextSub;

  const changed =
    prevTitle !== nextTitle ||
    prevSub !== nextSub ||
    prevHidden !== nextHidden ||
    preview.dataset.mode !== (currentGreetingMode || GREETING_MODES.greeting);

  titleEl.textContent = nextTitle;
  titleEl.classList.toggle("is-clock", !!content.isClock);
  titleEl.classList.toggle("is-quote", !!content.isQuote);
  titleEl.classList.toggle("is-custom", !!content.isCustom);
  titleEl.classList.toggle("is-placeholder", !!content.isPlaceholder);
  titleEl.classList.toggle("is-loading", !!content.isLoading);

  if (subEl) {
    if (nextSub) {
      subEl.textContent = nextSub;
      subEl.hidden = false;
    } else {
      subEl.textContent = "";
      subEl.hidden = true;
    }
  }

  preview.dataset.mode = currentGreetingMode || GREETING_MODES.greeting;

  if (changed) {
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      titleEl.classList.remove("is-animating");
      if (subEl) subEl.classList.remove("is-animating");
      void titleEl.offsetWidth;
      titleEl.classList.add("is-animating");
      if (subEl && !subEl.hidden) subEl.classList.add("is-animating");
      if (titleEl._animTimer) clearTimeout(titleEl._animTimer);
      titleEl._animTimer = setTimeout(() => {
        titleEl.classList.remove("is-animating");
        if (subEl) subEl.classList.remove("is-animating");
        titleEl._animTimer = null;
      }, 300);
    }
  }
}

function updateGreetingDisplay() {
  const title = document.getElementById("greeting");
  if (!title) {
    updateGreetingPreview();
    return;
  }

  const now = new Date();
  const mode = currentGreetingMode;

  if (mode === GREETING_MODES.clock) {
    title.classList.remove("is-quote-loading");
    title.textContent = formatClock(now);
    setGreetingSub(currentClockShowDate ? formatDateLabel(now) : "");
    updateGreetingPreview(now);
    return;
  }

  if (mode === GREETING_MODES.date) {
    title.classList.remove("is-quote-loading");
    title.textContent = formatDateLabel(now);
    setGreetingSub("");
    updateGreetingPreview(now);
    return;
  }

  if (mode === GREETING_MODES.quote) {
    // 刷新/切换进行中，跳过
    if (quoteSwitching || quoteBootLoading || sessionQuotePromise) {
      updateGreetingPreview(now);
      return;
    }

    const quote = getDailyQuote();
    if (!quote) {
      // 尚未加载过一言，触发预取
      if (!quoteSessionReady && !sessionQuotePromise) {
        prefetchDailyQuoteOnLoad();
      }
      updateGreetingPreview(now);
      return;
    }

    // 缓存与 DOM 不一致时强制同步
    if (normalizeQuoteText(title.textContent) !== normalizeQuoteText(quote.content)) {
      forceShowQuote(quote);
    } else {
      setGreetingSub(quote.author || "");
    }
    updateGreetingPreview(now);
    return;
  }

  if (mode === GREETING_MODES.custom) {
    title.classList.remove("is-quote-loading");
    const custom = normalizeCustomText(currentCustomText);
    title.textContent = custom || "\u5199\u4e0b\u4e00\u53e5\u6b22\u8fce\u8bed\u2026";
    title.classList.toggle("is-custom-placeholder", !custom);
    setGreetingSub("");
    updateGreetingPreview(now);
    return;
  }

  title.classList.remove("is-quote-loading", "is-custom-placeholder");
  title.textContent = getTimeGreeting(currentUsername, now.getHours());
  setGreetingSub("");
  updateGreetingPreview(now);
}

/** @deprecated 已合并到 updateGreetingDisplay */
function updateTime() {
  updateGreetingDisplay();
}
