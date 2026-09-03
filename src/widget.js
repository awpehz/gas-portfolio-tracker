// Renderer for the desktop widget. Display only — it paints whatever status the
// main process pushes over `widget:data`. Uses the same gauge as the app (gauge.js).
const $ = (id) => document.getElementById(id);

function fmt(n) {
  const r = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function paint(s) {
  if (!s) return;

  if ($("wcount")) $("wcount").textContent = s.jobsDone + "/" + s.jobsTotal + " write-ups";

  // rebuild the gauge (fresh DOM => the sweep + glow animations replay)
  const box = $("gaugebox");
  if (box && window.GaugeUI) {
    box.innerHTML =
      window.GaugeUI.svg(s) +
      '<div class="gaugereadout"><div class="stat">' + fmt(s.total) +
      '<small>/ ' + s.goal + ' h</small></div></div>';
  }

  const chip = $("chip");
  if (chip) {
    if (s.toGoal <= 0) { chip.textContent = "goal reached"; chip.className = "chip ok"; }
    else if (s.past275) { chip.textContent = "✓ past 275"; chip.className = "chip ok"; }
    else { chip.textContent = fmt(s.toRequired) + " h to pass"; chip.className = "chip"; }
  }

  const pace = $("pace");
  const pt = $("pacetext") || pace;
  if (s.toGoal <= 0) {
    pt.textContent = "keep the write-ups coming";
    pace.className = "line ok";
  } else {
    pt.textContent = fmt(s.perDayGoal) + " h/day · " + s.availDays + " days left";
    pace.className = "line " + (s.verdictOk ? "" : "warn");
  }
}
window.__wpaint = paint; // used by scripts/shots.js

if (window.wapi) window.wapi.onData(paint);
