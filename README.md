<p align="center">
  <img src="docs/logo.png" width="96" alt="Gas Portfolio Tracker" />
</p>

<h1 align="center">Gas Portfolio Tracker</h1>

<p align="center">
  A small desktop app for tracking a gas SVQ / NVQ portfolio —<br>
  assisted hours, unassisted write-ups, and whether you'll actually hit the deadline.
</p>

<p align="center">
  <a href="https://github.com/awpehz/gas-portfolio-tracker/releases/latest"><b>Download for macOS &amp; Windows</b></a>
</p>

<p align="center"><i>Made by Connor W.</i></p>

---

## What it's for

Working toward a gas qualification you have to log a lot: **hours worked alongside a
Gas Safe engineer** (the pass mark is usually 275, with a personal target above that),
plus **14 unassisted "write-up" jobs** — 5 installs, 5 services, 4 repairs — that also
have to span every **boiler type** (traditional / combi / system) and every **repair
fault** (water / gas / electrical).

A spreadsheet does the storing but never answers the question that matters: **am I on
track?** This does.

The headline figure is **hours per working day needed** — your remaining hours spread
over the days you're actually available: Mon–Fri, minus college block weeks, minus
booked holidays. Comfortably under a full day means you're fine; over it and you know
now rather than in December.

Everything is stored on your machine. Nothing is uploaded.

## Screens

| Home | Hours | Write-ups |
|---|---|---|
| ![Home](docs/home.png) | ![Hours](docs/hours.png) | ![Write-ups](docs/write-ups.png) |

| Report — PDF for your assessor | Widget mode |
|---|---|
| ![Report](docs/report.png) | ![Widget](docs/widget.png) |

## Features

- **Home** — progress vs the pass mark and your goal, the daily rate needed, a weekly
  aim, write-up counts with coverage, your next college block, and quick-log buttons.
- **Hours** — type the hours, pick the date, log it; or set a whole-week total. Delete
  any single entry with its own **x**.
- **Write-ups** — log a job with its type, boiler and (for repairs) fault; those hours
  count toward your total too. Coverage lines light up as you hit each boiler and fault.
- **Report** — one-page PDF for your assessor, in the app's colours, with your name on
  it: hours, pace, write-up counts, boiler &amp; fault coverage, and the full log.
- **Settings** — every number is editable (starting hours, pass mark, goal, deadline,
  work-day length, job targets, college block weeks, holidays). Export / import your
  whole tracker as a file.
- **Widget mode** — shrink to a small always-on-top panel (Cmd/Ctrl + Shift + W)
  showing just your hours, the bar and the daily rate.
- **Update check** — on launch it checks GitHub for a newer release and offers a
  one-click download if there is one.

## Install

**Download:** https://github.com/awpehz/gas-portfolio-tracker/releases/latest
(on the repo it's the **Releases** link in the sidebar; installers are under **Assets**)

### macOS
1. Download the `...-arm64.dmg`
2. Open it, drag the app into Applications
3. First launch: right-click the app -> **Open** -> **Open** (not code-signed, so
   Gatekeeper asks once)

### Windows
1. Download `...Setup...exe`
2. Run it. SmartScreen may warn ("unknown publisher") -> **More info -> Run anyway**

## Build from source

```bash
npm install
npm start            # run in dev
npm test             # logic unit tests
npm run dist:mac     # -> dist/*.dmg   (on a Mac)
npm run dist:win     # -> dist/*.exe   (on Windows)
```

`electron-builder` can't reliably cross-build a Windows installer from macOS, so the
`.exe` is produced by GitHub Actions (`.github/workflows/build.yml`). Push a tag like
`v1.2.3` and both installers appear on a new Release.

## Layout

| path | what |
|---|---|
| `src/logic.js` | the maths — pure, no DOM, unit-tested |
| `src/renderer.js` | the UI |
| `src/style.css` | the look |
| `electron/main.js` | window, menu, data file, update check, widget mode |
| `scripts/shots.js` | regenerates the screenshots in `docs/` |

MIT licensed.
