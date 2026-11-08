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
    const gap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
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
})();
