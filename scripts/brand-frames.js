// Renders scripts/brand-motion.html to a PNG frame sequence (transparent bg).
//   npx electron scripts/brand-frames.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", ".brand-frames");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const FPS = 30;
const SECONDS = 3.4;          // ignite + wipe + shine + a couple flicker cycles
const N = Math.round(FPS * SECONDS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.commandLine.appendSwitch("disable-gpu");
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1600, height: 500, show: true, x: -4000, y: 40,
    frame: false, transparent: true, backgroundColor: "#00000000",
    useContentSize: true, webPreferences: {},
  });
  await win.loadFile(path.join(__dirname, "brand-motion.html"));
  // restart the CSS animations cleanly, then sample
  await win.webContents.executeJavaScript(
    `document.querySelectorAll('*').forEach(e=>{e.style.animationPlayState='paused'});true`);
  await sleep(120);
  await win.webContents.executeJavaScript(
    `document.querySelectorAll('*').forEach(e=>{e.style.animationPlayState=''});
     const s=document.getElementById('stage'); s.style.display='none'; s.offsetHeight; s.style.display='flex'; true`);

  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const target = (i / FPS) * 1000;
    const wait = target - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, String(i).padStart(4, "0") + ".png"), img.toPNG());
  }
  console.log("brand frames:", N, "->", OUT);
  app.quit();
});
