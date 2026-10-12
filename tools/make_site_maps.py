"""Build the site from the painted map.

Writes assets/site/map.jpg (the ground texture), assets/site/site.json (zones per cell and a
height grid) and, with --debug <png>, an overlay for checking by eye.

Zones per cell (60 x 42): m meadow, b beach, f forest, w sea, p waterfall pool, r river, c rock.
Run from the project folder: python tools/make_site_maps.py [--debug out.png]
"""
import json
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'reference' / 'site-map.webp'
W, D = 60, 42
RES = 2                      # height samples per cell
HW, HD = W * RES + 1, D * RES + 1
WATERFALL = (37.6, 13.6)     # foot of the falls, in cells
GATE = (31, 18)              # where pupils arrive along the path
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def inside(x, z):
    return 0 <= x < W and 0 <= z < D


def cells(img):
    small = img.resize((W * 8, D * 8), Image.LANCZOS)
    data = small.load()
    return [[[data[x * 8 + i, z * 8 + j] for i in range(8) for j in range(8)] for x in range(W)] for z in range(D)]


def classify(px):
    n = len(px)

    def frac(f):
        return sum(1 for p in px if f(*p)) / n
    water = frac(lambda r, g, b: b > r + 30 and b > 120)
    sand = frac(lambda r, g, b: r > 185 and g > 170 and b > 135)
    meadow = frac(lambda r, g, b: g > 165 and r > 140 and b < 125 and g >= r - 5)
    rock = frac(lambda r, g, b: max(r, g, b) - min(r, g, b) < 30 and max(r, g, b) > 100)
    if water > 0.5:
        return 'w'
    if sand > 0.4:
        return 'b'
    if meadow > 0.6:
        return 'm'
    if rock > 0.35:
        return 'c'
    if water > 0.2 and sand > 0.15:
        return 'b'
    return 'f'


def flood(grid, start, ok):
    seen = {start}
    q = deque([start])
    while q:
        x, z = q.popleft()
        for dx, dz in N4:
            nx, nz = x + dx, z + dz
            if inside(nx, nz) and (nx, nz) not in seen and ok(grid[nz][nx]):
                seen.add((nx, nz))
                q.append((nx, nz))
    return seen


