#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import pathlib

DOCS = pathlib.Path("/Users/user/Developer/gas-portfolio-tracker/docs")
OUT = DOCS / "walkthrough.gif"
W = 460
BG = (11, 13, 18)
INK = (238, 242, 248)
INK2 = (150, 170, 195)
ACCENT = (124, 196, 255)

fb = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 22)
fs = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 15)

# (image file, crop-bottom-fraction, title, subtitle)
SLIDES = [
    (None, 1.0, "Gas Portfolio Tracker", "an apprentice's answer to “am I on track?”"),
    ("home.png",   0.80, "The gauge", "total vs goal · red line at the 275-hour pass mark"),
    ("home.png",   0.80, "Earliest realistic finish", "hours + all 14 write-ups — which one is the hold-up"),
    ("hours.png",  0.60, "Log it in seconds", "steppers, back-date, whole week — or convert to a write-up"),
    ("jobs.png",   0.70, "Write-ups & coverage", "5 / 5 / 4 · every boiler type · every fault"),
    ("report.png", 0.58, "Assessor-ready PDF", "one page, your name on it, the app's graphics"),
    ("widget.png", 1.0,  "Lives on your desktop", "menu-bar icon + a frosted desktop widget"),
    (None, 1.0, "Gas Portfolio Tracker", "github.com/awpehz/gas-portfolio-tracker · v2.2.0"),
]

CAP_H = 78

def render_slide(spec):
    fn, cropf, title, sub = spec
    if fn:
        im = Image.open(DOCS / fn).convert("RGB")
        if cropf < 1.0:
            im = im.crop((0, 0, im.width, int(im.height * cropf)))
        scale = W / im.width
        im = im.resize((W, int(im.height * scale)), Image.LANCZOS)
        H = CAP_H + im.height
        canvas = Image.new("RGB", (W, H), BG)
        canvas.paste(im, (0, CAP_H))
        d = ImageDraw.Draw(canvas)
        d.rectangle((0, CAP_H - 2, W, CAP_H), fill=(30, 60, 100))
        d.text((20, 16), title, font=fb, fill=INK)
        d.text((20, 46), sub, font=fs, fill=INK2)
        return canvas
    # title / end card — vertically centred
    H = 560
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 30)
    tw = d.textlength(title, font=big)
    d.text(((W - tw) / 2, H / 2 - 60), title, font=big, fill=INK)
    sw = d.textlength(sub, font=fs)
    d.text(((W - sw) / 2, H / 2 - 20), sub, font=fs, fill=INK2)
    line = "hours  ·  write-ups  ·  coverage  ·  the deadline"
    lw = d.textlength(line, font=fs)
    d.text(((W - lw) / 2, H / 2 + 24), line, font=fs, fill=ACCENT)
    line2 = "macOS + Windows  ·  your data never leaves your machine"
    l2w = d.textlength(line2, font=fs)
    d.text(((W - l2w) / 2, H / 2 + 48), line2, font=fs, fill=INK2)
    return canvas

slides = [render_slide(s) for s in SLIDES]
maxH = max(s.height for s in slides)
# pad all to same height (top-align, fill bg)
norm = []
for s in slides:
    if s.height != maxH:
        c = Image.new("RGB", (W, maxH), BG)
        c.paste(s, (0, 0))
        s = c
    norm.append(s)

frames, durations = [], []
FADE = 3
for i, s in enumerate(norm):
    frames.append(s); durations.append(1500)
    nxt = norm[(i + 1) % len(norm)]
    for k in range(1, FADE + 1):
        frames.append(Image.blend(s, nxt, k / (FADE + 1)))
        durations.append(90)

frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=durations,
               loop=0, optimize=True, disposal=2)
print("wrote", OUT, f"{OUT.stat().st_size/1024/1024:.1f} MB", f"{len(frames)} frames  {W}x{maxH}")
