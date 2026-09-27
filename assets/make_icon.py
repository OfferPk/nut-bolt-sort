"""Generates the original Nut & Bolt Sort icon set, splash screens and store icon.
Run from the repo root:  python3 assets/make_icon.py   (needs Pillow)"""
from PIL import Image, ImageDraw, ImageFilter
import os

S = 1024  # master size
BG_TOP, BG_BOT = (52, 60, 72), (16, 19, 24)
NUTS = [(224, 137, 43), (31, 169, 196), (216, 69, 63)]  # amber, cyan, red (top -> bottom)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def background(size):
    im = Image.new('RGB', (size, size))
    px = im.load()
    cx, cy = size * 0.5, size * 0.28
    for y in range(size):
        for x in range(size):
            d = (((x - cx) / size) ** 2 + ((y - cy) / size) ** 2) ** 0.5
            px[x, y] = lerp(BG_TOP, BG_BOT, min(1, d * 1.35))
    return im


def hgrad(w, h, stops):
    """horizontal gradient strip; stops = [(t, (r,g,b)), ...]"""
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for x in range(w):
        t = x / max(1, w - 1)
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                u = (t - stops[i][0]) / max(1e-6, stops[i + 1][0] - stops[i][0])
                c = lerp(stops[i][1], stops[i + 1][1], u)
                break
        d.line([(x, 0), (x, h)], fill=c)
    return im


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def paste_shape(canvas, img, box, polygon):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    canvas.paste(img, box, mask)


def draw_art(canvas, scale=1.0, cx=None, base_y=None):
    """Bolt with three stacked hex nuts, side view."""
    W = canvas.size[0]
    cx = W / 2 if cx is None else cx
    u = W / 1024 * scale
    base_y = W * 0.80 if base_y is None else base_y
    steel = [(0, (70, 78, 88)), (0.18, (150, 160, 170)), (0.42, (245, 248, 250)), (0.55, (170, 178, 186)), (0.8, (120, 128, 138)), (1, (60, 66, 74))]
    # soft shadow
    sh = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(sh).ellipse([cx - 330 * u, base_y - 30 * u, cx + 330 * u, base_y + 50 * u], fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(28 * u))
    canvas.paste(Image.new('RGB', canvas.size, (0, 0, 0)), (0, 0), sh)
    # head plate
    hw, hh = int(560 * u), int(84 * u)
    head = hgrad(hw, hh, steel)
    hx, hy = int(cx - hw / 2), int(base_y - hh)
    c = 16 * u
    paste_shape(canvas, head, (hx, hy), [(c, 0), (hw - c, 0), (hw, c), (hw, hh), (0, hh), (0, c)])
    d = ImageDraw.Draw(canvas)
    d.line([(hx + c, hy + 2 * u), (hx + hw - c, hy + 2 * u)], fill=(255, 255, 255), width=max(1, int(4 * u)))
    # threaded rod
    rw, rh = int(96 * u), int(640 * u)
    rod = hgrad(rw, rh, steel)
    rd = ImageDraw.Draw(rod)
    pitch = 26 * u
    y = 0.0
    while y < rh + pitch:
        rd.line([(0, y + 9 * u), (rw, y)], fill=(60, 66, 74), width=max(1, int(7 * u)))
        rd.line([(0, y + 16 * u), (rw, y + 7 * u)], fill=(235, 240, 245), width=max(1, int(3 * u)))
        y += pitch
    rx, ry = int(cx - rw / 2), int(hy - rh)
    paste_shape(canvas, rod, (rx, ry), [(0, 18 * u), (18 * u, 0), (rw - 18 * u, 0), (rw, 18 * u), (rw, rh), (0, rh)])
    # nuts (bottom -> top)
    nw, nh, gap = int(430 * u), int(150 * u), int(8 * u)
    for i, col in enumerate(reversed(NUTS)):
        ny = int(hy - (i + 1) * (nh + gap))
        nx = int(cx - nw / 2)
        nut = hgrad(nw, nh, [(0, shade(col, .45)), (0.12, shade(col, .8)), (0.2, shade(col, 1.25)), (0.36, shade(col, 1.05)),
                             (0.5, shade(col, .72)), (0.52, shade(col, 1.15)), (0.68, shade(col, 1.0)), (0.86, shade(col, .75)), (1, shade(col, .42))])
        # vertical bevel: light top edge, dark bottom edge
        ov = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for yy in range(nh):
            t = yy / nh
            if t < 0.22:
                od.line([(0, yy), (nw, yy)], fill=(255, 255, 255, int(120 * (1 - t / 0.22))))
            elif t > 0.72:
                od.line([(0, yy), (nw, yy)], fill=(0, 0, 0, int(130 * (t - 0.72) / 0.28)))
        nut = Image.alpha_composite(nut.convert('RGBA'), ov).convert('RGB')
        k = 30 * u
        paste_shape(canvas, nut, (nx, ny), [(k, 0), (nw - k, 0), (nw, k * 1.2), (nw, nh - k * 1.2), (nw - k, nh), (k, nh), (0, nh - k * 1.2), (0, k * 1.2)])
    return canvas


