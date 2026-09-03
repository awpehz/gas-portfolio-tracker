// .brand-frames/*.png (transparent, may be HiDPI) -> docs/brand-lockup.{mp4,webm,png}
//   npx electron scripts/brand-frames.js && node scripts/build-brand-motion.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FRAMES = path.join(ROOT, ".brand-frames");
const COMP = path.join(ROOT, ".brand-frames-bg");
const DOCS = path.join(ROOT, "docs");
const W = 1600, H = 500;   // final output size

if (!existsSync(FRAMES) || readdirSync(FRAMES).length === 0) {
  console.error("no frames — run: npx electron scripts/brand-frames.js");
  process.exit(1);
}
const ffmpeg = (await import("ffmpeg-static")).default;

// 1) transparent WebM (VP9 + alpha), scaled to the output size
execFileSync(ffmpeg, [
  "-y", "-framerate", "30", "-i", path.join(FRAMES, "%04d.png"),
  "-vf", `scale=${W}:${H}:flags=lanczos`,
  "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32",
  "-an", path.join(DOCS, "brand-lockup.webm"),
], { stdio: "inherit" });

// 2) composite over the brand background at the frames' own resolution, then MP4
rmSync(COMP, { recursive: true, force: true });
mkdirSync(COMP, { recursive: true });
const q = (p) => p.replace(/\\/g, "\\\\");
const py = `
from PIL import Image, ImageDraw, ImageFilter
import glob, os
frames = sorted(glob.glob(os.path.join("${q(FRAMES)}","*.png")))
fw, fh = Image.open(frames[0]).size
bg = Image.new("RGB",(fw,fh),(10,12,17))
glow = Image.new("RGB",(fw,fh),(10,12,17)); d = ImageDraw.Draw(glow)
d.ellipse((fw*0.16, fh*-0.55, fw*0.64, fh*1.25), fill=(24,44,86))
bg = Image.blend(bg, glow.filter(ImageFilter.GaussianBlur(fw*0.11)), 0.62)
for f in frames:
    im = Image.open(f).convert("RGBA")
    c = bg.convert("RGBA").copy(); c.alpha_composite(im)
    c.convert("RGB").save(os.path.join("${q(COMP)}", os.path.basename(f)))
print("composited", len(frames), f"{fw}x{fh}")
`;
if (spawnSync("python3", ["-c", py], { stdio: "inherit" }).status !== 0) process.exit(1);

execFileSync(ffmpeg, [
  "-y", "-framerate", "30", "-i", path.join(COMP, "%04d.png"),
  "-vf", `scale=${W}:${H}:flags=lanczos`,
  "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-an", path.join(DOCS, "brand-lockup.mp4"),
], { stdio: "inherit" });

// 3) a clean settled still, scaled to output size
const files = readdirSync(COMP).filter((f) => f.endsWith(".png")).sort();
const still = files[Math.min(64, files.length - 1)];
execFileSync(ffmpeg, ["-y", "-i", path.join(COMP, still), "-vf", `scale=${W}:${H}:flags=lanczos`, path.join(DOCS, "brand-lockup.png")], { stdio: "inherit" });

rmSync(COMP, { recursive: true, force: true });
for (const f of ["brand-lockup.mp4", "brand-lockup.webm", "brand-lockup.png"]) {
  console.log(`  docs/${f}  ${(statSync(path.join(DOCS, f)).size / 1024).toFixed(0)} KB`);
}
