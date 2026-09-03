# Changelog

## 2.2.0 — Home & widget rework

- **Home is a dashboard now, not a wall of text.** The gauge got a real
  instrument treatment (bezel, graduations, coloured zones, machined hub,
  counter-weighted needle). Below it: four stat tiles (rate needed, this week,
  hours-done-by, deadline), a highlighted "earliest realistic finish" strip,
  write-up progress bars, and coverage pips that fill in.
- **Desktop widget polished** — bigger, frosted with a blue corner glow and an
  accent hairline, a proper value bar with a red pass-mark, a "to pass" chip,
  write-up count, and Inter to match the app. Window a touch larger (286 x 152).
- **Turn logged hours into a write-up** — every row in the Hours list has a
  "-> write-up" button. It carries the date and hours across, you set the
  type/boiler/fault, and the original hours entry is swapped (no double-count).
- Single-instance lock — no more double tray icon / double widget if the app
  gets launched twice.

## 2.1.0 — the gauge

- **Home progress is now a pressure gauge.** The thin bar is replaced by a
  manometer-style dial: a flame-blue value arc, a red line at the 275 pass mark,
  and a needle that sweeps to your current total on load. Total sits in the
  centre; 0 and your goal mark the ends.
- Fixed a dead window-icon path that pointed inside the packaged app bundle.

## 2.0.0 — full rework

A ground-up polish pass. The app is now purely a **portfolio tracker** — the
reference/guide material is gone.

### Removed
- **Methods tab** — this is a tracker, not a study guide.
- **Calc tab** (gas rate → heat input) — same reason. The maths helpers stay in
  `logic.js` but there's no UI for them.

### New
- **Whole-portfolio finish estimate** on Home — the earliest realistic finish
  date, taking the *later* of two gates: hours done flat-out, and all 14
  write-ups done at your planned rate. Tells you which one is the hold-up, what
  boiler/fault coverage is still missing, and your actual write-up pace so far.
  New Settings field: *Write-ups per week (estimate)*.
- **New app icon** — a blue gas flame on a burner bar in a dark rounded square.
  Blue because a blue flame is a *good* burn; full flame spectrum
  (indigo → cobalt → cyan → white) with a violet mantle. Regenerated `.icns`,
  1024 png, menu-bar glyph, and the in-app flame.

### Look & feel
- **Identical on macOS and Windows** — bundled the Inter typeface, replaced every
  native form control (inputs, selects, checkboxes, date fields, scrollbars) with
  drawn equivalents, `font-synthesis: none`.
- **Classier inputs** — larger radius, inset depth, smooth focus glow, no OS
  spinners, custom check mark.
- **Sleeker, flashier motion** — snappier tab transitions with a blur settle,
  eased progress-bar fill + sheen sweep, button press/ripple, quick-log pills
  "pop" when tapped, a blue→violet tab underline, a one-shot glow when you cross
  the 275 pass mark or complete a boiler/fault type.
