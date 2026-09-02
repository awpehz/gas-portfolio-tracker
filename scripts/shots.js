// Capture product screenshots into docs/  ->  run:  npx electron scripts/shots.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const GasLogic = require(path.join(__dirname, "..", "src", "logic.js"));

const OUT = path.join(__dirname, "..", "docs");
fs.mkdirSync(OUT, { recursive: true });

const SAMPLE = {
  name: "C. Wales", baseHours: 29, goal: 330, required: 275, hoursPerDay: 8, deadline: "2026-12-22",
  jobTargets: { install: 5, service: 5, repair: 4 },
  boilerTypes: ["traditional", "combi", "system"], repairFaults: ["water", "gas", "electrical"],
  blocks: ["2026-09-14", "2026-10-05", "2026-11-02", "2026-11-23", "2026-12-14"],
  off: ["2026-11-09", "2026-11-10"],
  hours: [
    { date: "2026-09-01", h: 6, note: "boiler swap assist" },
    { date: "2026-09-08", h: 4.5, note: "" },
    { date: "2026-09-15", h: 6, note: "landlord checks" },
  ],
  jobs: [
    { date: "2026-09-03", type: "install", h: 3, boiler: "combi" },
    { date: "2026-09-10", type: "repair", h: 2, boiler: "system", fault: "water" },
    { date: "2026-09-17", type: "service", h: 1.5, boiler: "traditional" },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = (w, code) => w.webContents.executeJavaScript(code, true);

async function shot(win, name) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name + ".png"), img.toPNG());
  console.log("wrote docs/" + name + ".png");
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 520, height: 900, show: true, frame: false, transparent: false,
    backgroundColor: "#12141a", x: -3000, y: 60,
    webPreferences: { contextIsolation: true },
  });
  await win.loadFile(path.join(__dirname, "..", "src", "index.html"));
  await js(win, `localStorage.setItem('gaslog-data', ${JSON.stringify(JSON.stringify(SAMPLE))}); true`);
  win.reload();
  await sleep(1400);
  await js(win, `document.getElementById('splash') && document.getElementById('splash').remove()`);
  await sleep(500);

  for (const tab of ["Home", "Hours", "Jobs", "Calc", "Report", "Methods"]) {
    await js(win, `[...document.querySelectorAll('.tabs button')].find(b=>b.textContent===${JSON.stringify(tab)}).click(); document.querySelector('main').scrollTop=0; true`);
    await sleep(650);
    if (tab === "Calc") {
      await js(win, `
        const r=document.getElementById('m_rate'); r.value='2.91'; r.dispatchEvent(new Event('input'));
        const p=document.getElementById('c_plate'); p.value='30.4'; p.dispatchEvent(new Event('input')); true`);
      await sleep(300);
    }
    await shot(win, tab.toLowerCase().replace(/[^a-z]+/g, "-"));
  }

  // desktop widget — its own window loading widget.html, over a wallpaper-ish backdrop
  const wv = new BrowserWindow({
    width: 264, height: 138, show: true, frame: false,
    transparent: false, backgroundColor: "#2a3f5c", x: -3000, y: 80,
    webPreferences: { contextIsolation: true },
  });
  await wv.loadFile(path.join(__dirname, "..", "src", "widget.html"));
  await sleep(400);
  const st = GasLogic.computeStatus(SAMPLE);
  await wv.webContents.executeJavaScript(
    `document.body.style.background = 'linear-gradient(135deg,#3a6ea5,#1f3a52 55%,#6b4a7a)';
     window.__wpaint(${JSON.stringify(st)}); true`, true);
  await sleep(700);
  await shot(wv, "widget");

  app.quit();
});
