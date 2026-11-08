/**
 * MoonFog - 软键盘可视区
 *
 * 手机软键盘弹出时，浏览器默认只缩小「可视视口」（visualViewport），
 * 布局视口（innerHeight）不变，于是 position: fixed 的元素仍贴在原来的屏幕底部，
 * 被键盘整个盖住。这里把被键盘吃掉的高度算出来写到 --kb-h，
 * 并在 body 上打 kb-open，由 css/mobile.css 把搜索框搬到键盘上方。
 *
 * 键盘收起（或用户双指缩放）时高度归零、类移除，页面自动回到原布局。
 */

(function () {
  const vv = window.visualViewport;
  if (!vv) return;

  const root = document.documentElement;
  // 低于这个高度不算键盘：地址栏收起/展开、滚动回弹通常只有几十像素
  const KEYBOARD_MIN = 120;
  let lastHeight = -1;
  let frame = 0;

  function apply(height) {
    if (height === lastHeight) return;
    lastHeight = height;
    root.style.setProperty('--kb-h', height + 'px');
    document.body.classList.toggle('kb-open', height > 0);
    window.dispatchEvent(new CustomEvent('moonfog:keyboard', { detail: { height } }));
  }

  function measure() {
    frame = 0;
    // 双指缩放同样会让可视视口变矮，但那是缩放不是键盘
    if (vv.scale > 1.02) {
      apply(0);
      return;
    }
    // 键盘顶部在布局视口里的位置 = 可视视口顶部偏移 + 可视视口高度，
    // 用 innerHeight 减掉即为底部被占的高度
    const viewportH = window.innerHeight;
    let gap = Math.round(viewportH - vv.height - vv.offsetTop);
    // 安卓 Chrome 有时把键盘区算得比视觉键盘高：多出来的一截是浏览器自己的
    // 底部栏（页面画不进去，只有 body 背景透出来），搜索框会离键盘空一大段。
    // 竖屏下键盘超过视口 46% 基本可判定为这种多报，按 40% 记重新贴回键盘；
    // 常见键盘 37%–45% 与横屏（键盘本来就过半）都不受影响。
    if (gap > viewportH * 0.46 && viewportH > window.innerWidth) {
      gap = Math.round(viewportH * 0.4);
    }
    apply(gap > KEYBOARD_MIN ? gap : 0);
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(measure);
  }

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 260));
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
        'applied     ' + lastHeight
      ].join('\n');
      requestAnimationFrame(paint);
    };
    paint();
  }
})();
