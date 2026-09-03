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
from PIL import Image
import glob, os
frames = sorted(glob.glob(os.path.join("${q(FRAMES)}","*.png")))
fw, fh = Image.open(frames[0]).size
# flat black so the clip drops cleanly onto any dark page with mix-blend-mode:screen
bg = Image.new("RGBA",(fw,fh),(0,0,0,255))
for f in frames:
    im = Image.open(f).convert("RGBA")
    c = bg.copy(); c.alpha_composite(im)
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

// 3) a clean settled still — from the TRANSPARENT frame, so it drops onto any bg
const rawFiles = readdirSync(FRAMES).filter((f) => f.endsWith(".png")).sort();
const still = rawFiles[Math.min(64, rawFiles.length - 1)];
execFileSync(ffmpeg, ["-y", "-i", path.join(FRAMES, still), "-vf", `scale=${W}:${H}:flags=lanczos`, "-frames:v", "1", path.join(DOCS, "brand-lockup.png")], { stdio: "inherit" });

rmSync(COMP, { recursive: true, force: true });
for (const f of ["brand-lockup.mp4", "brand-lockup.webm", "brand-lockup.png"]) {
  console.log(`  docs/${f}  ${(statSync(path.join(DOCS, f)).size / 1024).toFixed(0)} KB`);
}
