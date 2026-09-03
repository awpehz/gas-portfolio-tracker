# Changelog

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
