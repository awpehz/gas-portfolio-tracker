// Runs under Electron (window.api from preload) OR as a plain web page (localStorage fallback).
if (!window.api) {
  const KEY = "gaslog-data";
  window.api = {
    getData: async () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
    setData: async (d) => { localStorage.setItem(KEY, JSON.stringify(d)); return true; },
    isPinned: async () => false,
    win: (cmd) => { if (cmd === "close") window.close(); },
    onDataChanged: () => {},
  };
  document.documentElement.classList.add("web");
}

const { computeStatus, DEFAULT_DATA, toISO, parseISO } = window.GasLogic;
const app = document.getElementById("app");

let data = {};
let tab = "home";

function todayISO() { return toISO(new Date()); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function cap1(s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }

// Plain-English "quickest way to done" line, shared by the Home tab and the PDF.
function fastestFinishText(s) {
  if (s.toGoal <= 0) return "Goal reached.";
  if (!s.canFinish) return `at ${s.hoursPerDay} h/day you'd still be about ${s.shortfall} h short by the deadline &mdash; talk to your assessor`;
  const dt = fmtDate(s.finishDate, { day: "numeric", month: "short", year: "numeric" });
  const spare = s.finishSpareDays;
  const tail = spare > 0 ? ` &mdash; ${spare} working day${spare === 1 ? "" : "s"} to spare` : " &mdash; right on the deadline";
  return `${s.finishDays} full days at ${s.hoursPerDay} h/day &mdash; done by ${dt}${tail}`;
}

// "How fast can the WHOLE portfolio be done" — the later of the hours gate and the write-ups gate.
function portfolioFinishText(s) {
  const hoursDone = s.toGoal <= 0;
  const jobsDone = s.jobsNeeded <= 0;
  if (hoursDone && jobsDone) return "Portfolio complete &mdash; hours and all write-ups done.";
  if (!s.portfolioCanFinish) {
    return `hours can't be finished in time at ${s.hoursPerDay} h/day (about ${s.shortfall} h short) &mdash; talk to your assessor`;
  }
  const dt = fmtDate(s.portfolioFinishDate, { day: "numeric", month: "short", year: "numeric" });
  const slack = s.portfolioSlackDays;
  const tail = slack > 0 ? `${slack} day${slack === 1 ? "" : "s"} before the deadline`
            : slack === 0 ? "right on the deadline"
            : `${-slack} day${slack === -1 ? "" : "s"} past the deadline`;
  const gate = s.portfolioGate === "write-ups"
    ? `write-ups are the hold-up (${s.jobsNeeded} to go at ${s.jobsPerWeek}/week)`
    : `hours are the hold-up (${s.finishDays} full days of work left)`;
  return `earliest realistic finish <b>${dt}</b> &mdash; ${tail}. ${cap1(gate)}.`;
}

// A standalone, print-ready HTML report to hand to a lecturer.
function buildReport(d, s) {
  const gen = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const name = (d.name || "").trim();
  let dl = d.deadline;
  try { dl = new Date(d.deadline + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) {}
  const row = (cells, th) => `<tr>${cells.map((c) => `<${th ? "th" : "td"}>${c}</${th ? "th" : "td"}>`).join("")}</tr>`;

  const jobRows = [...d.jobs].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((j) => row([j.date, cap1(j.type), cap1(j.boiler || "&mdash;"), j.type === "repair" ? cap1(j.fault || "&mdash;") : "&mdash;", (j.h ?? "") + " h", esc(j.engineer || "&mdash;")])).join("")
    || `<tr><td colspan="6" class="empty">No unassisted write-ups logged yet</td></tr>`;

  const engineers = (d.engineers || []);
  const engRows = engineers.map((e) => {
    const jobs = (d.jobs || []).filter((j) => j.engineer === e.name).length;
    const meta = [e.regNo && `Reg ${esc(e.regNo)}`, e.licence && `Licence ${esc(e.licence)}`,
      e.company && esc(e.company),
      e.expiry && `card to ${(() => { try { return new Date(e.expiry + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" }); } catch { return e.expiry; } })()}`
    ].filter(Boolean).join(" &middot; ");
    return row([esc(e.name), meta || "&mdash;", esc(e.categories || "&mdash;"), jobs]);
  }).join("");
  const hourRows = [...d.hours].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => row([r.date, (r.h ?? "") + " h", esc(r.note || "")])).join("")
    || `<tr><td colspan="3" class="empty">No assisted hours logged yet</td></tr>`;

  const covLine = (obj) => Object.entries(obj).map(([k, v]) =>
    `<span class="chip ${v > 0 ? "on" : ""}">${cap1(k)}${v > 0 ? " &#10003;" : ""}</span>`).join(" ");
  const jbar = (label, n, t) => {
    const pct = t > 0 ? Math.min(100, (n / t) * 100) : 0;
    return `<div class="jrow"><span class="jl">${label}</span>` +
      `<span class="jbar"><i style="width:${pct}%"></i></span>` +
      `<span class="jn ${n >= t && t > 0 ? "done" : ""}">${n} / ${t}</span></div>`;
  };

  const flame = `<svg width="30" height="35" viewBox="0 0 24 24" style="flex:none">` +
    `<path fill="#ffffff" d="M12.3 1.7C15.9 6 18.7 9.1 18.7 13.1 18.7 18.1 15.5 21.8 12 22.3 8.5 21.8 5.3 18.4 5.3 13 5.3 8.6 8.7 4.7 12.3 1.7Z"/></svg>`;
  const goalPct = Math.max(1.5, Math.min(100, s.pctGoal));
  const markPct = Math.max(0, Math.min(100, s.requiredMark));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Gas Portfolio Progress${name ? " &mdash; " + esc(name) : ""}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { background: #14161b; }
    body { font: 12px/1.55 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
           color: #eef1f5; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .head { background: linear-gradient(135deg, #2f7fd6, #59b8ff); color: #fff;
            padding: 22px 18mm; display: flex; align-items: center; gap: 13px; }
    .head .eyebrow { font-size: 9.5px; letter-spacing: 2.5px; text-transform: uppercase; opacity: .82; }
    .head h1 { font-size: 19px; margin: 2px 0 0; font-weight: 800; letter-spacing: -.3px; }
    .head .gen { margin-left: auto; font-size: 10px; opacity: .9; text-align: right; text-transform: uppercase; letter-spacing: .5px; }
    .wrap { padding: 26px 18mm 18mm; }
    section { margin-bottom: 26px; }
    h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #79b6f2; margin: 0 0 12px; font-weight: 700; }

    .stat { font-size: 34px; font-weight: 800; letter-spacing: -1px; line-height: 1; }
    .stat small { font-size: 14px; font-weight: 600; color: rgba(255,255,255,.4); margin-left: 4px; letter-spacing: 0; }
    .barcap { position: relative; height: 12px; font-size: 8.5px; color: rgba(255,255,255,.5); }
    .barcap span { position: absolute; white-space: nowrap; }
    .bar { position: relative; height: 9px; border-radius: 5px; background: rgba(255,255,255,.11); margin: 3px 0 6px; }
    .bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; background: linear-gradient(90deg, #3f8fd8, #6fbcff); }
    .bar > b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #fff; border-radius: 1px; }
    .barlbls { position: relative; height: 13px; font-size: 9px; color: rgba(255,255,255,.45); }
    .barlbls span { position: absolute; white-space: nowrap; }
    .barlbls .l0 { left: 0; } .barlbls .lg { right: 0; }
    .sub { font-size: 11px; color: rgba(255,255,255,.6); margin-top: 8px; }
    .sub b { color: #eef1f5; }

    .pace { font-size: 22px; font-weight: 800; letter-spacing: -.5px; }
    .pace.ok { color: #7fdcac; } .pace.warn { color: #ffb199; }

    .jrow { display: flex; align-items: center; gap: 10px; margin: 7px 0; }
    .jl { width: 66px; font-size: 11px; color: rgba(255,255,255,.7); }
    .jbar { flex: 1; height: 7px; border-radius: 4px; background: rgba(255,255,255,.11); position: relative; }
    .jbar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(90deg,#3f8fd8,#6fbcff); }
    .jn { width: 46px; text-align: right; font-size: 11px; font-weight: 700; color: rgba(255,255,255,.55); }
    .jn.done { color: #7fdcac; }
    .cov { margin-top: 12px; font-size: 10.5px; color: rgba(255,255,255,.55); }
    .cov .cl { display: inline-block; width: 66px; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .5px; font-size: 9px; }
    .chip { display: inline-block; padding: 2px 7px; margin: 0 2px; border-radius: 999px;
            background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.55); }
    .chip.on { background: rgba(99,200,148,.14); border-color: rgba(99,200,148,.4); color: #9fe6c0; }

    table { border-collapse: collapse; width: 100%; font-size: 10.5px; }
    th { text-align: left; padding: 7px 10px; color: #9dc4ef; font-weight: 700; text-transform: uppercase;
         font-size: 8.5px; letter-spacing: .8px; border-bottom: 1.5px solid rgba(255,255,255,.16); }
    td { padding: 6px 10px; color: rgba(255,255,255,.82); border-bottom: 1px solid rgba(255,255,255,.07); }
    tr:nth-child(even) td { background: rgba(255,255,255,.022); }
    td.empty { color: rgba(255,255,255,.4); font-style: italic; text-align: center; padding: 12px; }

    footer { margin-top: 6px; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.1);
             font-size: 8.5px; color: rgba(255,255,255,.32); }
  </style></head><body>
    <div class="head">
      ${flame}
      <div><div class="eyebrow">Gas Portfolio Tracker</div><h1>Progress report${name ? " &mdash; " + esc(name) : ""}</h1></div>
      <div class="gen">${gen}</div>
    </div>
    <div class="wrap">

      <section>
        <h2>Hours logged</h2>
        <div class="stat">${s.total}<small>/ ${d.goal} h</small></div>
        <div class="barcap"><span style="left:${markPct}%;transform:${markPct >= 80 ? "translateX(-100%)" : markPct <= 12 ? "translateX(0)" : "translateX(-50%)"}">${d.required} h &mdash; pass mark</span></div>
        <div class="bar"><i style="width:${goalPct}%"></i><b style="left:${markPct}%"></b></div>
        <div class="barlbls">
          <span class="l0">0</span>
          <span class="lg">${d.goal} h goal</span>
        </div>
        <div class="sub">${s.past275
          ? `<b>Pass mark reached.</b> `
          : `<b>${s.toRequired} h</b> to the ${d.required} h pass mark &nbsp;&middot;&nbsp; `}<b>${s.toGoal} h</b> to the goal &nbsp;&middot;&nbsp; ${Math.round(s.pctGoal)}% of goal &nbsp;&middot;&nbsp; ${s.assistedHours} h assisted, ${s.jobHours} h in write-ups</div>
      </section>

      <section>
        <h2>Deadline &amp; pace</h2>
        <div class="pace ${s.verdictOk ? "ok" : "warn"}">${s.perDayGoal} h per working day needed</div>
        <div class="sub"><b>${s.availDays}</b> working days left &nbsp;&middot;&nbsp; deadline <b>${dl}</b> &nbsp;&middot;&nbsp; ${esc(s.verdict)}</div>
        <div class="sub"><b>Quickest way there:</b> ${fastestFinishText(s)}</div>
        <div class="sub" style="color:rgba(255,255,255,.4)">A working day is Mon&ndash;Fri that isn't a college block week or a booked day off.</div>
      </section>

      <section>
        <h2>Unassisted write-ups &mdash; ${s.jobsDone} of ${s.jobsTotal}</h2>
        ${jbar("Installs", s.install, d.jobTargets.install)}
        ${jbar("Services", s.service, d.jobTargets.service)}
        ${jbar("Repairs", s.repair, d.jobTargets.repair)}
        <div class="cov"><span class="cl">Boilers</span> ${covLine(s.boiler)}</div>
        <div class="cov"><span class="cl">Faults</span> ${covLine(s.fault)}</div>
      </section>

      ${engineers.length ? `<section>
        <h2>Gas Safe engineers worked under</h2>
        <table>${row(["Name", "Registration", "Categories", "Jobs"], true)}${engRows}</table>
      </section>` : ""}

      <section>
        <h2>Write-up log</h2>
        <table>${row(["Date", "Category", "Boiler", "Fault", "Hours", "Supervised by"], true)}${jobRows}</table>
      </section>

      <section>
        <h2>Assisted hours log</h2>
        <table>${row(["Date", "Hours", "Note"], true)}${hourRows}</table>
      </section>

      <footer>Generated by Gas Portfolio Tracker on ${gen}${name ? " for " + esc(name) : ""}. Figures are self-recorded.</footer>
    </div>
  </body></html>`;
}

async function exportPdf() {
  const d = { ...DEFAULT_DATA, ...data };
  const html = buildReport(d, computeStatus(data));
  if (window.api.exportPdf) {
    try {
      const r = await window.api.exportPdf(html);
      toast(r && r.ok ? "PDF saved" : "cancelled");
    } catch (e) { toast("PDF export failed"); }
  } else {
    const w = window.open("", "_blank");
    if (!w) { toast("allow pop-ups, then try again"); return; }
    w.document.write(html); w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
  }
}

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

// ---------- self-update ----------
let _onUpdateProgress = null;
let _updating = false;
async function runUpdate(u, setText) {
  if (_updating) return;
  const say = setText || (() => {});
  if (!u || !u.newer) { say("You're on the latest version."); return; }
  if (!u.canSelfUpdate || !window.api.updateDownload) {
    say(`${esc(u.tag)} is available.`);
    window.api.openUrl(u.url || "https://github.com/awpehz/gas-portfolio-tracker/releases");
    return;
  }
  _updating = true;
  say(`Downloading ${esc(u.tag)}…`);
  _onUpdateProgress = (p) => say(`Downloading ${esc(u.tag)}… ${Math.round(p * 100)}%`);
  try {
    const r = await window.api.updateDownload();
    _onUpdateProgress = null;
    if (!r || !r.ok) { say((r && r.error) || "Download failed."); _updating = false; return; }
    say("Restarting to finish…");
    await window.api.updateInstall();
  } catch (e) {
    say("Update failed — try again later.");
    _updating = false;
  }
}

async function save() { await window.api.setData(data); render(); }

// ---------- actions ----------
function addHours(h, dateISO, note) {
  h = Number(h);
  if (isNaN(h) || h <= 0) { toast("enter hours as a number"); return; }
  data.hours.push({ date: dateISO || todayISO(), h, note: note || "" });
  toast(`+${h}h logged`); save();
}
function setWeekTotal(h) {
  h = Number(h);
  if (isNaN(h) || h < 0) { toast("enter a number"); return; }
  const key = window.GasLogic.isoWeek(new Date());
  data.hours = data.hours.filter((r) => {
    const d = window.GasLogic.parseISO(r.date);
    return isNaN(d) || window.GasLogic.isoWeek(d) !== key;
  });
  data.hours.push({ date: todayISO(), h, note: "week total" });
  toast(`week set to ${h}h`); save();
}
// when set, the next write-up logged replaces this hours[] entry instead of adding fresh hours
let pendingConvert = null;

function addJob(type, h, boiler, fault, engineer) {
  h = Number(h) || 2;
  const row = { date: (pendingConvert && pendingConvert.date) || todayISO(), type, h, boiler: boiler || "" };
  if (type === "repair" && fault) row.fault = fault;
  if (engineer) row.engineer = engineer;
  data.jobs.push(row);
  if (pendingConvert) {
    if (Array.isArray(data.hours) && data.hours[pendingConvert.i]) data.hours.splice(pendingConvert.i, 1);
    pendingConvert = null;
  }
  const bits = [type, boiler, type === "repair" && fault ? fault : null].filter(Boolean).join(" / ");
  toast(`${bits} (+${h}h)`); save();
}
function addOff(startISO, days) {
  const d0 = window.GasLogic.parseISO(startISO);
  if (isNaN(d0) || !days) { toast("pick a start date"); return; }
  let n = 0;
  const cur = new Date(d0);
  for (let i = 0; i < days; i++, cur.setDate(cur.getDate() + 1)) {
    if (cur.getDay() === 0 || cur.getDay() === 6) continue;   // weekdays only
    const iso = toISO(cur);
    if (!data.off.includes(iso)) { data.off.push(iso); n++; }
  }
  data.off.sort();
  toast(`${n} work day(s) off added`); save();
}
function removeEntry(arrName, idx) {
  const arr = data[arrName];
  if (Array.isArray(arr) && idx >= 0 && idx < arr.length) {
    arr.splice(idx, 1);
    toast("removed"); save();
  }
}



const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function countUp(scope) {
  scope.querySelectorAll(".v[data-to]").forEach((el) => {
    const to = parseFloat(el.dataset.to) || 0;
    const dp = el.dataset.dp != null ? parseInt(el.dataset.dp, 10) : (to % 1 === 0 ? 0 : 1);
    if (RM || to === 0) { el.textContent = trimNum(to, dp); return; }
    const t0 = performance.now(), dur = 460;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = trimNum(to * e, dp);
      if (k < 1) requestAnimationFrame(tick); else el.textContent = trimNum(to, dp);
    };
    requestAnimationFrame(tick);
  });
}
function trimNum(n, dp) { return dp ? n.toFixed(dp).replace(/\.0$/, "") : String(Math.round(n)); }

// The pressure gauge lives in gauge.js (shared with the desktop widget).
const gaugeSVG = (s) => window.GaugeUI.svg(s);

// ---------- render ----------
const TABS = [
  ["home", "Home"],
  ["assisted", "Hours"],
  ["unassisted", "Jobs"],
  ["report", "Report"],
  ["settings", "Settings"],
  ["help", "Help"],
];

let prevStatus = null;
function render() {
  if (tab !== "unassisted") pendingConvert = null;
  const s = computeStatus(data);
  app.innerHTML = "";
  app.appendChild(tabBar());
  if (tab === "home") app.appendChild(homePane(s));
  else if (tab === "assisted") app.appendChild(hoursPane(s));
  else if (tab === "unassisted") app.appendChild(writeupsPane(s));
  else if (tab === "report") app.appendChild(reportPane(s));
  else if (tab === "help") app.appendChild(helpPane());
  else app.appendChild(settingsPane());
  countUp(app);
  flourish(prevStatus, s);
  prevStatus = s;
  wire(s);
}

// one-shot glow when a real milestone is hit
function flourish(prev, s) {
  if (RM || !prev || tab !== "home") return;
  const flash = (sel) => {
    const el = app.querySelector(sel);
    if (!el) return;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  };
  if (!prev.past275 && s.past275) flash(".hero .stat .v");
  if (prev.jobsNeeded > 0 && s.jobsNeeded === 0) flash('[data-flag="jobsdone"]');
  if (prev.toGoal > 0 && s.toGoal <= 0) flash(".hero .stat .v");
  for (const k of s.boilerTypes || [])
    if ((prev.boiler[k] || 0) === 0 && s.boiler[k] > 0) flash(`[data-cov="b:${k}"]`);
  for (const k of s.repairFaults || [])
    if ((prev.fault[k] || 0) === 0 && s.fault[k] > 0) flash(`[data-cov="f:${k}"]`);
}

function tabBar() {
  const el = document.createElement("nav");
  el.className = "tabs";
  for (const [k, label] of TABS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = tab === k ? "on" : "";
    b.onclick = () => { tab = k; render(); };
    el.appendChild(b);
  }
  return el;
}

function homePane(s) {
  const el = document.createElement("section");
  el.className = "card dash home";
  const weekAim = Math.round(s.perDayGoal * 5 * 10) / 10;
  const weekPct = weekAim > 0 ? Math.min(100, Math.round((s.weekLogged / weekAim) * 100)) : 0;
  const college = s.atCollegeNow
    ? `At college &mdash; back on the tools ${s.backOnTools}`
    : `Next block ${s.nextBlock}${s.nextBlockDays != null ? ` &middot; in ${s.nextBlockDays} days` : ""}`;

  // one stat tile
  const tile = (k, v, sub, cls = "") =>
    `<div class="htile ${cls}"><div class="ht-k">${k}</div><div class="ht-v">${v}</div><div class="ht-s">${sub}</div></div>`;

  // mini progress bar for a job type
  const jb = (label, n, t) => {
    const pct = t > 0 ? Math.min(100, Math.round((n / t) * 100)) : 0;
    return `<div class="jline"><span class="jl-l">${label}</span>
      <span class="jl-bar"><i style="width:${pct}%"></i></span>
      <span class="jl-n ${n >= t ? "done" : ""}">${n}/${t}</span></div>`;
  };
  // coverage pips
  const pips = (obj, kind) => Object.entries(obj).map(([k, v]) =>
    `<span class="pip ${v > 0 ? "on" : ""}" data-cov="${kind}:${k}" title="${cap1(k)}${v ? ` &times;${v}` : ""}">${cap1(k)}</span>`).join("");

  const rateCls = s.verdictOk ? (s.perDayGoal > s.hoursPerDay * 0.75 ? "amber" : "good") : "bad";
  const finishV = s.toGoal <= 0 ? "Done"
    : s.canFinish ? fmtDate(s.finishDate, { day: "numeric", month: "short" }) : "Off pace";
  const finishS = s.toGoal <= 0 ? "goal reached"
    : s.canFinish ? `at ${s.hoursPerDay} h/day &middot; ${s.finishSpareDays} working day${s.finishSpareDays === 1 ? "" : "s"} spare`
    : `${s.shortfall} h short at ${s.hoursPerDay} h/day`;
  const portDate = s.portfolioCanFinish ? fmtDate(s.portfolioFinishDate, { day: "numeric", month: "short", year: "numeric" }) : "&mdash;";
  const portSlack = s.portfolioSlackDays == null ? ""
    : s.portfolioSlackDays >= 0 ? `${s.portfolioSlackDays} days before the deadline`
    : `${-s.portfolioSlackDays} days past the deadline`;
  const gateWord = s.portfolioGate === "write-ups" ? "write-ups are the hold-up" : "hours are the hold-up";
  const gaps = [...s.boilerGaps.map(cap1), ...s.faultGaps.map((f) => cap1(f) + " fault")];

  el.innerHTML = `
    <div class="hero">
      <svg class="flame md" viewBox="0 0 24 24"><path class="f-outer" d="M12.3 1.7C15.9 6 18.7 9.1 18.7 13.1 18.7 18.1 15.5 21.8 12 22.3 8.5 21.8 5.3 18.4 5.3 13 5.3 8.6 8.7 4.7 12.3 1.7Z" fill="url(#flameGrad)"/><path class="f-cone" d="M12 9C13.7 11.8 14.6 13.8 14.6 16 14.6 19 13.2 20.9 12 21.1 10.6 20.9 9.4 19 9.4 16.3 9.4 13.9 10.6 11.7 12 9Z" fill="url(#flameCone)"/><ellipse class="f-core" cx="12" cy="17.3" rx="1.8" ry="3" fill="#fff"/></svg>
      <div class="hcap">Progress</div>
      <div class="gaugewrap">
        ${gaugeSVG(s)}
        <div class="gaugereadout">
          <div class="stat"><span class="v" data-to="${s.total}">0</span><small> / ${s.goal} h</small></div>
        </div>
      </div>
      <div class="gaugesub">${s.past275 ? '<span class="pastmark">&#10003;&nbsp; past the 275&nbsp;h pass mark</span>' : `<span class="v" data-to="${s.toRequired}">0</span> h to the pass mark`}<span class="sep">&bull;</span>${s.toGoal} h to goal</div>
    </div>

    <div class="hgrid">
      ${tile("Rate needed", `${trimNum(s.perDayGoal, 1)}<em> h/day</em>`, esc(s.verdict), rateCls)}
      ${tile("This week", `${trimNum(s.weekLogged, 1)}<em> h</em>`, `aim ~${weekAim} h`, s.weekLogged >= weekAim && weekAim > 0 ? "good" : "")}
      ${tile("Flat out, hours done", finishV, finishS)}
      ${tile("Deadline", `${s.daysLeft}<em> days</em>`, s.dl || d0(data).deadline)}
    </div>

    <div class="pstrip ${s.portfolioGate === "write-ups" ? "" : "hrs"}">
      <div class="ps-k">Earliest realistic finish</div>
      <div class="ps-v">${portDate}</div>
      <div class="ps-s">${portSlack ? portSlack + " &middot; " : ""}${gateWord}</div>
      ${gaps.length ? `<div class="ps-s">still need ${gaps.join(" &middot; ")}</div>` : ""}
    </div>

    <div class="hsec">
      <div class="hcap">Write-ups <span class="dim" data-flag="jobsdone">${s.jobsDone} / ${s.jobsTotal}</span></div>
      <div class="jlines">
        ${jb("Installs", s.install, s.targets.install)}
        ${jb("Services", s.service, s.targets.service)}
        ${jb("Repairs", s.repair, s.targets.repair)}
      </div>
      <div class="pips">${pips(s.boiler, "b")}<span class="pip-sep"></span>${pips(s.fault, "f")}</div>
    </div>

    <div class="hrow"><span class="hr-i">&#9788;</span> ${college}</div>

    <div class="qrow">
      <button class="pill" data-q="2">+2 h</button>
      <button class="pill" data-q="3">+3 h</button>
      <button class="pill" data-q="4">+4 h</button>
      <button class="pill go" data-goto="unassisted">Log a write-up &rarr;</button>
    </div>`;
  return el;
}

function d0(x) { return { ...DEFAULT_DATA, ...x }; }

function dash(s) {
  const el = document.createElement("section");
  el.className = "card dash";
  const paceCls = s.verdictOk ? "ok" : "warn";
  const college = s.atCollegeNow
    ? `At college now &mdash; back on the tools ${s.backOnTools}`
    : `Next college block ${s.nextBlock}${s.nextBlockDays != null ? ` &middot; in ${s.nextBlockDays} days` : ""}`;
  el.innerHTML = `
    <div class="dash-top">
      <div>
        <div class="stat"><span class="v" data-to="${s.total}">0</span><small> / ${s.goal} h</small></div>
        <div class="stat-l">${s.past275 ? "past the 275 pass mark" : `<span class="v" data-to="${s.toRequired}">0</span> h to pass (275)`}</div>
      </div>
      <div class="right">
        <div class="stat"><span class="v" data-to="${s.jobsDone}">0</span><small> / ${s.jobsTotal}</small></div>
        <div class="stat-l">write-ups</div>
      </div>
    </div>
    <div class="bar"><i style="--w:${Math.max(3, s.pctGoal)}%"></i><b style="left:${s.requiredMark}%"></b></div>
    <div class="pace ${paceCls}"><span class="v" data-to="${s.perDayGoal}" data-dp="1">0</span> h/day needed<span class="dim"> &middot; ${s.availDays} working days left</span></div>
    <div class="dim sm">${esc(s.verdict)}</div>
    <div class="dim sm" style="margin-top:4px">${esc(college)}</div>`;
  return el;
}

function hoursPane(s) {
  const el = document.createElement("section");
  el.className = "card";
  const recent = data.hours.map((r, i) => ({ r, i })).slice(-10).reverse().map(({ r, i }) =>
    `<li><span class="li-d">${esc(r.date)}</span><span class="li-v">${r.h} h${r.note ? " &middot; " + esc(r.note) : ""}</span>` +
    `<button class="conv" data-conv="${i}" title="turn this into a write-up">&rarr; write-up</button>` +
    `<button class="del" data-arr="hours" data-i="${i}" title="delete">&times;</button></li>`).join("");
  const today = todayISO();
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  el.innerHTML = `
    <h3>Assisted hours <span class="h3-r">this week ${s.weekLogged} h</span></h3>
    <p class="dim">Hours worked alongside a Gas&nbsp;Safe engineer.</p>

    <div class="bighours">
      <input type="number" id="ah" step="0.5" min="0" inputmode="decimal" placeholder="0" aria-label="Hours">
      <span class="u">h</span>
    </div>
    <div class="hstep">
      <button type="button" data-add="0.5">+0.5</button>
      <button type="button" data-add="1">+1</button>
      <button type="button" data-add="2">+2</button>
      <button type="button" data-add="4">+4</button>
      <button type="button" data-add="clear" class="ghost">clear</button>
    </div>

    <div class="whenrow">
      <span class="wl">When</span>
      <div class="seg2" id="when">
        <button type="button" data-when="today" class="on">Today &middot; ${todayLabel}</button>
        <button type="button" data-when="pick">Pick a date</button>
      </div>
    </div>
    <input type="date" id="ad" value="${today}" max="${today}" hidden>

    <label class="chk"><input type="checkbox" id="awk"> this is my whole-week total (replaces the week)</label>
    <button class="btn big" id="ahlog">Log hours</button>

    <div class="listwrap">
      <div class="list-h">Recent</div>
      <ul class="list">${recent || '<li class="empty">nothing logged yet</li>'}</ul>
    </div>`;
  return el;
}

function writeupsPane(s) {
  const el = document.createElement("section");
  el.className = "card";
  const t = s.targets;
  const tile = (label, key, n, tg) =>
    `<button class="tile" data-type="${key}">
       <span class="tile-n ${n >= tg ? "done" : ""}">${n}<i>/${tg}</i></span>
       <span class="tile-l">${label}</span></button>`;
  const cover = (obj) => Object.entries(obj).map(([k, v]) =>
    `<span class="${v > 0 ? "ok" : "dim"}">${cap1(k)} ${v}</span>`).join('<span class="dim"> &middot; </span>');
  const opt = (o) => `<option value="${o}">${cap1(o)}</option>`;
  const recent = data.jobs.map((r, i) => ({ r, i })).slice(-10).reverse().map(({ r, i }) => {
    const bits = [r.type, r.boiler, r.fault].filter(Boolean).map(cap1).join(" / ");
    const eng = r.engineer ? ` &middot; ${esc(r.engineer)}` : "";
    return `<li><span class="li-d">${esc(r.date)}</span><span class="li-v">${esc(bits)} &middot; ${r.h} h${eng}</span>` +
      `<button class="del" data-arr="jobs" data-i="${i}" title="delete">&times;</button></li>`;
  }).join("");
  const engOpts = (data.engineers || []).map((e) => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join("");
  const pc = pendingConvert;
  el.innerHTML = `
    <h3>Unassisted write-ups <span class="h3-r">${s.jobsDone}/${s.jobsTotal} &middot; ${s.jobHours} h</span></h3>
    ${pc ? `<div class="convbanner">Converting <b>${pc.h} h</b> logged on <b>${esc(pc.date)}</b> &mdash; set the details below and log it. Those hours move across, they don't double-count. <button class="cx" id="convcancel">cancel</button></div>` : ""}
    <div class="tiles">${tile("Installs", "install", s.install, t.install)}${tile("Services", "service", s.service, t.service)}${tile("Repairs", "repair", s.repair, t.repair)}</div>
    <div class="cover">
      <div><span class="cl">Boilers</span> ${cover(s.boiler)}${s.boilerCovered ? ' <span class="ok">✓</span>' : ""}</div>
      <div><span class="cl">Faults</span> ${cover(s.fault)}${s.faultsCovered ? ' <span class="ok">✓</span>' : ""}</div>
    </div>
    <div class="form3">
      <label>Type<select id="jtype">${["install", "service", "repair"].map(opt).join("")}</select></label>
      <label>Boiler<select id="jboiler">${s.boilerTypes.map(opt).join("")}</select></label>
      <label>Fault<select id="jfault">${s.repairFaults.map(opt).join("")}</select></label>
      <label>Hours<input type="number" id="jh" step="0.5" min="0" value="2" inputmode="decimal"></label>
    </div>
    <label class="wide">Supervised by ${engOpts ? "" : `<span class="dim sm">(add engineers in Settings)</span>`}
      <select id="jeng"><option value="">&mdash;</option>${engOpts}</select></label>
    <button class="btn" id="jlog">Log write-up</button>
    <p class="dim sm">Tapping a tile logs one straight away using the dropdowns. Fault only counts on repairs.</p>
    <div class="listwrap">
      <div class="list-h">Recent</div>
      <ul class="list">${recent || '<li class="empty">nothing logged yet</li>'}</ul>
    </div>`;
  return el;
}

function reportPane(s) {
  const el = document.createElement("section");
  el.className = "card";
  el.innerHTML = `
    <h3>Portfolio report</h3>
    <p class="dim">A one-page progress sheet for your lecturer &mdash; hours vs the pass mark
    and goal, deadline and pace, write-up counts, boiler &amp; fault coverage, and the
    full log of everything you've entered.</p>
    <label class="wide">Your name (appears on the sheet)
      <input type="text" id="r_name" value="${esc(data.name || "")}" placeholder="e.g. C. Wales" maxlength="60"></label>
    <div class="report-preview" style="margin-top:12px">
      <div><b>${s.total} h</b><span>total logged</span></div>
      <div><b>${s.jobsDone}/${s.jobsTotal}</b><span>write-ups</span></div>
      <div><b>${s.perDayGoal} h/day</b><span>rate needed</span></div>
      <div><b>${s.availDays}</b><span>working days left</span></div>
    </div>
    <button class="btn" id="r_pdf">Export PDF</button>
    <p class="dim sm">${window.api.exportPdf ? "Opens a Save dialog." : "Opens a print view &mdash; choose 'Save as PDF'."}</p>`;
  return el;
}

function mondayISO(iso) {
  const dt = parseISO(iso);
  if (isNaN(dt)) return null;
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return toISO(dt);
}
function fmtDate(iso, opts) {
  const dt = parseISO(iso);
  return isNaN(dt) ? iso : dt.toLocaleDateString(undefined, opts || { weekday: "short", day: "numeric", month: "short" });
}
function groupRanges(isos) {
  const sorted = [...new Set(isos)].filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const out = [];
  for (const iso of sorted) {
    const last = out[out.length - 1];
    if (last) {
      const nxt = parseISO(last.to); nxt.setDate(nxt.getDate() + 1);
      while (nxt.getDay() === 0 || nxt.getDay() === 6) nxt.setDate(nxt.getDate() + 1);
      if (toISO(nxt) === iso) { last.to = iso; last.dates.push(iso); continue; }
    }
    out.push({ from: iso, to: iso, dates: [iso] });
  }
  return out;
}

function settingsPane() {
  const el = document.createElement("section");
  el.className = "card";
  const d = { ...DEFAULT_DATA, ...data };
  const s = computeStatus(data);

  const blockChips = [...(d.blocks || [])].sort().map((iso) =>
    `<span class="chip2">w/c ${fmtDate(iso)} <button data-x="cb" data-v="${iso}" title="remove">&times;</button></span>`
  ).join("") || `<span class="dim sm">none set</span>`;

  const offChips = groupRanges(d.off || []).map((r) => {
    const label = r.from === r.to
      ? fmtDate(r.from)
      : `${fmtDate(r.from, { day: "numeric", month: "short" })} &ndash; ${fmtDate(r.to, { day: "numeric", month: "short" })}`;
    return `<span class="chip2">${label} <button data-x="off" data-v="${r.dates.join(",")}" title="remove">&times;</button></span>`;
  }).join("") || `<span class="dim sm">none set</span>`;

  const engRows = (d.engineers || []).map((e, i) => {
    const jobs = (d.jobs || []).filter((j) => j.engineer === e.name).length;
    const bits = [e.regNo && `reg ${esc(e.regNo)}`, e.company && esc(e.company),
      e.expiry && `card to ${fmtDate(e.expiry, { month: "short", year: "numeric" })}`,
      jobs ? `${jobs} job${jobs === 1 ? "" : "s"}` : null].filter(Boolean).join(" &middot; ");
    return `<div class="engrow"><div><b>${esc(e.name)}</b>${bits ? `<div class="dim sm">${bits}</div>` : ""}` +
      `${e.categories ? `<div class="dim sm">${esc(e.categories)}</div>` : ""}</div>` +
      `<button class="del" data-eng="${i}" title="remove">&times;</button></div>`;
  }).join("") || `<span class="dim sm">none added</span>`;

  el.innerHTML = `
    <h3>Settings</h3>
    <div class="sgrid">
      <label>Starting hours<input type="number" id="s_base" value="${d.baseHours}"></label>
      <label>Hours in a work day<input type="number" id="s_hpd" value="${d.hoursPerDay}"></label>
      <label>Pass mark (h)<input type="number" id="s_req" value="${d.required}"></label>
      <label>Personal goal (h)<input type="number" id="s_goal" value="${d.goal}"></label>
      <label class="wide">Deadline<input type="date" id="s_dl" value="${d.deadline}"></label>
      <label>Installs needed<input type="number" id="s_ti" value="${d.jobTargets.install}"></label>
      <label>Services needed<input type="number" id="s_ts" value="${d.jobTargets.service}"></label>
      <label>Repairs needed<input type="number" id="s_tr" value="${d.jobTargets.repair}"></label>
      <label>Write-ups per week (estimate)<input type="number" id="s_jpw" step="0.5" min="0.5" value="${d.jobsPerWeek ?? DEFAULT_DATA.jobsPerWeek}"></label>
    </div>
    <button class="btn" id="s_save">Save settings</button>

    <div class="chipedit">
      <div class="ce-h">College block weeks</div>
      <div class="ce-list" id="cb_list">${blockChips}</div>
      <div class="ce-add">
        <input type="date" id="cb_date">
        <button class="btn ghost sm" id="cb_go">Add week</button>
      </div>
    </div>
    <div class="chipedit">
      <div class="ce-h">Days off / holidays</div>
      <div class="ce-list" id="off_list">${offChips}</div>
      <div class="ce-add">
        <input type="date" id="off_from"> <span class="dim sm">to</span> <input type="date" id="off_to">
        <button class="btn ghost sm" id="off_go">Add</button>
      </div>
    </div>
    <p class="dim sm">${s.blocksBeforeDeadline} college week${s.blocksBeforeDeadline === 1 ? "" : "s"} and ${s.offDays} day${s.offDays === 1 ? "" : "s"} off before the deadline &middot; ${s.availDays} working days left</p>

    <div class="chipedit">
      <div class="ce-h">Gas Safe engineers &mdash; who you've worked under</div>
      <div class="englist" id="eng_list">${engRows}</div>
      <div class="engadd">
        <input type="text" id="e_name" placeholder="Name" maxlength="60">
        <input type="text" id="e_reg" placeholder="Gas Safe reg no" maxlength="20">
        <input type="text" id="e_lic" placeholder="Licence no" maxlength="20">
        <input type="text" id="e_co" placeholder="Company" maxlength="60">
        <input type="date" id="e_exp" title="card expiry">
        <input type="text" id="e_cat" placeholder="Categories (e.g. CENWAT, CKR, HTR)" maxlength="120">
        <button class="btn ghost sm" id="e_add">Add engineer</button>
      </div>
    </div>

    <label class="chk" id="s_widget_l"><input type="checkbox" id="s_widget"> Show desktop widget &mdash; a translucent card on your desktop, controlled from the menu bar</label>
    <label class="chk" id="s_remind_l"><input type="checkbox" id="s_remind"> Daily reminder at 5:30&thinsp;pm (weekdays) to log jobs &mdash; skipped if you've already logged something that day</label>
    <p class="dim sm" id="s_remind_cal_p" style="margin:-6px 0 0 24px"><a id="s_remind_cal">Add it to your Calendar</a> &mdash; syncs the alert to your phone</p>
    <div class="row-links">
      <a id="s_export">export my data</a>
      <label class="filelink">import data<input type="file" id="s_import" accept="application/json" hidden></label>
      <a id="s_reset" class="danger">reset everything</a>
    </div>
    <div class="upsec">
      <span class="dim sm">Version ${window.__ver || "1.0"}</span>
      <button class="btn ghost sm" id="s_update">Check for updates</button>
      <span class="dim sm" id="s_update_msg"></span>
    </div>`;
  return el;
}


function helpPane() {
  const el = document.createElement("section");
  el.className = "card help";
  const faq = (q, a) => `<details><summary>${q}</summary><p>${a}</p></details>`;
  el.innerHTML = `
    <h3>How it works</h3>
    <h4>The top panel</h4>
    <p>Your <b>total hours vs goal</b>, the bar (the tick is the <b>pass mark</b>),
    <b>rate needed</b> &mdash; hours per working day to reach the goal by your deadline &mdash; and
    whether that's realistic. A working day is Mon&ndash;Fri that isn't a college block week
    or a booked holiday.</p>
    <h4>Hours tab</h4>
    <p>Assisted work &mdash; hours alongside a Gas&nbsp;Safe engineer. Type the hours, pick the
    date, <b>Log hours</b>. Tick <b>whole-week total</b> to set one figure for the week
    instead of adding. Each entry in the Recent list has its own <b>&times;</b> to delete just that one.</p>
    <h4>Write-ups tab</h4>
    <p>Your 14 unassisted jobs (5 / 5 / 4, all editable in Settings). Pick the type, the
    <b>boiler</b> and, for repairs, the <b>fault</b>, set the hours, and who
    <b>supervised</b> it (from the engineers you've added in Settings), then <b>Log write-up</b>.
    Those hours count toward your total too. Tapping a tile logs one instantly.</p>
    <h4>Report tab</h4>
    <p><b>Export PDF</b> &mdash; a one-page progress sheet for your lecturer. Add your name on the Report tab before exporting.</p>
    <h4>Settings</h4>
    <p>Every number is adjustable. Add the <b>Gas Safe engineers</b> you've worked under
    (name, registration, licence, categories, card expiry) &mdash; write-ups link to them and
    they appear on the PDF. <b>export / import data</b> moves your whole tracker between machines.</p>
    <h4>Desktop widget</h4>
    <p>Turn it on with the <span class="k">&#9713;</span> button, <span class="k">Cmd/Ctrl + Shift + W</span>, or the tick-box in Settings. It sits on your desktop behind your windows &mdash; total, bar and daily rate, updating live &mdash; and stays there even when the app is closed. Control it from the <b>menu-bar flame</b> at the top of the screen: open the app, log +2 h, move the widget to another corner, or set it to start at login. Closing the app window just tucks it away; the widget and menu-bar icon keep going until you pick <b>Quit</b>. The <span class="k">pin</span> button just keeps the app window itself on top.</p>

    <h3 style="margin-top:16px">FAQ</h3>
    ${faq("Does any of this leave my computer?", "No. Everything is saved on your machine. The PDF and data export are files you choose to share.")}
    ${faq("I logged the wrong thing.", "Hit the <b>&times;</b> next to that entry in the Recent list. Or open the raw file &mdash; app menu &rarr; Data &rarr; Reveal data file.")}
    ${faq("Why did the rate needed jump up?", "It's spread only over the days you're actually available. Adding a college week or a holiday takes days out, so the rate on the days that remain goes up.")}
    ${faq("Can I log for a day in the past?", "Yes &mdash; the Hours tab has a date picker next to the hours box.")}
    ${faq("I got a new laptop.", "Settings &rarr; <b>export my data</b> on the old one, <b>import data</b> on the new one.")}
    ${faq("The Windows app says 'unknown publisher'.", "It isn't code-signed. <b>More info &rarr; Run anyway</b> on Windows, or right-click &rarr; Open on Mac. The source is on GitHub.")}
    ${faq("My numbers disappeared.", "Data is per machine. Clearing site data or switching browser loses it unless you exported a backup first.")}
  `;
  return el;
}

// titlebar buttons live outside #app &mdash; wire once
function wireTitlebar() {
  const pin = document.getElementById("pin");
  if (pin) pin.onclick = async () => {
    window.api.win("pin");
    setTimeout(async () => pin.classList.toggle("on", await window.api.isPinned()), 60);
  };
  const min = document.getElementById("min");
  if (min) min.onclick = () => window.api.win("min");
  const close = document.getElementById("close");
  if (close) close.onclick = () => window.api.win("close");

  const wbtn = document.getElementById("widget");
  if (wbtn) {
    if (!window.api.widget) { wbtn.style.display = "none"; }
    else {
      wbtn.onclick = () => window.api.widget(!wbtn.classList.contains("on"));
      if (window.api.widgetState) {
        window.api.widgetState().then((on) => wbtn.classList.toggle("on", !!on)).catch(() => {});
      }
    }
  }
  if (window.api.onWidgetMode) {
    window.api.onWidgetMode((on) => {
      document.getElementById("widget")?.classList.toggle("on", !!on);
      const chk = document.getElementById("s_widget");
      if (chk) chk.checked = !!on;
    });
  }
}

// ---------- wiring (re-run each render; #app is rebuilt, so no listener leak) ----------
function wire(s) {
  if (tab === "home") {
    app.querySelectorAll("[data-q]").forEach((b) =>
      b.addEventListener("click", () => {
        b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
        addHours(b.dataset.q, todayISO());
      }));
    app.querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => { tab = b.dataset.goto; render(); }));
  }
  app.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", () => removeEntry(b.dataset.arr, parseInt(b.dataset.i, 10))));
  if (tab === "assisted") {
    const h = document.getElementById("ah");
    const btn = document.getElementById("ahlog");
    const wk = document.getElementById("awk");
    const dateEl = document.getElementById("ad");
    const r1 = (n) => Math.round(n * 10) / 10;
    const val = () => { const n = Number(h.value); return isNaN(n) ? 0 : n; };
    const syncBtn = () => {
      const v = val();
      btn.textContent = wk.checked
        ? (v > 0 ? `Set week to ${r1(v)} h` : "Set week total")
        : (v > 0 ? `Log ${r1(v)} h` : "Log hours");
    };
    const go = () => {
      if (wk.checked) setWeekTotal(h.value);
      else addHours(h.value, dateEl.value);
    };
    app.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.add === "clear") h.value = "";
      else h.value = r1(Math.max(0, val() + Number(b.dataset.add)));
      syncBtn(); h.focus({ preventScroll: true });
    }));
    app.querySelectorAll("#when button").forEach((b) => b.addEventListener("click", () => {
      app.querySelectorAll("#when button").forEach((x) => x.classList.toggle("on", x === b));
      const pick = b.dataset.when === "pick";
      dateEl.hidden = !pick;
      if (!pick) dateEl.value = todayISO();
      if (pick) dateEl.showPicker ? dateEl.showPicker() : dateEl.focus();
    }));
    h.addEventListener("input", syncBtn);
    wk.addEventListener("change", syncBtn);
    btn.onclick = go;
    h.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    syncBtn();
    h.focus({ preventScroll: true });

    app.querySelectorAll("[data-conv]").forEach((b) => b.addEventListener("click", () => {
      const i = parseInt(b.dataset.conv, 10);
      const r = data.hours[i];
      if (!r) return;
      pendingConvert = { i, date: r.date, h: r.h };
      tab = "unassisted"; render();
    }));
  }

  if (tab === "unassisted") {
    const jt = document.getElementById("jtype");
    const jb = document.getElementById("jboiler");
    const jf = document.getElementById("jfault");
    const jh = document.getElementById("jh");
    if (pendingConvert) {
      jh.value = pendingConvert.h;
      const cc = document.getElementById("convcancel");
      if (cc) cc.onclick = () => { pendingConvert = null; render(); };
    }
    const syncFault = () => {
      const on = jt.value === "repair";
      jf.disabled = !on;
      jf.closest("label").style.opacity = on ? "1" : "0.4";
    };
    jt.addEventListener("change", syncFault);
    syncFault();
    const je = document.getElementById("jeng");
    document.querySelectorAll(".tile").forEach((el) =>
      el.addEventListener("click", () => {
        const type = el.dataset.type;
        addJob(type, Number(jh.value) || 2, jb.value, type === "repair" ? jf.value : undefined, je && je.value);
      }));
    const go = () => addJob(jt.value, jh.value, jb.value, jt.value === "repair" ? jf.value : undefined, je && je.value);
    document.getElementById("jlog").onclick = go;
    jh.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }


  if (tab === "report") {
    const nm = document.getElementById("r_name");
    nm.addEventListener("input", () => { data.name = nm.value.trim(); });
    document.getElementById("r_pdf").onclick = () => { data.name = nm.value.trim(); save(); exportPdf(); };
  }

  if (tab === "settings") {
    const wchk = document.getElementById("s_widget");
    if (!window.api.widget) {
      document.getElementById("s_widget_l").style.display = "none";
    } else {
      if (window.api.widgetState) window.api.widgetState().then((on) => { wchk.checked = !!on; }).catch(() => {});
      wchk.onchange = () => window.api.widget(wchk.checked);
    }

    const rchk = document.getElementById("s_remind");
    if (!window.api.setReminder) {
      document.getElementById("s_remind_l").style.display = "none";
      document.getElementById("s_remind_cal_p").style.display = "none";
    } else {
      if (window.api.reminderState) window.api.reminderState().then((on) => { rchk.checked = !!on; }).catch(() => {});
      rchk.onchange = () => window.api.setReminder(rchk.checked);
    }
    const rcal = document.getElementById("s_remind_cal");
    if (rcal) {
      if (!window.api.addCalendarReminder) {
        document.getElementById("s_remind_cal_p").style.display = "none";
      } else {
        rcal.onclick = async () => {
          const r = await window.api.addCalendarReminder().catch(() => null);
          toast(r && r.ok ? "opening Calendar — pick an iCloud calendar" : "couldn't open Calendar");
        };
      }
    }

    const ub = document.getElementById("s_update");
    const um = document.getElementById("s_update_msg");
    if (ub && window.api.checkUpdate) {
      ub.onclick = async () => {
        if (_updating) return;
        ub.disabled = true; um.textContent = "Checking…";
        const u = await window.api.checkUpdate().catch(() => null);
        ub.disabled = false;
        if (!u || !u.newer) { um.textContent = "You're on the latest version."; return; }
        ub.textContent = `Download & install ${u.tag}`;
        ub.onclick = () => { ub.disabled = true; runUpdate(u, (t) => { um.innerHTML = t; }); };
      };
    } else if (ub) {
      ub.style.display = "none";
    }
    // college weeks + days off — edit live as chips
    document.getElementById("cb_go").onclick = () => {
      const m = mondayISO(document.getElementById("cb_date").value);
      if (!m) { toast("pick a date"); return; }
      if (!Array.isArray(data.blocks)) data.blocks = [];
      if (data.blocks.includes(m)) { toast("already added"); return; }
      data.blocks.push(m); data.blocks.sort();
      toast("college week added"); save();
    };
    document.getElementById("off_go").onclick = () => {
      const from = document.getElementById("off_from").value;
      const to = document.getElementById("off_to").value || from;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) { toast("pick a start date"); return; }
      const a = parseISO(from), b = parseISO(to);
      if (isNaN(b) || b < a) { toast("check the dates"); return; }
      if (!Array.isArray(data.off)) data.off = [];
      let n = 0;
      for (const dt = new Date(a); dt <= b; dt.setDate(dt.getDate() + 1)) {
        if (dt.getDay() === 0 || dt.getDay() === 6) continue;
        const iso = toISO(dt);
        if (!data.off.includes(iso)) { data.off.push(iso); n++; }
      }
      data.off.sort();
      toast(n ? `${n} day${n === 1 ? "" : "s"} off added` : "already added"); save();
    };
    document.querySelectorAll("[data-x]").forEach((btn) => btn.addEventListener("click", () => {
      const v = btn.dataset.v;
      if (btn.dataset.x === "cb") data.blocks = (data.blocks || []).filter((x) => x !== v);
      else { const rm = new Set(v.split(",")); data.off = (data.off || []).filter((x) => !rm.has(x)); }
      toast("removed"); save();
    }));

    // engineers
    const gv = (id) => document.getElementById(id).value.trim();
    document.getElementById("e_add").onclick = () => {
      const name = gv("e_name");
      if (!name) { toast("enter a name"); return; }
      if (!Array.isArray(data.engineers)) data.engineers = [];
      data.engineers.push({
        name, regNo: gv("e_reg"), licence: gv("e_lic"),
        company: gv("e_co"), expiry: gv("e_exp"), categories: gv("e_cat"),
      });
      toast("engineer added"); save();
    };
    document.querySelectorAll("[data-eng]").forEach((btn) => btn.addEventListener("click", () => {
      data.engineers.splice(parseInt(btn.dataset.eng, 10), 1);
      toast("removed"); save();
    }));

    document.getElementById("s_save").onclick = () => {
      const num = (id, min, fb) => {
        const v = Number(document.getElementById(id).value);
        return isNaN(v) || v < min ? fb : v;
      };
      data.baseHours = num("s_base", 0, 0);
      data.required = num("s_req", 1, DEFAULT_DATA.required);
      data.goal = num("s_goal", 1, DEFAULT_DATA.goal);
      data.hoursPerDay = num("s_hpd", 1, DEFAULT_DATA.hoursPerDay);
      const dl = document.getElementById("s_dl").value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) data.deadline = dl;
      data.jobTargets = {
        install: num("s_ti", 0, DEFAULT_DATA.jobTargets.install),
        service: num("s_ts", 0, DEFAULT_DATA.jobTargets.service),
        repair: num("s_tr", 0, DEFAULT_DATA.jobTargets.repair),
      };
      data.jobsPerWeek = num("s_jpw", 0.5, DEFAULT_DATA.jobsPerWeek);
      toast("settings saved"); save();
    };
    document.getElementById("s_export").onclick = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "gas-portfolio-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("data exported");
    };
    document.getElementById("s_import").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        data = normalise(JSON.parse(await f.text()));
        toast("data imported"); save();
      } catch (err) { toast("not a valid data file"); }
    };
    document.getElementById("s_reset").onclick = () => {
      if (confirm("Wipe all logged hours, jobs and settings?")) {
        data = structuredClone(DEFAULT_DATA);
        toast("reset"); save();
      }
    };
  }
}
// ---------- boot ----------
function normalise(raw) {
  const d = { ...structuredClone(DEFAULT_DATA), ...(raw || {}) };
  for (const k of ["hours", "jobs", "off", "blocks", "engineers"])
    if (!Array.isArray(d[k])) d[k] = structuredClone(DEFAULT_DATA[k] || []);
  if (!d.jobTargets || typeof d.jobTargets !== "object") d.jobTargets = structuredClone(DEFAULT_DATA.jobTargets);
  if (!(Number(d.jobsPerWeek) > 0)) d.jobsPerWeek = DEFAULT_DATA.jobsPerWeek;
  if (!Array.isArray(d.boilerTypes) || !d.boilerTypes.length) d.boilerTypes = [...DEFAULT_DATA.boilerTypes];
  if (!Array.isArray(d.repairFaults) || !d.repairFaults.length) d.repairFaults = [...DEFAULT_DATA.repairFaults];
  if (typeof d.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) d.deadline = DEFAULT_DATA.deadline;
  return d;
}

(async function () {
  setTimeout(() => document.getElementById("splash")?.remove(), 4300);
  try {
    if (window.api.appVersion) window.__ver = await window.api.appVersion();
    data = normalise(await window.api.getData());
    wireTitlebar();
    window.api.onDataChanged((d) => { data = normalise(d); render(); });
    render();
  } catch (e) {
    document.getElementById("app").innerHTML =
      `<div class="card"><b>Couldn't start</b><div class="tiny" style="margin-top:6px">${esc(String(e))}</div></div>`;
  }
  // refresh the day-countdown, but never while the user is typing
  setInterval(() => {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    render();
  }, 1000 * 60 * 15);

  // relay download progress to whatever update flow is running
  if (window.api.onUpdateProgress) window.api.onUpdateProgress((p) => { if (_onUpdateProgress) _onUpdateProgress(p); });

  // check GitHub for a newer release (Electron only; the web build is always latest)
  if (window.api.checkUpdate) {
    window.api.checkUpdate().then((u) => {
      if (!u || !u.newer) return;
      const bar = document.getElementById("update");
      bar.hidden = false;
      const label = u.canSelfUpdate ? "Update &amp; restart" : "Download";
      bar.innerHTML =
        `<span>Update available &mdash; <b>${esc(u.tag)}</b></span>` +
        `<a id="u_dl">${label}</a><span class="x" id="u_x">&times;</span>`;
      const msg = bar.querySelector("span");
      document.getElementById("u_dl").onclick = () =>
        runUpdate(u, (t) => { msg.innerHTML = t; document.getElementById("u_dl")?.remove(); });
      document.getElementById("u_x").onclick = () => { bar.hidden = true; };
    }).catch(() => {});
  }
})();
