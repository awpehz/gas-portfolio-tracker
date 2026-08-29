# Gas Portfolio Tracker

A small desktop tracker for a gas NVQ / SVQ portfolio — assisted hours, unassisted
write-ups, and the deadline maths, worked out against the days you're actually on
the tools (college weeks and holidays removed).

**Made by Connor Wales.**

---

## What it does

- **Assisted hours** — type the hours, hit Log. Progress toward the pass mark (275)
  and a personal goal (330).
- **Unassisted write-ups** — installs / services / repairs against their targets
  (5 / 5 / 4), each carrying its own hours.
- **Rate needed** — hours per working day to hit the goal, where a working day is
  Mon–Fri, not at college, not on holiday.
- **Settings** — every number is editable: starting hours, pass mark, goal,
  deadline, hours in a work day, the college block weeks, and holidays. Change them
  for your own portfolio.
- Runs as a normal window or, with **View → Always on Top**, as a pinned panel.

Data is stored locally per person (`gaslog-data.json` in your user data folder —
`View → Data → Reveal data file`). Nothing leaves your machine.

---

## Install (for classmates)

### macOS
1. Download `Gas Portfolio Tracker-1.0.0-arm64.dmg`
2. Open it, drag the app to Applications
3. First launch: right-click the app → **Open** → **Open** (it isn't code-signed,
   so Gatekeeper asks once)

### Windows
1. Download `Gas Portfolio Tracker Setup 1.0.0.exe`
2. Run it. SmartScreen may warn ("unknown publisher") → **More info → Run anyway**
3. It installs like any app; pick the install folder if you want

---

## Build it yourself

```bash
npm install
npm start            # run in dev
npm run dist:mac     # -> dist/*.dmg   (build on a Mac)
npm run dist:win     # -> dist/*.exe   (build on Windows, or via CI below)
```

`electron-builder` cannot reliably build a Windows installer from macOS, so the
`.exe` is produced by GitHub Actions — see `.github/workflows/build.yml`. Push a
tag like `v1.0.0` and both installers appear on the Releases page.

---

## Layout

| file | what |
|---|---|
| `electron/main.js` | window, menu, reads/writes the data file |
| `electron/preload.js` | the tiny bridge to the page |
| `src/logic.js` | all the maths — pure, no DOM |
| `src/renderer.js` | the UI |
| `src/style.css` | the look |

MIT licensed.
