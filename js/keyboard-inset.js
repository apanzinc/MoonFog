/**
 * MoonFog - 软键盘可视区
 *
 * 手机软键盘弹出时，浏览器默认只缩小「可视视口」（visualViewport），
 * 布局视口（innerHeight）不变，于是 position: fixed 的元素仍贴在原来的屏幕底部，
 * 被键盘整个盖住。这里把被键盘吃掉的高度算出来写到 --kb-h，
 * 并在 body 上打 kb-open，由 css/mobile.css 切成「搜索框吸顶、整页锁死」的布局。
 *
 * 键盘收起（或用户双指缩放）时高度归零、类移除，页面自动回到原布局。
 */

(function () {
  const vv = window.visualViewport;
  if (!vv) return;

  const root = document.documentElement;
  // 低于这个高度不算键盘：地址栏收起/展开、滚动回弹通常只有几十像素
  const KEYBOARD_MIN = 120;
  // 键盘态搜索框顶边距（px），和 main.css 里键盘态的 padding 一致
  const KEYBOARD_TOP = 14;
  // 布局切换的手感由 css 的 --kb-motion / --ease 决定（.content 自己过渡 transform），
  // 这里不再持有第二份时长
  // 键盘态只剩搜索框一块要挪，问候语与快捷标签直接 display: none，
  // 量它们的 rect 只会拿到 0，混进位移计算会把距离算歪
  const SECTION = '.content > .search-section';
  let lastHeight = -1;
  let lastVisible = -1;
  let frame = 0;
  // 「没有键盘时」的布局视口高度，两种键盘模式都要拿它做基准
  let baseHeight = Math.round(window.innerHeight);
  // 壁纸层（.page-bg）在「没有键盘时」的实测高度。键盘一弹，布局视口被压矮，
  // fixed inset:0 和 100lvh 都会跟着缩，background-size/object-fit 的 cover
  // 于是重新裁剪一遍 —— 眼睛看到的就是「敲键盘时壁纸也在动」。记下原高度钉住它。
  let backdropHeight = 0;
  let backdropProbe = -1;
  // 键盘期间要钉住的内容区高度，以及「没键盘时」的视口高度（钉子的取值来源）。
  // 详见 switchLayout 的注释
  let naturalHeight = Math.round(window.innerHeight);
  let pinHeight = 0;
  let closeAt = 0;
  let pinTimer = 0;
  // .content 正在跑的那段位移动画（Web Animations 对象）
  let contentAnim = 0;

  /**
   * 壁纸层原高度：只在「视口变大」时量（地址栏收起那一下），
   * 记的是历史最大值。键盘弹起后视口变小，这里不会再量，
   * 也不会把缩小后的值写回去。css/base.css 里 .page-bg 用
   * height: max(100lvh, var(--bg-lock-h)) 读它，视口怎么缩都不动。
   * 量 rect 会强制一次布局，所以加了 innerHeight 变大的门槛，绝大多数帧都不量。
   */
  function measureBackdrop() {
    // 键盘开着时不量：那会儿视口是矮的，量出来就是缩小后的值
    if (document.body.classList.contains('kb-open')) return;
    const viewportH = Math.round(window.innerHeight);
    if (viewportH <= backdropProbe) return;
    backdropProbe = viewportH;
    const bg = document.querySelector('.page-bg');
    if (!bg) return;
    const h = Math.round(bg.getBoundingClientRect().height);
    if (h > 0 && h !== backdropHeight) {
      backdropHeight = h;
      root.style.setProperty('--bg-lock-h', h + 'px');
    }
  }

  /**
   * 布局在「居中」与「吸顶」之间是整块平移，没有可以单独插值的属性，
   * 所以把位移量算出来交给 css 的 --kb-lift，由 .content 自己过渡。
   *
   * 落点必须恒定（永远贴顶 14px），这要求「量位移时的布局」和「落地后的布局」
   * 是同一份。之前正是这里出的偏差：位移按当时那一份布局算（键盘弹到一半，
   * 布局视口已被压矮、上下两行 1fr 也跟着矮了），而键盘态用的是钉住的高度，
   * 两边行高不同，搜索框就随量取时机飘 —— 有时贴顶，有时掉到屏幕中间。
   *
   * 现在做两件事：
   * 1. 键盘期间把 .content 高度钉成「没键盘时的视口高度」（html.kb-hpin + --vp-max-h），
   *    键盘再怎么压矮布局视口，行高都不再变，落地位置是确定的；
   * 2. 换类之后重新量一次目标位置，按它算位移，再用 FLIP 把起点摆回换类前的视觉位置。
   *    这样无论换类那一帧布局有没有变，落点都等于 KEYBOARD_TOP。
   */
  /**
   * 逗号分隔的 css 值列表。不能直接 split(',')：cubic-bezier(0.32, 0.72, 0, 1)
   * 自己就带三个逗号，得跳过括号里的
   */
  function splitCssList(value) {
    const str = String(value || '');
    const out = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /**
   * 取 .content 上 transform 那一条过渡的时长与曲线。
   * .content 同时挂着三条过渡（left 让位、top 展开让位、transform 键盘平移），
   * computed 值因此是列表：直接 parseFloat 会拿到第一条的 0.3s，
   * 整串拿去当 easing 则直接抛「Easing may not be set to a list of values」，
   * animate() 一抛，下面的交互锁也没挂上，键盘态等于裸奔。
   * 所以按 transition-property 找到下标，再按 CSS 的列表循环规则取对应值
   */
  function transitionFor(cs, prop) {
    const props = splitCssList(cs.transitionProperty);
    const durations = splitCssList(cs.transitionDuration);
    const easings = splitCssList(cs.transitionTimingFunction);
    const pick = function (list, index, fallback) {
      if (!list.length) return fallback;
      return list[index % list.length] || fallback;
    };
    let index = props.indexOf(prop);
    if (index < 0) index = props.indexOf('all');
    if (index < 0) index = Math.max(props.length - 1, 0);
    return {
      duration: Math.round((parseFloat(pick(durations, index, '0.62s')) || 0.62) * 1000),
      easing: pick(easings, index, 'ease')
    };
  }

  function switchLayout(open) {
    const el = document.querySelector(SECTION);
    const content = document.querySelector('.content');
    if (!el || !content) {
      document.body.classList.toggle('kb-open', open);
      return;
    }

    // 上一段动画还没跑完就又要切（转屏重排、键盘在动画中途又被收放）。
    // 必须先 cancel：动画的 transform 优先级高于 --kb-lift，留着它，
    // 下面量到的 base 就是动画当前帧的位置，位移整个算歪。
    // 点不到搜索框的情况下这条路走不到，但状态不能只靠点击锁兜着
    if (contentAnim) {
      contentAnim.cancel();
      contentAnim = 0;
    }

    // 换类前的视觉位置：动画从这里起步，不能跳
    const before = el.getBoundingClientRect().top;

    if (open) {
      clearTimeout(pinTimer);
      pinTimer = 0;
      // 钉高度取「没键盘时的视口高度」和当下内容区高度里大的那个：
      // 前者扛住 dvh 跟着键盘缩，后者兜住内容比视口还长的情况
      pinHeight = Math.max(naturalHeight, Math.round(content.getBoundingClientRect().height));
      root.style.setProperty('--vp-max-h', pinHeight + 'px');
      root.classList.add('kb-hpin');
    } else {
      closeAt = performance.now();
    }

    document.body.classList.toggle('kb-open', open);

    // 时长和曲线取 css 里 transform 那一条（--kb-motion / --kb-ease），
    // 跟问候语、快捷标签的过渡同频。
    // 读之前先把可能残留的内联 transition 交还给 css，否则读到的是上一次的 'none'
    content.style.transition = '';
    const kbTrans = transitionFor(getComputedStyle(content), 'transform');
    const dur = kbTrans.duration;
    const ease = kbTrans.easing;

    // 先停掉 .content 自己的 transition：css 过渡的优先级高于动画，
    // 留着它会盖住下面的 animate()，表现就是「一帧直接到位」
    content.style.transition = 'none';

    // 位移归零，量到的是不含 transform 的布局位置。
    // 这里必须强制刷一次样式：改 --kb-lift 和改内联 transition 都还压在这一帧的
    // 样式队列里，直接读 rect 有机会读到上一帧的位置 —— 量到的 base 跟上一帧一样，
    // 起终点就算出同一个值，动画成了一帧到位（第二次开合时偶发）
    root.style.setProperty('--kb-lift', '0px');
    void content.offsetHeight;
    const base = el.getBoundingClientRect().top;

    // 起点是换类前的视觉位置，终点是贴顶（打开）或原布局位置（收起）
    const from = before - base;
    const to = (open ? KEYBOARD_TOP : base) - base;
    root.style.setProperty('--kb-lift', Math.round(to) + 'px');

    // 这一段必须用 animate()，不能交给 css transition：
    // 收起时起点和终点在同一个任务里改了两遍，浏览器拿上一帧和这一帧一比，
    // 发现首尾相等就判定「没有变化」，过渡根本不启动 —— 表现就是搜索框
    // 一帧硬跳回原位，而问候语还在慢慢淡入。animate() 直接给关键帧，不依赖这个判定
    const anim = content.animate(
      [{ transform: 'translateY(' + Math.round(from) + 'px)' },
       { transform: 'translateY(' + Math.round(to) + 'px)' }],
      { duration: dur, easing: ease }
    );
    contentAnim = anim;
    // 动画期间整块内容不接受点击：中途再点搜索框会立刻翻转键盘状态、
    // 在新动画上再叠一层重算，位移就只能靠猜。锁到这段动画结束为止
    setBusy(true);
    const done = function () {
      clearTimeout(unlockTimer);
      // 已经被后一段动画接管了，锁交给它
      if (contentAnim !== anim) return;
      contentAnim = 0;
      content.style.transition = '';
      setBusy(false);
    };
    // 兜底：万一这段动画既不 finish 也不 cancel（元素被移出文档之类），
    // 锁不能一直挂着 —— 那等于搜索框永久点不动
    const unlockTimer = setTimeout(done, dur + 400);
    anim.addEventListener('finish', done);
    anim.addEventListener('cancel', done);

    if (!open) scheduleRelease();
  }

  /**
   * 动画期间的交互锁。加在 body 上，由 css 关掉 .content 的 pointer-events。
   * 同一时刻只有一个动画真的在控制 .content，所以是布尔而不是计数：
   * 后一段动画接管时，前一段的结束回调会因为 contentAnim 已经不是自己而直接返回，
   * 不会提前解锁
   */
  function setBusy(on) {
    document.body.classList.toggle('kb-busy', on);
  }

  /**
   * 锁期间把指针事件整个吞掉。
   * 只有 css 的 pointer-events: none 不够：事件会穿透到 body，浏览器在
   * 「点到不可聚焦的地方」时会把输入框的焦点收走，键盘跟着收起 ——
   * 状态又翻了一次，等于没锁住。所以在捕获阶段就挡住，并且阻止默认行为
   */
  function swallowPointer(e) {
    if (!document.body.classList.contains('kb-busy')) return;
    // 主页的过渡锁不能吞掉引导、设置或其他模态层的交互。
    if (e.target.closest?.('#oobe, #settingsPanel, .settings-wrapper, .modal-overlay')) return;
    e.preventDefault();
    e.stopPropagation();
  }
  document.addEventListener('pointerdown', swallowPointer, true);
  document.addEventListener('touchstart', swallowPointer, { capture: true, passive: false });
  document.addEventListener('click', swallowPointer, true);

  /**
   * 拆掉高度钉子：收起动画走完、视口也长回来了，才把 .content 还给 100dvh。
   * 早拆一步都会看见搜索框在回落途中抽一下（那会儿 dvh 还矮着，行高会重算）。
   */
  function releasePin() {
    if (!root.classList.contains('kb-hpin')) return;
    if (document.body.classList.contains('kb-open')) return;
    // 位移动画还在跑就别拆：拆了高度会立刻变，动画算的是旧高度上的位置
    if (contentAnim) return;
    // 收起动画还没走完
    if (performance.now() - closeAt < 700) return;
    // 视口还没长回来
    if (Math.round(window.innerHeight) < naturalHeight - 4) return;
    // 拆之前先把位移归零：万一收起动画被打断，transform 还挂着，
    // 高度一放开就是「高度变了、位移还在」，搜索框直接被顶出屏幕
    if ((parseFloat(root.style.getPropertyValue('--kb-lift')) || 0) !== 0) {
      root.style.setProperty('--kb-lift', '0px');
    }
    root.classList.remove('kb-hpin');
    pinHeight = 0;
  }

  function scheduleRelease() {
    clearTimeout(pinTimer);
    let tries = 0;
    const step = function () {
      pinTimer = 0;
      releasePin();
      if (!root.classList.contains('kb-hpin')) return;
      // 视口长回来通常几帧内就完事，没等到就接着看
      if (++tries < 10) {
        pinTimer = setTimeout(step, 150);
        return;
      }
      // 一直等不到：只在「键盘确实收干净了」时才强拆，
      // 键盘还开着就留着，交给下一次 measure —— 硬拆会让高度从 844
      // 掉回 544，搜索框跟着被带出屏幕
      if (!document.body.classList.contains('kb-open') && !contentAnim
          && (parseFloat(root.style.getPropertyValue('--kb-lift')) || 0) === 0) {
        root.classList.remove('kb-hpin');
        pinHeight = 0;
      }
    };
    pinTimer = setTimeout(step, 720);
  }

  // 键盘态下，浏览器为了「露出输入框」会偷偷滚布局视口，页面一滑内容就飞出去。
  // 这里把滚动位置盯死在 0（只在键盘态生效，收起后不再干预）
  let lockFrame = 0;
  function keepTop() {
    // 非键盘态直接不排队：否则每次滚动都白跑一帧 rAF
    if (lockFrame || !document.body.classList.contains('kb-open')) return;
    lockFrame = requestAnimationFrame(function () {
      lockFrame = 0;
      if (!document.body.classList.contains('kb-open')) return;
      if (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop) {
        window.scrollTo(0, 0);
      }
    });
  }
  window.addEventListener('scroll', keepTop, { passive: true });

  function apply(height) {
    const open = height > 0;
    // 「键盘上方还剩多少」只有键盘态才用得上（html.kb-lock / body.kb-open 读它），
    // 非键盘态写它没有任何视觉效果，却会让整份文档的样式缓存失效。
    // 首屏地址栏伸缩时 visualViewport 会连发几十次 resize，
    // 每帧写一次根变量 = 每帧全文档重算样式，这就是「一打开卡一下」的来源。
    // 所以：只在键盘态写，且值变了才写
    if (open) {
      const visible = Math.min(Math.round(vv.height), Math.round(window.innerHeight));
      if (visible !== lastVisible) {
        lastVisible = visible;
        root.style.setProperty('--vv-h', visible + 'px');
      }
    }
    if (height === lastHeight) return;
    lastHeight = height;
    const wasOpen = document.body.classList.contains('kb-open');
    root.style.setProperty('--kb-h', height + 'px');
    root.classList.toggle('kb-lock', open);
    if (open !== wasOpen) switchLayout(open);
    if (open) keepTop();
    window.dispatchEvent(new CustomEvent('moonfog:keyboard', { detail: { height } }));
  }

  function measure() {
    frame = 0;
    const mobile = window.matchMedia('(max-width: 600px), (pointer: coarse) and (hover: none) and (max-width: 915px)').matches;
    const overlay = document.body.classList.contains('oobe-active') || document.body.classList.contains('settings-open') || document.querySelector('.modal-overlay.active');
    const searching = document.activeElement?.id === 'searchInput';
    if (!mobile || overlay) {
      // 模态输入框让原生视口负责露出；不要移动被盖住的主页，也不要留下全页点击锁。
      const wasOpen = document.body.classList.contains('kb-open');
      clearTimeout(pinTimer); pinTimer = 0;
      const previous = contentAnim; contentAnim = 0;
      if (previous) previous.cancel();
      const content = document.querySelector('.content');
      if (content) content.style.transition = '';
      document.body.classList.remove('kb-open', 'kb-busy');
      root.classList.remove('kb-lock', 'kb-hpin');
      root.style.setProperty('--kb-lift', '0px');
      root.style.setProperty('--kb-h', '0px');
      lastHeight = 0; lastVisible = -1; pinHeight = 0;
      baseHeight = naturalHeight = Math.round(window.innerHeight);
      if (wasOpen) window.dispatchEvent(new CustomEvent('moonfog:keyboard', { detail: { height: 0 } }));
      return;
    }
    // 未聚焦搜索时的窗口缩放、工具栏变化不算软键盘。已打开时仍跟踪收起动画。
    if (!searching && !document.body.classList.contains('kb-open')) {
      baseHeight = naturalHeight = Math.round(window.innerHeight);
      measureBackdrop();
      return;
    }
    // 壁纸层原高度先记下来（键盘还没弹的时候才量得到真实值）
    measureBackdrop();
    // 双指缩放同样会让可视视口变矮，但那是缩放不是键盘
    if (vv.scale > 1.02) {
      apply(0);
      return;
    }
    // 键盘升降的中间帧可能读到接近 0 的高度，那一下会把 --kb-h 算成整屏，
    // 内容区被撑到屏幕外，等读数稳定它自己又跳回来 —— 直接跳过这种帧
    if (!vv.height || vv.height < 60) return;

    // 键盘吃掉多少高度，取决于浏览器用哪种方式处理：
    // · interactive-widget=resizes-content（安卓 Chrome 认这个参数）：布局视口被压小，
    //   innerHeight 跟着缩，可视视口一起变，两者差值恒为 0；
    // · 默认的 overlays-content（iOS Safari、不认这参数的浏览器）：布局视口不动，
    //   只有可视视口变矮。
    // 只认一种的话另一边永远检测不到键盘，所以两种差值取大的
    const byLayout = baseHeight - Math.round(window.innerHeight);
    const byOverlay = Math.round(window.innerHeight - vv.height - vv.offsetTop);
    let gap = Math.max(byLayout, byOverlay, 0);
    // 安卓 Chrome 有时把键盘区算得比视觉键盘高：多出来的一截是浏览器自己的
    // 底部栏（页面画不进去，只有 body 背景透出来），建议面板会离键盘空一大段。
    // 竖屏下键盘超过视口 46% 基本可判定为这种多报，按 40% 记；
    // 常见键盘 37%–45% 与横屏（键盘本来就过半）都不受影响。
    const viewportH = Math.round(window.innerHeight);
    if (gap > viewportH * 0.46 && viewportH > window.innerWidth) {
      gap = Math.round(viewportH * 0.4);
    }
    // 兜底上限：键盘再高也占不到 62% 以上，超出就是读数抽风
    gap = Math.max(0, Math.min(gap, Math.round(viewportH * 0.62)));
    // 基准只在页面更高时上抬（地址栏收起会让 innerHeight 变大），
    // 绝不跟着键盘一起缩，否则第二帧就把键盘算成「没有」
    baseHeight = Math.max(baseHeight, viewportH);
    if (gap <= KEYBOARD_MIN) {
      // 没键盘时记下视口高度，键盘弹起后拿它钉内容区高度。
      // 钉子还在的时候不能记：那会儿高度是被我们钉住的，记进去就成了自己咬自己
      if (!root.classList.contains('kb-hpin')) naturalHeight = viewportH;
      // 视口长回来了就拆钉子（收起动画走完才会真的拆）
      releasePin();
    }
    apply(gap > KEYBOARD_MIN ? gap : 0);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(measure);
  }

  // 横竖屏切换会把 innerHeight 整个换掉，基准必须跟着重置，
  // 否则从竖屏转横屏会凭空算出一次「键盘」
  function resetBase() {
    baseHeight = Math.round(window.innerHeight);
    naturalHeight = baseHeight;
    // 壁纸高度也跟着重来：横屏只有竖屏的一半，旧值会一直顶在上面下不来
    backdropProbe = -1;
    backdropHeight = 0;
    root.style.setProperty('--bg-lock-h', '0px');
    // 高度钉子一起拆：横屏的内容区高度跟竖屏完全不是一回事
    root.classList.remove('kb-hpin');
    pinHeight = 0;
    schedule();
    // 转屏时键盘还开着的话，按新视口重新钉一次、重新算落点，
    // 否则一直顶着竖屏的行高，搜索框在横屏里会跑到可视区外
    setTimeout(function () {
      if (document.body.classList.contains('kb-open')) switchLayout(true);
    }, 300);
  }

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  window.addEventListener('orientationchange', () => setTimeout(resetBase, 260));
  window.addEventListener('pageshow', (e) => { if (e.persisted) resetBase(); });
  measure();

  // 诊断：地址栏加 ?kbdebug=1 时，把实测值贴在左上角，方便对真机校准
  if (location.search.includes('kbdebug')) {
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;margin:0;padding:8px;'
      + 'font:12px/1.5 ui-monospace,monospace;background:#000c;color:#fff;border-radius:8px;'
      + 'pointer-events:none;white-space:pre';
    document.body.appendChild(box);
    const paint = () => {
      box.textContent = [
        'innerHeight ' + window.innerHeight,
        'vv.height   ' + Math.round(vv.height),
        'vv.offsetTop ' + Math.round(vv.offsetTop),
        'raw gap     ' + Math.round(window.innerHeight - vv.height - vv.offsetTop),
        'applied     ' + lastHeight,
        'natural     ' + naturalHeight,
        'pin         ' + (root.classList.contains('kb-hpin') ? pinHeight : 0),
        'lift        ' + getComputedStyle(root).getPropertyValue('--kb-lift').trim()
      ].join('\n');
      requestAnimationFrame(paint);
    };
    paint();
  }
})();
