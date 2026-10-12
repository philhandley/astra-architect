"""Draw the app icons (a little block-model school on a dark tile) with Pillow.

Run from the project folder: python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons'


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


def iso_box(d, cx, cy, w, dpt, hgt, col, s):
    """Draw an isometric box whose base centre is (cx, cy). w along the right axis, dpt along the left."""
    rx, ry = 0.866 * s, 0.5 * s
    def P(x, y, z):
        return (cx + (x - y) * rx, cy + (x + y) * ry - z * s)
    a, b, c_, e = P(0, 0, hgt), P(w, 0, hgt), P(w, dpt, hgt), P(0, dpt, hgt)
    d.polygon([a, b, c_, e], fill=col)
    d.polygon([e, c_, P(w, dpt, 0), P(0, dpt, 0)], fill=shade(col, 0.72))
    d.polygon([b, c_, P(w, dpt, 0), P(w, 0, 0)], fill=shade(col, 0.86))
    return P


def draw(size, pad=0.0):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)
    if pad == 0:
        d.rounded_rectangle([0, 0, size - 1, size - 1], r, fill=(31, 34, 41, 255))
    else:
        d.rectangle([0, 0, size, size], fill=(31, 34, 41, 255))
    s = size * (0.105 if pad == 0 else 0.085)
    cx, cy = size * 0.5, size * (0.56 if pad == 0 else 0.55)
    # Ground
    gw = size * (0.4 if pad == 0 else 0.33)
    d.ellipse([cx - gw, cy - gw * 0.42, cx + gw, cy + gw * 0.62], fill=(141, 184, 124, 255))
    # Blocks: a long red hall, an orange classroom with a track on top, a yellow tower, a teal block.
    iso_box(d, cx - 2.6 * s * 0.866, cy - 0.2 * s, 1, 2, 1, (198, 47, 75), s)
    P = iso_box(d, cx, cy - 1.0 * s, 2, 1, 1, (242, 140, 40), s)
    d.polygon([P(0.1, 0.1, 1.02), P(1.9, 0.1, 1.02), P(1.9, 0.9, 1.02), P(0.1, 0.9, 1.02)], fill=(193, 68, 14))
    d.line([P(0.3, 0.5, 1.03), P(1.7, 0.5, 1.03)], fill=(255, 255, 255), width=max(2, size // 90))
    iso_box(d, cx + 1.9 * s * 0.866, cy + 0.0 * s, 1, 1, 2, (255, 201, 60), s)
    iso_box(d, cx - 0.4 * s * 0.866, cy + 1.2 * s, 1, 1, 1, (18, 133, 126), s)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    big = draw(1024)
    big.resize((512, 512), Image.LANCZOS).save(OUT / 'icon-512.png')
    big.resize((192, 192), Image.LANCZOS).save(OUT / 'icon-192.png')
    draw(1024, pad=1).resize((512, 512), Image.LANCZOS).save(OUT / 'icon-maskable-512.png')
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
