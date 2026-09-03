// Capture product screenshots into docs/  ->  run:  npx electron scripts/shots.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const GasLogic = require(path.join(__dirname, "..", "src", "logic.js"));

const OUT = path.join(__dirname, "..", "docs");
fs.mkdirSync(OUT, { recursive: true });

const _shotHours = (() => {
  // ~10 weeks of assisted work up to today, 2–3 days a week
  const out = [];
  const today = new Date();
  const notes = ["landlord safety checks", "combi service — FGA", "install, second fix", "fault find — no hot water", "system flush + filter", "boiler swap assist"];
  for (let i = 68; i >= 1; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    if (i % 2 === 0 && i % 3 !== 0) continue;      // skip some weekdays -> 2–3 days/week
    out.push({ date: d.toISOString().slice(0, 10), h: [4, 5, 6, 7, 7.5][i % 5], note: notes[i % notes.length] });
  }
  return out;
})();

const SAMPLE = {
  setupDone: true,
  name: "C. Wales", schemeName: "Standard gas portfolio",
  baseHours: 29, goal: 330, required: 275, hoursPerDay: 8, deadline: "2026-12-22",
  jobTargets: { install: 5, service: 5, repair: 4 }, jobsPerWeek: 1.5,
  boilerTypes: ["traditional", "combi", "system"], repairFaults: ["water", "gas", "electrical"],
  blocks: ["2026-09-14", "2026-10-05", "2026-11-02", "2026-11-23", "2026-12-14"],
  off: ["2026-11-09", "2026-11-10"],
  engineers: [
    { name: "D. Harper", regNo: "512874", licence: "1", company: "Harper Heating Ltd", categories: "CENWAT, CKR1, HTR1", expiry: "2027-06-01" },
  ],
  hours: _shotHours,
  jobs: [
    { date: "2026-08-20", type: "install", h: 3, boiler: "combi", engineer: "D. Harper", notes: "Worcester 4000, full combi swap. Gas rate 2.9 m3/h, tightness test passed." },
    { date: "2026-08-26", type: "repair", h: 2, boiler: "system", fault: "water", engineer: "D. Harper", notes: "No heating — seized 3-port valve, swapped the motorhead." },
    { date: "2026-09-02", type: "service", h: 1.5, boiler: "traditional", engineer: "D. Harper", notes: "Annual service, open-flue. Cleaned the pilot assembly, flue flow test OK." },
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

  for (const tab of ["Home", "Hours", "Jobs", "Progress", "Report"]) {
    await js(win, `[...document.querySelectorAll('.tabs button')].find(b=>b.textContent===${JSON.stringify(tab)}).click(); document.querySelector('main').scrollTop=0; true`);
    await sleep(650);
    await shot(win, tab.toLowerCase().replace(/[^a-z]+/g, "-"));
  }

  // desktop widget — its own window loading widget.html, over a wallpaper-ish backdrop
  const wv = new BrowserWindow({
    width: 300, height: 300, show: true, frame: false,
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