def main():
    img = Image.open(SRC).convert('RGB')
    px = cells(img)
    g = [[classify(px[z][x]) for x in range(W)] for z in range(D)]

    # Meadow: everything light (m or b) connected to the middle of the meadow, then fill small holes.
    meadow = flood(g, (15, 26), lambda c: c in 'mb')
    for (x, z) in meadow:
        g[z][x] = 'm'
    for z in range(D):
        for x in range(W):
            if g[z][x] == 'm' and (x, z) not in meadow:
                g[z][x] = 'f'                       # light grass patches in the forest
            if g[z][x] == 'b' and not (x >= 33 and z >= 22):
                g[z][x] = 'c' if z < 14 else 'f'    # pale rocks and paths are not beach
    for _ in range(2):
        for z in range(D):
            for x in range(W):
                if g[z][x] != 'm' and 2 < x < 32 and 17 < z < 40:
                    n = sum(1 for dx, dz in N4 if inside(x + dx, z + dz) and g[z + dz][x + dx] == 'm')
                    if n >= 3:
                        g[z][x] = 'm'

    # Water bodies: the one touching the bottom right is the sea; the one under the falls is the pool.
    seen = set()
    comps = []
    for z in range(D):
        for x in range(W):
            if g[z][x] == 'w' and (x, z) not in seen:
                c = flood(g, (x, z), lambda c: c == 'w')
                seen |= c
                comps.append(c)
    for c in comps:
        if (W - 1, D - 1) in c or min(x for x, z in c) >= 53:
            tag = 'w'
        elif any(abs(x - 37) <= 2 and abs(z - 15) <= 1 for x, z in c):
            tag = 'p'
        else:
            tag = 'r'
        for x, z in c:
            g[z][x] = tag

    # Beach: sandy cells near the sea that the classifier called forest or rock.
    for z in range(D):
        for x in range(W):
            if g[z][x] in 'fc' and 34 <= x <= 52 and 24 <= z <= 34:
                near = any(inside(x + dx, z + dz) and g[z + dz][x + dx] in 'wb' for dx in (-1, 0, 1) for dz in (-1, 0, 1))
                r, gg, b = [sum(p[i] for p in px[z][x]) / 64 for i in range(3)]
                if near and r > 150 and b > 110:
                    g[z][x] = 'b'
    # The falls themselves (white water down the cliff) count as river, and so does the stream
    # from the pool down to the cove under the little bridge.
    for x, z in ((36, 11), (37, 11), (36, 12), (37, 12), (38, 12), (36, 13), (37, 13), (38, 13),
                 (46, 17), (46, 18), (47, 18), (47, 19), (47, 20), (48, 20), (48, 21), (48, 22), (48, 23), (48, 24)):
        g[z][x] = 'r'
    zones = [''.join(r) for r in g]

    # A flat clearing beside the waterfall pool (south of the falls), so a chill-out room can go there.
    pool = [(x, z) for z in range(D) for x in range(W) if g[z][x] == 'p']
    clearing = set()
    for z in range(15, D):
        for x in range(W):
            if g[z][x] in 'fc' and any(max(abs(x - px), abs(z - pz)) <= 2 for px, pz in pool):
                g[z][x] = 'f'
                clearing.add((x, z))
    zones = [''.join(r) for r in g]

    # Heights. Flat at 0 on meadow, beach and the clearing; land rises with distance from them; water sits low.
    dist = [[99] * W for _ in range(D)]
    q = deque()
    for z in range(D):
        for x in range(W):
            if g[z][x] in 'mb' or (x, z) in clearing:
                dist[z][x] = 0
                q.append((x, z))
    while q:
        x, z = q.popleft()
        for dx, dz in N4:
            nx, nz = x + dx, z + dz
            if inside(nx, nz) and dist[nz][nx] > dist[z][x] + 1:
                dist[nz][nx] = dist[z][x] + 1
                q.append((nx, nz))
    hc = [[0.0] * W for _ in range(D)]
    for z in range(D):
        for x in range(W):
            d = dist[z][x]
            land = min(0.2 * max(0, d - 1), 2.4)
            if g[z][x] == 'c':
                land += 0.45
            if x < 18 and z < 12:
                land += 0.07 * (12 - z) + 0.05 * (18 - x)    # mountains, top left
            if 33 <= x <= 42 and z <= 12:
                land += 0.45                                  # cliff above the falls
            c = g[z][x]
            if c == 'w':
                h = -0.65
            elif c == 'p':
                h = -0.55
            elif c == 'r':
                h = max(-0.4, land - 0.3)
            elif c == 'b':
                near = any(inside(x + dx, z + dz) and g[z + dz][x + dx] == 'w' for dx in (-1, 0, 1) for dz in (-1, 0, 1))
                h = -0.1 if near else 0.0
            elif c == 'm' or (x, z) in clearing:
                h = 0.0
            else:
                h = land
            hc[z][x] = h

    # Vertex grid: a vertex is the mean of the cells it touches, but stays at 0 if it touches meadow or flat beach.
    def cell(x, z):
        return min(max(x, 0), W - 1), min(max(z, 0), D - 1)
    hv = []
    for j in range(HD):
        row = []
        for i in range(HW):
            fx, fz = i / RES, j / RES
            xs = {int(fx) - 1, int(fx)} if fx == int(fx) else {int(fx)}
            zs = {int(fz) - 1, int(fz)} if fz == int(fz) else {int(fz)}
            touch = [cell(x, z) for x in xs for z in zs]
            vals = [hc[z][x] for x, z in touch]
            if any((g[z][x] in 'mb' or (x, z) in clearing) and hc[z][x] == 0.0 for x, z in touch) and min(vals) > -0.05:
                v = 0.0
            else:
                v = sum(vals) / len(vals)
            row.append(v)
        hv.append(row)
    hb = [r[:] for r in hv]
    for _ in range(2):
        src = [r[:] for r in hb]
        for j in range(1, HD - 1):
            for i in range(1, HW - 1):
                if src[j][i] != 0.0:
                    hb[j][i] = (src[j][i] * 4 + src[j - 1][i] + src[j + 1][i] + src[j][i - 1] + src[j][i + 1]) / 8
    site = {
        'w': W, 'd': D, 'res': RES, 'zones': zones,
        'heights': [int(round(v * 100)) for r in hb for v in r],
        'waterfall': WATERFALL, 'gate': GATE, 'seaLevel': -0.16, 'poolLevel': -0.14,
    }
    out = ROOT / 'assets' / 'site'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'site.json').write_text(json.dumps(site, separators=(',', ':')))
    tex = img.resize((1600, round(1600 * img.size[1] / img.size[0])), Image.LANCZOS)
    for q in (74, 68, 62, 56):
        tex.save(out / 'map.jpg', quality=q, optimize=True, progressive=True)
        if (out / 'map.jpg').stat().st_size <= 300 * 1024:
            break
    print('map.jpg', round((out / 'map.jpg').stat().st_size / 1024), 'KB; site.json', round((out / 'site.json').stat().st_size / 1024), 'KB')

    if '--debug' in sys.argv:
        dbg = img.resize((W * 20, D * 20)).convert('RGBA')
        ov = Image.new('RGBA', dbg.size, (0, 0, 0, 0))
        dr = ImageDraw.Draw(ov)
        col = {'m': (255, 255, 0, 70), 'b': (255, 140, 0, 110), 'f': (0, 90, 0, 40), 'w': (0, 0, 255, 70),
               'c': (90, 90, 90, 120), 'p': (255, 0, 255, 110), 'r': (0, 255, 255, 120)}
        for z, row in enumerate(zones):
            for x, ch in enumerate(row):
                dr.rectangle([x * 20, z * 20, x * 20 + 19, z * 20 + 19], fill=col.get(ch))
                dr.text((x * 20 + 6, z * 20 + 4), ch, fill=(0, 0, 0, 255))
        gx, gz = GATE
        dr.ellipse([gx * 20 + 2, gz * 20 + 2, gx * 20 + 18, gz * 20 + 18], outline=(255, 0, 0, 255), width=3)
        wx, wz = WATERFALL
        dr.ellipse([wx * 20 - 8, wz * 20 - 8, wx * 20 + 8, wz * 20 + 8], outline=(255, 0, 255, 255), width=3)
        Image.alpha_composite(dbg, ov).convert('RGB').save(sys.argv[sys.argv.index('--debug') + 1])


if __name__ == '__main__':
    main()
