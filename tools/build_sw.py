"""Generate sw.js with a precache list and a content-hash version.

Run from the project folder before each commit:  python tools/build_sw.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'
EXTRA_CDN = [
    'https://cdn.jsdelivr.net/npm/nipplejs@1.0.4/+esm',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.esm.js',
    'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap',
]
INCLUDE = ['index.html', 'manifest.webmanifest']
INCLUDE_DIRS = ['css', 'js', 'content', 'assets']
SKIP_EXT = {'.md', '.py', '.tif', '.gif', '.raw'}
SKIP_NAMES = {'zones.raw.json'}


def collect():
    files = [ROOT / f for f in INCLUDE if (ROOT / f).exists()]
    for d in INCLUDE_DIRS:
        for p in sorted((ROOT / d).rglob('*')):
            if p.is_file() and p.suffix.lower() not in SKIP_EXT and p.name not in SKIP_NAMES:
                files.append(p)
    return files


def main():
    files = collect()
    h = hashlib.sha1()
    for p in files:
        h.update(p.relative_to(ROOT).as_posix().encode())
        h.update(p.read_bytes())
    h.update((ROOT / 'tools' / 'sw.template.js').read_bytes())
    version = h.hexdigest()[:10]
    local = ['./'] + [p.relative_to(ROOT).as_posix() for p in files]
    addons = set()
    for p in (ROOT / 'js').rglob('*.js'):
        for m in re.finditer(r"""['"]three/addons/([^'"]+)['"]""", p.read_text(encoding='utf-8')):
            addons.add(m.group(1))
    cdn = [THREE + 'build/three.module.js'] + [THREE + 'examples/jsm/' + a for a in sorted(addons)] + EXTRA_CDN
    tpl = (ROOT / 'tools' / 'sw.template.js').read_text(encoding='utf-8')
    out = (tpl.replace('__VERSION__', version)
              .replace('__LOCAL__', json.dumps(local, indent=2))
              .replace('__CDN__', json.dumps(cdn, indent=2)))
    (ROOT / 'sw.js').write_text(out, encoding='utf-8')
    size = sum(p.stat().st_size for p in files)
    print(f'sw.js written: version {version}, {len(local)} local files ({size / 1e6:.1f} MB), {len(cdn)} CDN files')


if __name__ == '__main__':
    main()
