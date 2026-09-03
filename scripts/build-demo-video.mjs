// .demo-frames/*.png  ->  docs/app-demo.mp4  (h264, loops, muted-autoplay friendly)
// needs ffmpeg-static:  npm i -D ffmpeg-static
//   npx electron scripts/demo-frames.js && node scripts/build-demo-video.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FRAMES = path.join(ROOT, ".demo-frames");
const OUT = path.join(ROOT, "docs", "app-demo.mp4");

if (!existsSync(FRAMES) || readdirSync(FRAMES).length === 0) {
  console.error("no frames — run: npx electron scripts/demo-frames.js");
  process.exit(1);
}
const ffmpeg = (await import("ffmpeg-static")).default;

execFileSync(ffmpeg, [
  "-y",
  "-framerate", "22",
  "-i", path.join(FRAMES, "%04d.png"),
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "-c:v", "libx264",
  "-preset", "slow",
  "-crf", "20",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  OUT,
], { stdio: "inherit" });

const { statSync } = await import("node:fs");
console.log(`wrote ${OUT}  ${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
