// Capture a smooth run of the real app -> docs/app-demo.gif
// gauge sweep + count-up on load, then a walk through the tabs, then quick-log +2h.
//   npx electron scripts/demo-frames.js && python3 scripts/build-demo-gif.py
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const FRAMES = path.join(__dirname, "..", ".demo-frames");
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const SAMPLE = {
  name: "C. Wales", baseHours: 40, goal: 330, required: 275, hoursPerDay: 8, deadline: "2026-12-22",
  jobTargets: { install: 5, service: 5, repair: 4 },
  boilerTypes: ["traditional", "combi", "system"], repairFaults: ["water", "gas", "electrical"],
  blocks: ["2026-09-14", "2026-10-05", "2026-11-02", "2026-11-23", "2026-12-14"],
  off: ["2026-11-09", "2026-11-10"],
  hours: [
    { date: "2026-09-01", h: 7, note: "combi swap assist" },
    { date: "2026-09-08", h: 6.5, note: "" },
    { date: "2026-09-15", h: 7, note: "landlord checks" },
    { date: "2026-09-22", h: 6, note: "" },
  ],
  jobs: [
    { date: "2026-09-03", type: "install", h: 3, boiler: "combi" },
    { date: "2026-09-10", type: "repair", h: 2, boiler: "system", fault: "water" },
    { date: "2026-09-17", type: "service", h: 1.5, boiler: "traditional" },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (w, c) => w.webContents.executeJavaScript(c, true);

let n = 0;
async function grab(win) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(FRAMES, String(n++).padStart(4, "0") + ".png"), img.toPNG());
}
// capture `count` frames spaced `gap` ms apart
async function film(win, count, gap = 55) {
  for (let i = 0; i < count; i++) { await grab(win); await sleep(gap); }
}
const clickTab = (win, label) =>
  js(win, `[...document.querySelectorAll('.tabs button')].find(b=>b.textContent===${JSON.stringify(label)}).click(); true`);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 460, height: 860, show: true, frame: false, transparent: false,
    backgroundColor: "#12141a", x: -3000, y: 40,
    webPreferences: { contextIsolation: true },
  });
  await win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  await js(win, `localStorage.setItem('gaslog-data', ${JSON.stringify(JSON.stringify(SAMPLE))}); true`);
  win.reload();
  await sleep(1500);
  await js(win, `document.getElementById('splash') && document.getElementById('splash').remove(); true`);
  await sleep(120);

  // Home load: gauge needle sweep + number count-up
  await js(win, `if (typeof render === 'function') render(); true`);
  await film(win, 34);                 // ~1.9s of the sweep/glow settling
  await sleep(500); await film(win, 8);

  // tab walk
  for (const t of ["Hours", "Jobs", "Report", "Home"]) {
    await clickTab(win, t);
    await film(win, 16);               // pane slide-in + settle
    await sleep(350); await film(win, 6);
  }

  // quick-log +2h on Home -> pill pop + gauge/needle re-animate
  await js(win, `document.querySelector('[data-q="2"]') && document.querySelector('[data-q="2"]').click(); true`);
  await film(win, 30);
  await sleep(600); await film(win, 10);

  console.log("frames:", n, "->", FRAMES);
  app.quit();
});
