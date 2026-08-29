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

const { computeStatus, DEFAULT_DATA, toISO } = window.GasLogic;
const app = document.getElementById("app");

let data = {};
let tab = "assisted";

function todayISO() { return toISO(new Date()); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function cap1(s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }

// A standalone, print-ready HTML report to hand to a lecturer.
function buildReport(d, s) {
  const gen = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  const row = (cells, th) => `<tr>${cells.map((c) => `<${th ? "th" : "td"}>${c}</${th ? "th" : "td"}>`).join("")}</tr>`;

  const jobRows = [...d.jobs].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((j) => row([j.date, cap1(j.type), cap1(j.boiler || "—"), j.type === "repair" ? cap1(j.fault || "—") : "—", (j.h ?? "") + "h"])).join("")
    || row(["—", "no unassisted write-ups logged", "", "", ""]);
  const hourRows = [...d.hours].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => row([r.date, (r.h ?? "") + "h", esc(r.note || "")])).join("")
    || row(["—", "no assisted hours logged", ""]);

  const cover = (obj) => Object.entries(obj).map(([k, v]) =>
    `${cap1(k)}: <b>${v}</b>${v > 0 ? ' <span class="yes">✓</span>' : ""}`).join(" &nbsp;&nbsp; ");

  const flame = `<svg width="20" height="24" viewBox="0 0 22 26" style="vertical-align:-4px">
    <defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#bfe8ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <path fill="url(#fl)" d="M11 0c1 5-3 7-5 11-2 3.6-2 6 0 8.5-3-.5-4.5-3-4.5-6C1.5 19 3 23 7 25c-1.6-1.8-2-4 .3-6.7 1.8-2 2.2-3.6 2-5.6 2 1.4 3 3.6 3 6 0 1.9-.7 3.7-2 5 3.4-.8 5.7-4 5.7-8C19 9 13 6 11 0z"/></svg>`;
  const barPct = Math.max(2, Math.min(100, s.pctGoal));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Gas Portfolio Progress</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { background: #fff; }
    body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
           color: #1b1e24; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 14px 16mm 14mm; }
    .head { background: linear-gradient(135deg, #2f7fd6, #59b8ff); color: #fff;
            padding: 18px 16mm; display: flex; align-items: center; gap: 12px; }
    .head .eyebrow { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; opacity: .85; }
    .head h1 { font-size: 21px; margin: 1px 0 0; font-weight: 800; letter-spacing: -.3px; }
    .head .gen { margin-left: auto; font-size: 10.5px; opacity: .9; text-align: right; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.6px; color: #2f7fd6;
         border-bottom: 2px solid #d7e6f7; padding-bottom: 4px; margin: 22px 0 10px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 9px; }
    .kpi { border: 1px solid #e2e6ec; border-radius: 11px; padding: 9px 13px; min-width: 118px; }
    .kpi .n { font-size: 18px; font-weight: 800; letter-spacing: -.5px; }
    .kpi .l { font-size: 9px; color: #6b7480; text-transform: uppercase; letter-spacing: .6px; margin-top: 1px; }
    .bar { height: 8px; border-radius: 4px; background: #e9eef5; position: relative; margin: 12px 0 4px; }
    .bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #4caf7d; }
    .bar > b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #1b1e24; }
    .barlbl { font-size: 9px; color: #6b7480; }
    table { border-collapse: collapse; width: 100%; margin: 4px 0; font-size: 10.5px; }
    th, td { border: 1px solid #e2e6ec; padding: 6px 9px; text-align: left; }
    th { background: #eef4fb; color: #2f5c8a; font-weight: 700; text-transform: uppercase;
         font-size: 9px; letter-spacing: .6px; }
    .cov { font-size: 10.5px; color: #444; margin-top: 6px; }
    .cov b { color: #1b1e24; } .yes { color: #2f8f5f; font-weight: 700; }
    .note { font-size: 9.5px; color: #6b7480; margin-top: 6px; }
    footer { margin-top: 24px; border-top: 1px solid #e2e6ec; padding-top: 7px;
             font-size: 9px; color: #9098a3; display: flex; align-items: center; gap: 5px; }
    .fmark { width: 9px; height: 11px; display: inline-block; background: linear-gradient(0deg,#2f7fd6,#59b8ff);
      clip-path: polygon(50% 0,62% 22%,78% 42%,74% 68%,88% 62%,74% 92%,50% 100%,26% 92%,16% 66%,30% 74%,24% 46%,40% 26%); }
  </style></head><body>
    <div class="head">
      ${flame}
      <div><div class="eyebrow">Gas Portfolio Tracker</div><h1>Progress report</h1></div>
      <div class="gen">Generated<br>${gen}</div>
    </div>
    <div class="wrap">

      <h2>Hours</h2>
      <div class="kpis">
        <div class="kpi"><div class="n">${s.total} h</div><div class="l">Total logged</div></div>
        <div class="kpi"><div class="n">${s.past275 ? "reached" : s.toRequired + " h"}</div><div class="l">To pass mark (${d.required})</div></div>
        <div class="kpi"><div class="n">${s.toGoal} h</div><div class="l">To goal (${d.goal})</div></div>
        <div class="kpi"><div class="n">${Math.round(s.pctGoal)}%</div><div class="l">Of goal</div></div>
        <div class="kpi"><div class="n">${s.assistedHours} h</div><div class="l">Assisted</div></div>
        <div class="kpi"><div class="n">${s.jobHours} h</div><div class="l">In write-ups</div></div>
      </div>
      <div class="bar"><i style="width:${barPct}%"></i><b style="left:${s.requiredMark}%"></b></div>
      <div class="barlbl">0 &nbsp;·&nbsp; the mark is the ${d.required} h pass line &nbsp;·&nbsp; ${d.goal} h</div>

      <h2>Deadline &amp; pace</h2>
      <div class="kpis">
        <div class="kpi"><div class="n">${d.deadline}</div><div class="l">Deadline</div></div>
        <div class="kpi"><div class="n">${s.availDays}</div><div class="l">Working days left</div></div>
        <div class="kpi"><div class="n">${s.perDayGoal} h/day</div><div class="l">Rate needed</div></div>
      </div>
      <div class="note">Working day = Mon–Fri, excluding college block weeks and booked holidays. &mdash; ${esc(s.verdict)}.</div>

      <h2>Unassisted write-ups &mdash; ${s.jobsDone} of ${s.jobsTotal}</h2>
      <table>${row(["Category", "Logged", "Target"], true)}
        ${row(["Installs", s.install, d.jobTargets.install])}
        ${row(["Services", s.service, d.jobTargets.service])}
        ${row(["Repairs", s.repair, d.jobTargets.repair])}
      </table>
      <div class="cov">Boiler types &nbsp;&nbsp; ${cover(s.boiler)}</div>
      <div class="cov">Repair faults &nbsp;&nbsp; ${cover(s.fault)}</div>

      <h2>Write-up log</h2>
      <table>${row(["Date", "Category", "Boiler", "Fault", "Hours"], true)}${jobRows}</table>

      <h2>Assisted hours log</h2>
      <table>${row(["Date", "Hours", "Note"], true)}${hourRows}</table>

      <footer><span class="fmark"></span> Generated by Gas Portfolio Tracker &nbsp;·&nbsp; ${gen}</footer>
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
function addJob(type, h, boiler, fault) {
  h = Number(h) || 2;
  const row = { date: todayISO(), type, h, boiler: boiler || "" };
  if (type === "repair" && fault) row.fault = fault;
  data.jobs.push(row);
  const bits = [type, boiler, type === "repair" && fault ? fault : null].filter(Boolean).join(" · ");
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
function undoLast(arrName) {
  if (data[arrName] && data[arrName].length) {
    data[arrName].pop();
    toast("undone"); save();
  }
}

// ---------- render ----------
function render() {
  const s = computeStatus(data);
  app.innerHTML = "";
  app.appendChild(progressCard(s));
  if (!data.hours.length && !data.jobs.length && tab !== "settings" && tab !== "help") {
    const hint = document.createElement("div");
    hint.className = "card";
    hint.style.borderColor = "rgba(108,191,255,.4)";
    hint.innerHTML = `<div class="tiny" style="color:var(--mut)">New here? Open <b style="color:var(--blue);cursor:pointer" id="gohint">Settings</b> and set your <b>starting hours</b>, <b>deadline</b>, <b>college block weeks</b> and any <b>holidays</b> first — the pace maths depends on them.</div>`;
    app.appendChild(hint);
  }
  app.appendChild(tabBar());
  if (tab === "assisted") app.appendChild(assistedPane(s));
  else if (tab === "unassisted") app.appendChild(unassistedPane(s));
  else if (tab === "help") app.appendChild(helpPane());
  else app.appendChild(settingsPane());
  wire(s);
}

function progressCard(s) {
  const el = document.createElement("div");
  el.className = "card";
  const college = s.atCollegeNow
    ? `at college now · back on the tools ${s.backOnTools}`
    : `college: next block ${s.nextBlock}${s.nextBlockDays != null ? ` (in ${s.nextBlockDays}d)` : ""}`;
  el.innerHTML = `
    <div class="cap"><span>Progress</span><span>goal ${s.goal}</span></div>
    <div class="row"><span class="big">${s.total}<small> / ${s.goal} h</small></span>
      <span class="sub">${s.past275 ? "✓ past pass" : s.toRequired + "h to pass (275)"}</span></div>
    <div class="bar"><i style="width:${Math.max(3, s.pctGoal)}%"></i><b style="left:${s.requiredMark}%"></b></div>
    <div class="row"><span class="sub">Rate needed</span>
      <span class="rate ${s.verdictOk ? "ok" : "warn"}">${s.perDayGoal}<span style="font-size:11px;color:var(--faint)"> h / working day</span></span></div>
    <div class="verdict ${s.verdictOk ? "ok" : "warn"}">${esc(s.verdict)}</div>
    <div class="tiny">${s.availDays} working days left · ${esc(college)}</div>`;
  return el;
}

function tabBar() {
  const el = document.createElement("div");
  el.className = "tabs";
  for (const [k, label] of [["assisted", "Assisted"], ["unassisted", "Unassisted"], ["settings", "Settings"], ["help", "Help"]]) {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = tab === k ? "on" : "";
    b.onclick = () => { tab = k; render(); };
    el.appendChild(b);
  }
  return el;
}

function assistedPane(s) {
  const el = document.createElement("div");
  el.className = "card";
  const recent = [...data.hours].slice(-6).reverse().map((r, i) =>
    `<div class="row" style="font-size:11px;color:var(--mut);margin:2px 0">
       <span>${esc(r.date)} · ${r.h}h${r.note ? " · " + esc(r.note) : ""}</span></div>`).join("");
  el.innerHTML = `
    <div class="cap"><span>Assisted hours</span><span>this week ${s.weekLogged}h</span></div>
    <div class="field">
      <input type="number" id="ah" step="0.5" min="0" placeholder="hours" />
      <input type="date" id="ad" value="${todayISO()}" />
      <span class="pill blue" id="ahlog" style="flex:0 0 auto;min-width:56px">Log</span>
    </div>
    <label class="chk"><input type="checkbox" id="awk" /> this is my whole-week total</label>
    <div class="links" style="margin-top:8px"><a id="ahundo">undo last</a></div>
    <div style="margin-top:8px">${recent || '<div class="tiny">no entries yet</div>'}</div>`;
  return el;
}

function unassistedPane(s) {
  const el = document.createElement("div");
  el.className = "card";
  const t = s.targets;
  const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1);
  const jb = (label, key, n, tgt) =>
    `<div class="job" data-type="${key}">
       <div class="n ${n >= tgt ? "done" : ""}">${n}</div><div class="of">of ${tgt}</div>
       <div class="lbl">${label}</div></div>`;
  const sel = (id, opts) =>
    `<select id="${id}" class="sel">` +
    opts.map((o) => `<option value="${o}">${cap(o)}</option>`).join("") + `</select>`;
  const cover = (obj, allDone) =>
    Object.entries(obj).map(([k, v]) =>
      `<span style="color:${v > 0 ? "var(--sage)" : "var(--faint)"}">${cap(k)} ${v}</span>`
    ).join('<span style="color:var(--faint)"> · </span>') +
    (allDone ? ' <span style="color:var(--sage)">✓ all covered</span>' : "");
  const recent = [...data.jobs].slice(-6).reverse().map((r) => {
    const parts = [r.date, r.type, r.boiler, r.fault, r.h + "h"].filter(Boolean).map(esc);
    return `<div class="row" style="font-size:11px;color:var(--mut);margin:2px 0"><span>${parts.join(" · ")}</span></div>`;
  }).join("");
  el.innerHTML = `
    <div class="cap"><span>Unassisted write-ups</span><span>${s.jobsDone}/${s.jobsTotal} · ${s.jobHours}h</span></div>
    <div class="jobs">${jb("Install", "install", s.install, t.install)}${jb("Service", "service", s.service, t.service)}${jb("Repair", "repair", s.repair, t.repair)}</div>

    <div class="tiny" style="margin-top:10px">Boiler types &nbsp; ${cover(s.boiler, s.boilerCovered)}</div>
    <div class="tiny" style="margin-top:3px">Repair faults &nbsp; ${cover(s.fault, s.faultsCovered)}</div>

    <div class="jobform">
      ${sel("jtype", ["install", "service", "repair"])}
      ${sel("jboiler", s.boilerTypes)}
      ${sel("jfault", s.repairFaults)}
      <input type="number" id="jh" step="0.5" min="0" value="2" />
      <span class="pill blue" id="jlog">Log</span>
    </div>
    <div class="tiny">tiles above = quick +1 using the dropdowns · fault only counts on repairs</div>
    <div class="links" style="margin-top:8px"><a id="jundo">undo last</a></div>
    <div style="margin-top:8px">${recent || '<div class="tiny">no write-ups yet</div>'}</div>`;
  return el;
}

function helpPane() {
  const el = document.createElement("div");
  el.className = "card help";
  const faq = (q, a) => `<details><summary>${q}</summary><p>${a}</p></details>`;
  el.innerHTML = `
    <div class="cap"><span>How it works</span></div>

    <h4>The top card</h4>
    <p>The big number is your <b>total logged hours</b> against your goal. The white
    tick on the bar is the <b>pass mark</b>. <b>Rate needed</b> is hours per working
    day to reach the goal by your deadline — a working day being Mon–Fri that isn't a
    college block week or a booked holiday. The line under it says, in plain words,
    whether that's realistic.</p>

    <h4>Assisted tab</h4>
    <p>Hours worked <b>alongside a Gas Safe engineer</b>. Type the hours, set the date
    (defaults to today), hit <span class="k">Log</span>. Tick <b>whole-week total</b>
    to replace that week with one figure instead of adding. <span class="k">undo last</span>
    removes your most recent entry.</p>

    <h4>Unassisted tab</h4>
    <p>Your <b>14 write-up jobs</b> — 5 installs, 5 services, 4 repairs (all editable in
    Settings). For each: pick the type, the <b>boiler</b> (traditional / combi / system)
    and, for repairs, the <b>fault</b> (water / gas / electrical), set the hours, Log.
    Those hours count toward your total too. Tapping a tile is a quick log using
    whatever the dropdowns show. The two coverage lines confirm you've hit every
    boiler type and every fault type.</p>

    <h4>Settings</h4>
    <p>Everything is adjustable — starting hours, pass mark, goal, deadline, hours in a
    work day, and how many of each job you need. <b>College block weeks</b>: one Monday
    per line. <b>Holidays</b>: one date per line, or use <b>add range</b>.
    <b>Export my data / import data</b> moves your whole tracker between machines.
    <b>Export portfolio PDF</b> makes a branded progress sheet for your lecturer — it
    carries no personal name.</p>

    <h4>Keep it visible</h4>
    <p>The <span class="k">pin</span> button in the title bar keeps the window above
    everything else, like a widget.</p>

    <div class="cap" style="margin-top:16px"><span>FAQ</span></div>
    ${faq("Does any of this leave my computer?",
      "No. Everything is saved on your machine. The PDF and data export are files you choose to share.")}
    ${faq("I logged the wrong thing.",
      "Use <b>undo last</b> on the Assisted or Unassisted tab. You can also open the raw data file — app menu → Data → Reveal data file.")}
    ${faq("Why did the rate needed jump up?",
      "It's spread only over the days you're actually available. Adding a college week or a holiday takes days out, so the rate on the days that remain goes up.")}
    ${faq("Can I log for a day in the past?",
      "Yes — the Assisted tab has a date picker next to the hours box.")}
    ${faq("I got a new laptop.",
      "Settings → <b>export my data</b> on the old one, <b>import data</b> on the new one.")}
    ${faq("The Windows app says “unknown publisher”.",
      "It isn't code-signed. Click <b>More info → Run anyway</b> on Windows, or right-click → Open on Mac. It's safe — the source is on GitHub.")}
    ${faq("My numbers disappeared.",
      "Data is stored per machine (and per browser for the web version). Clearing site data or switching browser loses it unless you exported a backup first.")}
    ${faq("What if I go past the pass mark?",
      "The bar shows it and the wording changes to “past pass”. Keep logging toward your personal goal for a safety margin.")}
  `;
  return el;
}

function settingsPane() {
  const el = document.createElement("div");
  el.className = "card";
  const d = { ...DEFAULT_DATA, ...data };
  el.innerHTML = `
    <div class="cap"><span>Settings</span></div>
    <div class="grid" style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center">
      <span class="lbl">Starting hours</span><input type="number" id="s_base" value="${d.baseHours}" />
      <span class="lbl">Pass mark (hours)</span><input type="number" id="s_req" value="${d.required}" />
      <span class="lbl">Personal goal (hours)</span><input type="number" id="s_goal" value="${d.goal}" />
      <span class="lbl">Hours in a work day</span><input type="number" id="s_hpd" value="${d.hoursPerDay}" />
      <span class="lbl">Deadline</span><input type="date" id="s_dl" value="${d.deadline}" />
      <span class="lbl">Installs needed</span><input type="number" id="s_ti" value="${d.jobTargets.install}" />
      <span class="lbl">Services needed</span><input type="number" id="s_ts" value="${d.jobTargets.service}" />
      <span class="lbl">Repairs needed</span><input type="number" id="s_tr" value="${d.jobTargets.repair}" />
    </div>
    <div class="lbl" style="margin-top:10px">College block weeks — one Monday per line (YYYY-MM-DD)</div>
    <textarea id="s_blocks">${d.blocks.join("\n")}</textarea>
    <div class="lbl" style="margin-top:6px">Holidays / days off — one date per line (YYYY-MM-DD)</div>
    <textarea id="s_off">${(d.off || []).join("\n")}</textarea>
    <div class="field" style="margin-top:8px">
      <span class="sub">add range</span>
      <input type="date" id="off_start" value="${todayISO()}" />
      <input type="number" id="off_days" value="5" min="1" style="width:56px" />
      <span class="pill" id="off_add" style="flex:0 0 auto">add</span>
    </div>
    <span class="pill blue" id="s_pdf" style="display:block;margin-top:12px;text-align:center">Export portfolio PDF for lecturer</span>
    <div class="links" style="margin-top:10px;flex-wrap:wrap">
      <a id="s_save">save settings</a>
      <a id="s_export">export my data</a>
      <label style="font-size:11px;color:var(--blue);cursor:pointer">import data<input type="file" id="s_import" accept="application/json" hidden></label>
      <a id="s_reset">reset everything</a>
    </div>
    <div class="tiny" style="margin-top:6px">PDF = a printable progress sheet. Data export = a backup file to re-import elsewhere.</div>
    <div class="tiny" style="margin-top:12px;text-align:center">
      Gas Portfolio Tracker v1.0 &middot; made by <b style="color:var(--mut)">Connor W</b>
    </div>`;
  return el;
}

// titlebar buttons live outside #app, so wire them ONCE
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
}

// ---------- wiring (re-run every render; #app is rebuilt so no listener leak here) ----------
function wire(s) {
  const gh = document.getElementById("gohint");
  if (gh) gh.onclick = () => { tab = "settings"; render(); };

  if (tab === "assisted") {
    const hEl = document.getElementById("ah");
    const go = () => {
      if (document.getElementById("awk").checked) setWeekTotal(hEl.value);
      else addHours(hEl.value, document.getElementById("ad").value);
    };
    document.getElementById("ahlog").onclick = go;
    hEl.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    document.getElementById("ahundo").onclick = () => undoLast("hours");
    hEl.focus();
  }

  if (tab === "unassisted") {
    const jt = document.getElementById("jtype");
    const jb = document.getElementById("jboiler");
    const jf = document.getElementById("jfault");
    const jh = document.getElementById("jh");
    const syncFault = () => {
      const on = jt.value === "repair";
      jf.disabled = !on;
      jf.style.opacity = on ? "1" : "0.35";
    };
    jt.addEventListener("change", syncFault);
    syncFault();
    // tile = quick add of the type shown, using the boiler + hours currently set
    document.querySelectorAll(".job").forEach((j) =>
      j.addEventListener("click", () => {
        const type = j.dataset.type;
        addJob(type, Number(jh.value) || 2, jb.value, type === "repair" ? jf.value : undefined);
      }));
    const go = () => addJob(jt.value, jh.value, jb.value, jt.value === "repair" ? jf.value : undefined);
    document.getElementById("jlog").onclick = go;
    jh.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    document.getElementById("jundo").onclick = () => undoLast("jobs");
  }

  if (tab === "settings") {
    document.getElementById("off_add").onclick = () =>
      addOff(document.getElementById("off_start").value, Number(document.getElementById("off_days").value));
    document.getElementById("s_pdf").onclick = exportPdf;
    document.getElementById("s_save").onclick = () => {
      const num = (id, min, fallback) => {
        const v = Number(document.getElementById(id).value);
        return isNaN(v) || v < min ? fallback : v;
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
      const dates = (id) => document.getElementById(id).value.split("\n")
        .map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
      data.blocks = dates("s_blocks");
      data.off = dates("s_off");
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
        const incoming = JSON.parse(await f.text());
        data = { ...structuredClone(DEFAULT_DATA), ...incoming };
        for (const k of ["hours", "jobs", "off", "blocks"]) if (!Array.isArray(data[k])) data[k] = [];
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
  for (const k of ["hours", "jobs", "off", "blocks"])
    if (!Array.isArray(d[k])) d[k] = structuredClone(DEFAULT_DATA[k]);
  if (!d.jobTargets || typeof d.jobTargets !== "object") d.jobTargets = structuredClone(DEFAULT_DATA.jobTargets);
  if (!Array.isArray(d.boilerTypes) || !d.boilerTypes.length) d.boilerTypes = [...DEFAULT_DATA.boilerTypes];
  if (!Array.isArray(d.repairFaults) || !d.repairFaults.length) d.repairFaults = [...DEFAULT_DATA.repairFaults];
  if (typeof d.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) d.deadline = DEFAULT_DATA.deadline;
  return d;
}

(async function () {
  try {
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
})();
