"""
按实际用到的图标类裁剪 MingCute。

图标字体原样是 1MB（3326 个字形）+ 244KB CSS，其中项目只用了 60 多个。
这个脚本：
  1. 扫描 newtab.html / js / css 里出现的 mgc_ 类名
  2. 从 Mingcute.full.css 里挑出对应规则，生成精简版 Mingcute.css
  3. 把字体子集化成只含这些字形，输出 woff2

用法：python scripts/build-icon-subset.py
源文件：icons/font/Mingcute.full.css、icons/font/MingCute.ttf
产物：  icons/font/Mingcute.css、icons/font/MingCute.woff2
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'icons', 'font')
FULL_CSS = os.path.join(FONT_DIR, 'Mingcute.full.css')
OUT_CSS = os.path.join(FONT_DIR, 'Mingcute.css')
SRC_FONT = os.path.join(FONT_DIR, 'MingCute.ttf')
OUT_FONT = os.path.join(FONT_DIR, 'MingCute.woff2')

CLASS_RE = re.compile(r'mgc_[A-Za-z0-9_]+')


def collect_used():
    files = [os.path.join(ROOT, 'newtab.html')]
    for pattern in ('js/**/*.js', 'css/**/*.css'):
        files += glob.glob(os.path.join(ROOT, pattern), recursive=True)
    used = set()
    for path in files:
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        if rel.startswith('dist-web/') or rel.startswith('node_modules/'):
            continue
        try:
            text = open(path, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        used.update(CLASS_RE.findall(text))
    used.discard('mgc_')
    return used


def main():
    if not os.path.exists(FULL_CSS):
        if not os.path.exists(OUT_CSS):
            sys.exit('找不到 Mingcute.full.css')
        # 首次运行：把当前文件当作全量源
        os.replace(OUT_CSS, FULL_CSS)

    used = collect_used()
    css = open(FULL_CSS, encoding='utf-8').read()

    head_end = css.index('.mgc_')
    head = css[:head_end]
    # 字体只剩子集版 woff2，去掉 woff/ttf 的兜底，避免浏览器回退到 1MB 全量
    head = re.sub(
        r'src:\s*[^;]+;',
        "src: url('MingCute.woff2') format('woff2');",
        head,
        count=1,
        flags=re.S,
    )

    blocks = re.findall(r'\.(mgc_[A-Za-z0-9_]+):before\s*\{([^}]*)\}', css)
    picked = {}
    for name, body in blocks:
        m = re.search(r'content:\s*"([^"]+)"', body)
        if m:
            picked[name] = m.group(1)

    missing = sorted(used - set(picked))
    keep = sorted(used & set(picked))

    rules = ['.%s:before{content:"%s"}' % (n, picked[n]) for n in keep]
    out = head + '\n'.join(rules) + '\n'
    open(OUT_CSS, 'w', encoding='utf-8', newline='\n').write(out)

    codepoints = set()
    for name in keep:
        content = picked[name]
        for part in re.findall(r'\\([0-9a-fA-F]{4})', content):
            codepoints.add(int(part, 16))
    # 兜一个空格和替换字符，避免缺字显示异常
    codepoints.update({0x20})

    from fontTools import subset

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.recalc_timestamp = False
    opts.drop_tables += ['DSIG']
    opts.hinting = False
    opts.name_IDs = ['*']
    font = subset.load_font(SRC_FONT, opts)
    s = subset.Subsetter(options=opts)
    s.populate(unicodes=codepoints)
    s.subset(font)
    font.save(OUT_FONT)
    font.close()

    print('用到图标 %d 个，命中规则 %d 个' % (len(used), len(keep)))
    if missing:
        print('CSS 里找不到的类（会显示空白）：' + ', '.join(missing))
    print('CSS  %6d KB' % (os.path.getsize(OUT_CSS) // 1024))
    print('字体 %6d KB' % (os.path.getsize(OUT_FONT) // 1024))


if __name__ == '__main__':
    main()