def rounded_mask(size, r):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], r, fill=255)
    return m


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(root)
    res = os.path.join(repo, 'android/app/src/main/res')
    big = 2048
    # full-bleed master (store icon / legacy icon)
    full = background(big)
    draw_art(full, scale=0.86, base_y=big * 0.83)
    full = full.resize((S, S), Image.LANCZOS)
    full.save(os.path.join(root, 'icon-full.png'))
    full.resize((512, 512), Image.LANCZOS).save(os.path.join(root, 'play-store-icon-512.png'))
    full.resize((512, 512), Image.LANCZOS).save(os.path.join(repo, 'www/icon.png'))
    # adaptive foreground: art inside the 66/108 safe zone, transparent background
    fg = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    art = Image.new('RGB', (big, big), (0, 0, 0))
    draw_art(art, scale=0.7, base_y=big * 0.745)
    # derive alpha from a white-on-black render of the same art
    msk = Image.new('RGB', (big, big), (0, 0, 0))
    draw_art(msk, scale=0.7, base_y=big * 0.745)
    alpha = msk.convert('L').point(lambda v: 255 if v > 6 else 0)
    fg.paste(art, (0, 0), alpha)
    fg = fg.resize((432, 432), Image.LANCZOS)
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fsizes = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for dens, px in sizes.items():
        d = os.path.join(res, 'mipmap-' + dens)
        sq = full.resize((px, px), Image.LANCZOS)
        out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        out.paste(sq, (0, 0), rounded_mask(px, int(px * 0.18)))
        out.save(os.path.join(d, 'ic_launcher.png'))
        rnd = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        cm = Image.new('L', (px, px), 0)
        ImageDraw.Draw(cm).ellipse([0, 0, px - 1, px - 1], fill=255)
        rnd.paste(sq, (0, 0), cm)
        rnd.save(os.path.join(d, 'ic_launcher_round.png'))
        fg.resize((fsizes[dens], fsizes[dens]), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
    # splash screens (legacy Android < 12; Android 12+ uses the launcher icon on #15181d)
    splash_sizes = {
        'drawable': (480, 320),
        'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480), 'drawable-land-xhdpi': (1280, 720),
        'drawable-land-xxhdpi': (1600, 960), 'drawable-land-xxxhdpi': (1920, 1280),
        'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800), 'drawable-port-xhdpi': (720, 1280),
        'drawable-port-xxhdpi': (960, 1600), 'drawable-port-xxxhdpi': (1280, 1920),
    }
    logo = Image.new('RGB', (big, big), (21, 24, 29))
    draw_art(logo, scale=0.8, base_y=big * 0.8)
    for folder, (w, h) in splash_sizes.items():
        im = Image.new('RGB', (w, h), (21, 24, 29))
        side = int(min(w, h) * 0.6)
        im.paste(logo.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
        im.save(os.path.join(res, folder, 'splash.png'))
    print('icons + splash written')


if __name__ == '__main__':
    main()
