#!/usr/bin/env python3
"""Turn a black logo on a transparent (or white) background into a Grafysta glass logo.

    python3 scripts/glass-logo.py logos-src/*.png      → src/o-mne/logos/<name>.webp

The logo's own shape becomes the glass: a frosted white body, a bright rim along every edge,
a specular sheen from the top left and a lilac (#B19EEF) refraction fringe on the far edges,
matching the GlassSurface buttons and panels of the site. Output is a 512 × 512 WebP with
alpha, the logo centred with room around it so it sits inside the round Tumble Wall pieces.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

OUT = Path(__file__).resolve().parent.parent / 'src' / 'o-mne' / 'logos'
SIZE = 512          # output size
WORK = 2            # supersampling
FIT = 0.56          # logo fits inside this share of the square (the piece is a circle)
LILAC = np.array([0xB1, 0x9E, 0xEF]) / 255


def load_mask(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im, dtype=np.float32) / 255
    lum = a[..., :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    has_alpha = a[..., 3].min() < 0.99
    mask = a[..., 3] * (1 - lum) if has_alpha else (1 - lum)
    return np.clip(mask, 0, 1)


def fit(mask):
    ys, xs = np.nonzero(mask > 0.02)
    if not len(xs):
        raise ValueError('empty logo')
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    n = SIZE * WORK
    h, w = crop.shape
    s = (n * FIT) / max(w, h)
    img = Image.fromarray((crop * 255).astype(np.uint8)).resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    canvas = Image.new('L', (n, n), 0)
    canvas.paste(img, ((n - img.width) // 2, (n - img.height) // 2))
    return np.asarray(canvas, dtype=np.float32) / 255


def glass(mask):
    px = WORK
    # bevel height field → surface normals
    height = ndimage.gaussian_filter(mask, 7 * px)
    gy, gx = np.gradient(height)
    k = 38 * px
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(mask)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / ln, ny / ln, nz / ln
    light = np.array([-0.55, -0.7, 0.45])
    light /= np.linalg.norm(light)
    diffuse = nx * light[0] + ny * light[1] + nz * light[2]
    sheen = np.clip((diffuse - 0.55) / 0.45, 0, 1) ** 2

    # rim: a thin band along every edge, inside the shape
    eroded = ndimage.grey_erosion(mask, size=(5 * px, 5 * px))
    rim = ndimage.gaussian_filter(np.clip(mask - eroded, 0, 1), 0.8 * px)
    # far edges (bottom right) pick up a lilac fringe
    far = np.clip(nx * 0.6 + ny * 0.8, 0, 1)
    fringe = ndimage.gaussian_filter(np.clip(mask - ndimage.grey_erosion(mask, size=(9 * px, 9 * px)), 0, 1), 1.5 * px) * far
    glow = ndimage.gaussian_filter(mask, 14 * px) * (1 - mask)

    layers = [  # (rgb, alpha), bottom → top
        (np.array([1.0, 1.0, 1.0]), glow * 0.10),
        (np.array([1.0, 1.0, 1.0]), mask * 0.14),
        (LILAC, np.clip(fringe * 1.6, 0, 1) * 0.85),
        (np.array([1.0, 1.0, 1.0]), np.clip(rim * 1.3, 0, 1) * 0.78 * mask),
        (np.array([1.0, 1.0, 1.0]), sheen * 0.55 * mask),
    ]
    rgb = np.zeros(mask.shape + (3,), np.float32)   # premultiplied
    alpha = np.zeros(mask.shape, np.float32)
    for col, a in layers:
        rgb = col * a[..., None] + rgb * (1 - a[..., None])
        alpha = a + alpha * (1 - a)
    out = np.where(alpha[..., None] > 1e-4, rgb / np.maximum(alpha[..., None], 1e-4), 0)
    img = np.dstack([np.clip(out, 0, 1), np.clip(alpha, 0, 1)])
    im = Image.fromarray((img * 255).round().astype(np.uint8), 'RGBA')
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def main(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    for p in map(Path, paths):
        out = OUT / (p.stem + '.webp')
        glass(fit(load_mask(p))).save(out, 'WEBP', quality=88, method=6)
        print(f'{p.name} → {out.relative_to(OUT.parent.parent.parent)} ({out.stat().st_size // 1024} kB)')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
