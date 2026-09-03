#!/usr/bin/env python3
# .demo-frames/*.png  ->  docs/app-demo.gif  (a looping clip of the real app in motion)
import pathlib
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / ".demo-frames"
OUT = ROOT / "docs" / "app-demo.gif"
WIDTH = 360
STEP = 2          # keep every Nth frame
DUR = 70          # ms per kept frame

frames = sorted(SRC.glob("*.png"))
if not frames:
    raise SystemExit("no frames — run: npx electron scripts/demo-frames.js")

imgs = []
for f in frames[::STEP]:
    im = Image.open(f).convert("RGB")
    imgs.append(im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS))

# drop consecutive near-identical frames (long static holds)
kept = [imgs[0]]
for im in imgs[1:]:
    d = ImageChops.difference(im, kept[-1]).getbbox()
    if d is None:
        continue
    kept.append(im)

pal = kept[0].convert("P", palette=Image.ADAPTIVE, colors=192)
qs = [im.quantize(palette=pal, dither=Image.NONE) for im in kept]

qs[0].save(OUT, save_all=True, append_images=qs[1:], duration=DUR, loop=0, optimize=True, disposal=2)
print(f"wrote {OUT}  {OUT.stat().st_size / 1024 / 1024:.1f} MB  {len(qs)} frames  {WIDTH}px")
