// Renderer for the desktop widget. Display only — it paints whatever status the
// main process pushes over `widget:data`. No controls, no stored state; the
// menu-bar (tray) icon is the control surface.
const $ = (id) => document.getElementById(id);

function fmt(n) {
  const r = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function paint(s) {
  if (!s) return;
  $("total").textContent = fmt(s.total);
  $("goal").textContent = "/ " + s.goal + " h";

  if ($("wcount")) $("wcount").textContent = s.jobsDone + "/" + s.jobsTotal + " write-ups";

  const pct = Math.max(2, Math.min(100, s.pctGoal || 0));
  $("fill").style.width = pct + "%";
  $("mark").style.left = Math.max(0, Math.min(100, s.requiredMark || 0)) + "%";
  const bar = $("bar");
  if (bar) bar.classList.toggle("full", s.toGoal <= 0);

  const chip = $("chip");
  if (chip) {
    if (s.toGoal <= 0) { chip.textContent = "goal reached"; chip.className = "chip ok"; }
    else if (s.past275) { chip.textContent = "✓ past 275"; chip.className = "chip ok"; }
    else { chip.textContent = fmt(s.toRequired) + " h to pass"; chip.className = "chip"; }
  }

  const pace = $("pace");
  const pt = $("pacetext") || pace;
  if (s.toGoal <= 0) {
    pt.textContent = "nicely done — keep the write-ups coming";
    pace.className = "line ok";
  } else {
    pt.textContent = fmt(s.perDayGoal) + " h/day · " + s.availDays + " working days left";
    pace.className = "line " + (s.verdictOk ? "" : "warn");
  }
}
window.__wpaint = paint; // used by scripts/shots.js

if (window.wapi) window.wapi.onData(paint);
