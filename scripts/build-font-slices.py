"""
把全量思源宋体切成按字频排序的 unicode-range 分片。

目的：字形一个都不删（用户自定义文案里的生僻字照样能显示），
但首屏只下载「当前页面真正用到的那几片」，不用每次都吞 1.5MB。

分档：
  A 项目文案用字 + ASCII + 拉丁 + 中文标点 + 全角  → 首屏命中的就是这档
  B 高频字（常见口语/书面用字）                     → 用户改文案时按需补
  C GB2312 一级字剩余（次常用）
  D 其余全部

用法：
  python scripts/build-font-slices.py
产出：
  fonts/slices/SourceHanSerifSC-<Weight>-<tier>.woff2
  css/font-slices.css
"""

import glob
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'fonts', 'slices')
CSS_OUT = os.path.join(ROOT, 'css', 'font-slices.css')

WEIGHTS = {
    'Regular': 400,
    'Medium': 500,
    'SemiBold': 600,
    'Bold': 700,
}

# 常见高频字。只影响「哪一片先下载」，不影响能不能显示。
HIGH_FREQ = """
的一不是了在有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后
多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合
还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条
只没结解问意建月公无系军很情者最立代想已通并提直题程展五果料象员位入常文总次品式活设及管特件长求老头基资边
流路级少图山统接知较将组见计别手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造
百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车
例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律
叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历
市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包
火住调满县局照参红细引听该铁价严龙飞早晨夜晚安你好谢对起再见面问候设置主题背景壁纸张图片颜色深浅色调字体粗细
"""

EXTRA_SYMBOLS = (
    list(range(0x20, 0x7F))       # ASCII
    + list(range(0xA0, 0x100))    # Latin-1
    + list(range(0x2000, 0x2070)) # 通用标点
    + list(range(0x3000, 0x3040)) # CJK 标点
    + list(range(0xFF00, 0xFFF0)) # 全角字符
)


def project_chars():
    chars = set()
    patterns = ['*.html', 'js/**/*.js', 'css/**/*.css']
    skip = ('dist-web', '.oil-ui', 'node_modules', 'vendor')
    files = []
    for pat in patterns:
        files.extend(glob.glob(os.path.join(ROOT, pat), recursive=True))
    for path in files:
        rel = path.replace('\\', '/')
        if any(s in rel for s in skip):
            continue
        try:
            text = open(path, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        for ch in text:
            if '\u4e00' <= ch <= '\u9fff':
                chars.add(ord(ch))
    return chars


def gb2312_level1():
    """GB2312 一级汉字（0xB0A1-0xD7F9）：3755 个最常用字"""
    out = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode('gb2312')
            except UnicodeDecodeError:
                continue
            out.add(ord(ch))
    return out


def compress_ranges(cps):
    cps = sorted(cps)
    if not cps:
        return ''
    parts = []
    start = prev = cps[0]
    for c in cps[1:]:
        if c == prev + 1:
            prev = c
            continue
        parts.append((start, prev))
        start = prev = c
    parts.append((start, prev))
    out = []
    for a, b in parts:
        out.append('U+%X' % a if a == b else 'U+%X-%X' % (a, b))
    return ','.join(out)


def build_tiers(all_cps):
    ui = project_chars()
    freq = {ord(c) for c in HIGH_FREQ if '\u4e00' <= c <= '\u9fff'}
    symbols = {c for c in EXTRA_SYMBOLS if c in all_cps}
    level1 = gb2312_level1()

    tier_a = (ui | symbols) & all_cps
    tier_b = (freq - tier_a) & all_cps
    tier_c = (level1 - tier_a - tier_b) & all_cps
    tier_d = all_cps - tier_a - tier_b - tier_c

    tiers = [('a', tier_a), ('b', tier_b), ('c', tier_c), ('d', tier_d)]
    covered = set()
    for _, cps in tiers:
        covered |= cps
    missing = all_cps - covered
    if missing:
        print('!! 覆盖缺口:', sorted(missing)[:10], file=sys.stderr)
    return tiers


def slice_font(src, cps, out_path):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_legacy = True
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.recalc_timestamp = False
    opts.hinting = False
    opts.drop_tables += ['DSIG']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    font.save(out_path)
    font.close()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # 先取一份全量字体的 cmap 作为全集
    ref = TTFont(os.path.join(ROOT, 'fonts', 'SourceHanSerifSC-Bold.woff2'))
    all_cps = set()
    for table in ref['cmap'].tables:
        all_cps.update(table.cmap.keys())
    ref.close()

    tiers = build_tiers(all_cps)
    print('全集 %d 个码点' % len(all_cps))
    for name, cps in tiers:
        print('  档 %s: %d 字' % (name.upper(), len(cps)))

    css_lines = [
        '/**',
        ' * 自动生成：scripts/build-font-slices.py',
        ' * 全量思源宋体按 unicode-range 分片；字形没删，只是按需下载。',
        ' */',
        '',
    ]

    total_in = total_out = 0
    for weight_name, weight_value in WEIGHTS.items():
        src = os.path.join(ROOT, 'fonts', 'SourceHanSerifSC-%s.woff2' % weight_name)
        total_in += os.path.getsize(src)
        for tier_name, cps in tiers:
            out_name = 'SourceHanSerifSC-%s-%s.woff2' % (weight_name, tier_name)
            out_path = os.path.join(OUT_DIR, out_name)
            # 同权重同档的码点集合固定，只为第一个权重真正切片，其余按需
            slice_font(src, cps, out_path)
            size = os.path.getsize(out_path)
            total_out += size
            css_lines.append('/* %s %d — %d 字，%.0f KB */' % (weight_name, weight_value, len(cps), size / 1024))
            css_lines.append('@font-face {')
            css_lines.append("  font-family: 'SourceHanSerif';")
            css_lines.append("  src: url('../fonts/slices/%s') format('woff2');" % out_name)
            css_lines.append('  font-weight: %d;' % weight_value)
            css_lines.append('  font-style: normal;')
            css_lines.append('  font-display: swap;')
            css_lines.append('  unicode-range: %s;' % compress_ranges(cps))
            css_lines.append('}')
            css_lines.append('')

    open(CSS_OUT, 'w', encoding='utf-8').write('\n'.join(css_lines))
    print('原字体合计 %.1f MB → 分片合计 %.1f MB（首屏只取 A 档）' % (total_in / 1048576, total_out / 1048576))
    print('CSS: %s (%.0f KB)' % (CSS_OUT, os.path.getsize(CSS_OUT) / 1024))


if __name__ == '__main__':
    main()
