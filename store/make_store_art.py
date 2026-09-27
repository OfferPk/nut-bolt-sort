"""Builds the Play Store graphics from real in-game captures in store/raw/.
  store/screenshots/01..06.png  1080x1920 captioned screenshots
  store/feature-graphic-1024x500.png
Run from the repo root: python3 store/make_store_art.py  (needs Pillow)"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'assets'))
import make_icon  # noqa: E402

FONT_DIR = '/usr/share/fonts/truetype/sand-box/google'
BOLD = os.path.join(FONT_DIR, 'Barlow Condensed/BarlowCondensed-ExtraBold.ttf')
MED = os.path.join(FONT_DIR, 'Barlow/Barlow-Medium.ttf')
AMBER = (255, 176, 32)

CAPTIONS = [
    ('01', 'UNSCREW. SORT. TIGHTEN.', 'Tap a bolt, move the nuts, match the colors'),
    ('02', 'UP TO 12 COLORS', 'Brain-teasing boards that ramp up smoothly'),
    ('03', 'SATISFYING CLEARS', 'Cap every bolt and earn coins'),
    ('04', 'STUCK? GET A HINT', 'Optional solver hint and a spare bolt'),
    ('05', 'UNLOCK SLEEK FINISHES', 'Brass, copper, titanium & more. Cosmetic only'),
    ('06', '1000+ SOLVABLE LEVELS', 'Every level verified. Play offline, no Wi-Fi'),
]


def bg(w, h):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / h
        c = make_icon.lerp((44, 51, 61), (13, 15, 19), t ** 0.8)
        d.line([(0, y), (w, y)], fill=c)
    # faint diagonal brushed lines
    ov = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for x in range(-h, w, 14):
        od.line([(x, 0), (x + h, h)], fill=(255, 255, 255, 6), width=2)
    return Image.alpha_composite(im.convert('RGBA'), ov)


def fit_font(path, text, max_w, start):
    size = start
    while size > 20:
        f = ImageFont.truetype(path, size)
        if f.getlength(text) <= max_w:
            return f
        size -= 4
    return ImageFont.truetype(path, size)


def rounded(im, r):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], r, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def screenshot(num, title, sub):
    W, H = 1080, 1920
    canvas = bg(W, H)
    d = ImageDraw.Draw(canvas)
    ft = fit_font(BOLD, title, W - 120, 118)
    tw = ft.getlength(title)
    d.text(((W - tw) / 2, 70), title, font=ft, fill=(245, 247, 250))
    tb = d.textbbox(((W - tw) / 2, 70), title, font=ft)[3]
    d.rectangle([(W / 2 - 70, tb + 22), (W / 2 + 70, tb + 30)], fill=AMBER)
    fs = fit_font(MED, sub, W - 140, 50)
    sw = fs.getlength(sub)
    d.text(((W - sw) / 2, tb + 52), sub, font=fs, fill=(185, 194, 205))
    shot = Image.open(os.path.join(HERE, 'raw', num + '.png')).convert('RGB')
    top = tb + 52 + fs.size + 56
    avail_h = H - top - 60
    sh_h = avail_h
    sh_w = int(shot.width * sh_h / shot.height)
    shot = shot.resize((sh_w, sh_h), Image.LANCZOS)
    x = (W - sh_w) // 2
    # frame + shadow
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x - 14, top - 14 + 20, x + sh_w + 14, top + sh_h + 14 + 20], 60, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas, shadow)
    frame = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([x - 14, top - 14, x + sh_w + 14, top + sh_h + 14], 58, fill=(58, 64, 72, 255), outline=(120, 128, 138, 255), width=3)
    canvas = Image.alpha_composite(canvas, frame)
    canvas.alpha_composite(rounded(shot, 46), (x, top))
    out = os.path.join(HERE, 'screenshots', num + '.png')
    canvas.convert('RGB').save(out, optimize=True)
    return out


def feature():
    W, H = 1024, 500
    big = 2
    canvas = bg(W * big, H * big).convert('RGB')
    # three bolts with nuts on the right
    sets = [[(31, 169, 196), (31, 169, 196), (216, 69, 63)], [(224, 137, 43), (224, 137, 43), (224, 137, 43)], [(123, 82, 199), (216, 69, 63), (31, 169, 196)]]
    for i, (cx, sc, by) in enumerate([(1340, 0.38, 880), (1640, 0.46, 920), (1940, 0.38, 880)]):
        make_icon.NUTS = sets[i]
        make_icon.draw_art(canvas, scale=sc, cx=cx, base_y=by)
    canvas = canvas.resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(canvas)
    f1 = ImageFont.truetype(BOLD, 96)
    f2 = ImageFont.truetype(BOLD, 120)
    f3 = ImageFont.truetype(MED, 30)
    d.text((56, 92), 'NUT & BOLT', font=f1, fill=(240, 243, 247))
    d.text((56, 178), 'SORT', font=f2, fill=AMBER)
    d.rectangle([(60, 318), (190, 324)], fill=AMBER)
    d.text((58, 342), 'Offline color sort puzzle', font=f3, fill=(190, 198, 208))
    d.text((58, 382), '1000+ solvable levels', font=f3, fill=(150, 159, 170))
    out = os.path.join(HERE, 'feature-graphic-1024x500.png')
    canvas.save(out, optimize=True)
    return out


if __name__ == '__main__':
    os.makedirs(os.path.join(HERE, 'screenshots'), exist_ok=True)
    for c in CAPTIONS:
        print(screenshot(*c))
    print(feature())
