import re
from fontTools.ttLib import TTFont

css = open('icons/font/Mingcute.css', encoding='utf-8').read()
rules = re.findall(r'\.(mgc_[A-Za-z0-9_]+)\s*:\s*before\s*\{\s*content\s*:\s*"([^"]*)"', css)
print('规则数:', len(rules))

font = TTFont('icons/font/MingCute.woff2')
cmap = set()
for t in font['cmap'].tables:
    cmap.update(t.cmap.keys())
print('字形数:', len(cmap))

missing = []
for name, content in rules:
    for hexpart in re.findall(r'\\([0-9a-fA-F]{4})', content):
        if int(hexpart, 16) not in cmap:
            missing.append((name, hexpart))
print('缺失字形:', missing if missing else '无')
print('示例:', rules[:3])
