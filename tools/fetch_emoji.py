"""Download every Twemoji picture the app uses into assets/emoji/.

Scans js/ and content/ for emoji characters, works out Twemoji's file name for each, and fetches
any that are missing from jsDelivr (Twemoji 14.0.2, graphics CC BY 4.0).
Run from the project folder: python tools/fetch_emoji.py
"""
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'emoji'
BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/'


def is_pict(cp):
    return (0x1F000 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF or 0x2300 <= cp <= 0x23FF
            or 0x2B00 <= cp <= 0x2BFF or 0x2190 <= cp <= 0x21FF or cp in (0x3030, 0x303D, 0x3297, 0x3299, 0x00A9, 0x00AE))


def clusters(text):
    out, cur, join = [], '', False
    for ch in text:
        cp = ord(ch)
        attach = cp in (0xFE0F, 0x200D, 0x20E3) or 0x1F3FB <= cp <= 0x1F3FF or join
        if cur and attach:
            cur += ch
        else:
            if cur:
                out.append(cur)
            cur = ch if is_pict(cp) else ''
        join = cp == 0x200D
    if cur:
        out.append(cur)
    return [c for c in out if c and is_pict(ord(c[0]))]


def filename(e):
    raw = e if '‍' in e else e.replace('️', '')
    return '-'.join(f'{ord(c):x}' for c in raw) + '.svg'


def main():
    found = set()
    for p in list((ROOT / 'js').rglob('*.js')) + list((ROOT / 'content').rglob('*.json')):
        for e in clusters(p.read_text(encoding='utf-8')):
            found.add(e)
    OUT.mkdir(parents=True, exist_ok=True)
    got, missing = 0, []
    for e in sorted(found):
        name = filename(e)
        dest = OUT / name
        if dest.exists():
            continue
        try:
            with urllib.request.urlopen(BASE + name, timeout=20) as r:
                data = r.read()
            if not data.lstrip().startswith(b'<svg'):
                raise ValueError('not an svg')
            dest.write_bytes(data)
            got += 1
        except Exception as ex:
            missing.append((e, name, str(ex)))
    print(f'{len(found)} emoji used, {got} downloaded, {len(list(OUT.glob("*.svg")))} on disk')
    for e, name, ex in missing:
        print('  missing', repr(e), name, ex)
    if missing and '--strict' in sys.argv:
        sys.exit(1)


if __name__ == '__main__':
    main()
