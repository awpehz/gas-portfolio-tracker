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
let tab = "home";

function todayISO() { return toISO(new Date()); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function cap1(s) { return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1); }

// A standalone, print-ready HTML report to hand to a lecturer.
function buildReport(d, s) {
  const gen = new Date().toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  const name = (d.name || "").trim();
  const row = (cells, th) => `<tr>${cells.map((c) => `<${th ? "th" : "td"}>${c}</${th ? "th" : "td"}>`).join("")}</tr>`;

  const jobRows = [...d.jobs].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((j) => row([j.date, cap1(j.type), cap1(j.boiler || "&mdash;"), j.type === "repair" ? cap1(j.fault || "&mdash;") : "&mdash;", (j.h ?? "") + "h"])).join("")
    || row(["&mdash;", "no unassisted write-ups logged", "", "", ""]);
  const hourRows = [...d.hours].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => row([r.date, (r.h ?? "") + "h", esc(r.note || "")])).join("")
    || row(["&mdash;", "no assisted hours logged", ""]);

  const cover = (obj) => Object.entries(obj).map(([k, v]) =>
    `${cap1(k)}: <b>${v}</b>${v > 0 ? ' <span class="yes">â</span>' : ""}`).join(" &nbsp;&nbsp; ");

  const flame = `<svg width="34" height="40" viewBox="0 0 24 24" style="vertical-align:-6px">
    <defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#bfe8ff"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <path fill="url(#fl)" d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>`;
  const barPct = Math.max(2, Math.min(100, s.pctGoal));

  return `<!doctype html><html><head><meta charset="utf-8"><title>Gas Portfolio Progress${name ? " &mdash; " + esc(name) : ""}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { background: #14161b; }
    body { font: 12px/1.5 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
           color: #eef1f5; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 16px 16mm 16mm; }
    .head { background: linear-gradient(135deg, #2f7fd6, #59b8ff); color: #fff;
            padding: 18px 16mm; display: flex; align-items: center; gap: 12px; }
    .head .eyebrow { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; opacity: .85; }
    .head h1 { font-size: 20px; margin: 1px 0 0; font-weight: 800; letter-spacing: -.3px; }
    .head .gen { margin-left: auto; font-size: 10.5px; opacity: .92; text-align: right; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.6px; color: #7cb8f6;
         border-bottom: 1px solid rgba(255,255,255,.14); padding-bottom: 4px; margin: 22px 0 10px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 9px; }
    .kpi { background: #1c1f27; border: 1px solid rgba(255,255,255,.09); border-radius: 11px;
           padding: 9px 13px; min-width: 118px; }
    .kpi .n { font-size: 18px; font-weight: 800; letter-spacing: -.5px; }
    .kpi .l { font-size: 9px; color: rgba(255,255,255,.42); text-transform: uppercase; letter-spacing: .6px; margin-top: 1px; }
    .bar { height: 8px; border-radius: 4px; background: rgba(255,255,255,.12); position: relative; margin: 12px 0 4px; }
    .bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #63c894; }
    .bar > b { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #fff; }
    .barlbl { font-size: 9px; color: rgba(255,255,255,.42); }
    table { border-collapse: collapse; width: 100%; margin: 4px 0; font-size: 10.5px; }
    th, td { border: 1px solid rgba(255,255,255,.1); padding: 6px 9px; text-align: left; }
    th { background: #22262e; color: #9dc4ef; font-weight: 700; text-transform: uppercase;
         font-size: 9px; letter-spacing: .6px; }
    td { color: rgba(255,255,255,.8); }
    .cov { font-size: 10.5px; color: rgba(255,255,255,.68); margin-top: 6px; }
    .cov b { color: #eef1f5; } .yes { color: #63c894; font-weight: 700; }
    .note { font-size: 9.5px; color: rgba(255,255,255,.42); margin-top: 6px; }
    footer { margin-top: 24px; border-top: 1px solid rgba(255,255,255,.1); padding-top: 7px;
             font-size: 9px; color: rgba(255,255,255,.35); display: flex; align-items: center; gap: 5px; }
    .fmark { width: 9px; height: 11px; display: inline-block; background: linear-gradient(0deg,#2f7fd6,#59b8ff);
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z'/%3E%3C/svg%3E") center/contain no-repeat;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z'/%3E%3C/svg%3E") center/contain no-repeat; }
  </style></head><body>
    <div class="head">
      ${flame}
      <div><div class="eyebrow">Gas Portfolio Tracker</div><h1>Progress report${name ? " &mdash; " + esc(name) : ""}</h1></div>
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
      <div class="barlbl">0 &nbsp;&middot;&nbsp; the mark is the ${d.required} h pass line &nbsp;&middot;&nbsp; ${d.goal} h</div>

      <h2>Deadline &amp; pace</h2>
      <div class="kpis">
        <div class="kpi"><div class="n">${d.deadline}</div><div class="l">Deadline</div></div>
        <div class="kpi"><div class="n">${s.availDays}</div><div class="l">Working days left</div></div>
        <div class="kpi"><div class="n">${s.perDayGoal} h/day</div><div class="l">Rate needed</div></div>
      </div>
      <div class="note">Working day = Mon&ndash;Fri, excluding college block weeks and booked holidays. &mdash; ${esc(s.verdict)}.</div>

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

      <footer><span class="fmark"></span> Generated by Gas Portfolio Tracker &nbsp;&middot;&nbsp; ${gen}</footer>
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

// ---------- render ----------
const TABS = [
  ["home", "Home"],
  ["assisted", "Hours"],
  ["unassisted", "Write-ups"],
  ["report", "Report"],
  ["methods", "Methods"],
  ["settings", "Settings"],
  ["help", "Help"],
];

function render() {
  const s = computeStatus(data);
  app.innerHTML = "";
  app.appendChild(tabBar());
  if (tab === "home") app.appendChild(homePane(s));
  else if (tab === "assisted") app.appendChild(hoursPane(s));
  else if (tab === "unassisted") app.appendChild(writeupsPane(s));
  else if (tab === "report") app.appendChild(reportPane(s));
  else if (tab === "methods") app.appendChild(methodsPane());
  else if (tab === "help") app.appendChild(helpPane());
  else app.appendChild(settingsPane());
  countUp(app);
  wire(s);
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
  const paceCls = s.verdictOk ? "ok" : "warn";
  const weekAim = Math.round(s.perDayGoal * 5 * 10) / 10;
  const college = s.atCollegeNow
    ? `At college now — back on the tools ${s.backOnTools}`
    : `Next college block ${s.nextBlock}${s.nextBlockDays != null ? ` · in ${s.nextBlockDays} days` : ""}`;
  const cov = (obj) => Object.entries(obj).map(([k, v]) =>
    `<span class="${v > 0 ? "ok" : "dim"}">${cap1(k)}</span>`).join('<span class="dim"> &middot; </span>');
  el.innerHTML = `
    <div class="hsec hero">
      <svg class="flame md" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z" fill="url(#flameGrad)"/></svg>
      <div class="hcap">Progress</div>
      <div class="stat"><span class="v" data-to="${s.total}">0</span><small> / ${s.goal} h</small></div>
      <div class="bar"><i style="--w:${Math.max(3, s.pctGoal)}%"></i><b style="left:${s.requiredMark}%"></b></div>
      <div class="dim sm">${s.past275 ? "past the 275 pass mark" : `<span class="v" data-to="${s.toRequired}">0</span> h to pass`} &middot; ${s.toGoal} h to goal</div>
    </div>

    <div class="hsec">
      <div class="hcap">On track</div>
      <div class="pace ${paceCls}"><span class="v" data-to="${s.perDayGoal}" data-dp="1">0</span> h per working day</div>
      <div class="dim sm">${esc(s.verdict)}</div>
      <div class="dim sm">${s.availDays} working days left &middot; deadline ${s.dl || d0(data).deadline}</div>
      <div class="dim sm">this week: <b class="${s.weekLogged >= weekAim && weekAim > 0 ? "ok" : ""}">${s.weekLogged} h</b> logged &middot; aim ~${weekAim} h</div>
    </div>

    <div class="hsec">
      <div class="hcap">Write-ups &nbsp;<span class="dim">${s.jobsDone} / ${s.jobsTotal}</span></div>
      <div class="dim sm">Installs ${s.install}/${s.targets.install} &middot; Services ${s.service}/${s.targets.service} &middot; Repairs ${s.repair}/${s.targets.repair}</div>
      <div class="dim sm">Boilers ${cov(s.boiler)} &nbsp;&middot;&nbsp; Faults ${cov(s.fault)}</div>
    </div>

    <div class="hsec">
      <div class="hcap">College</div>
      <div class="dim sm">${esc(college)}</div>
    </div>

    <div class="hsec">
      <div class="hcap">Quick log</div>
      <div class="qrow">
        <button class="pill" data-q="2">+2 h</button>
        <button class="pill" data-q="3">+3 h</button>
        <button class="pill" data-q="4">+4 h</button>
        <button class="pill go" data-goto="unassisted">Log a write-up &rarr;</button>
      </div>
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
    `<button class="del" data-arr="hours" data-i="${i}" title="delete">&times;</button></li>`).join("");
  el.innerHTML = `
    <h3>Assisted hours <span class="h3-r">this week ${s.weekLogged} h</span></h3>
    <p class="dim">Hours worked alongside a Gas&nbsp;Safe engineer.</p>
    <div class="form2">
      <label>Hours<input type="number" id="ah" step="0.5" min="0" inputmode="decimal" placeholder="e.g. 6.5"></label>
      <label>Date<input type="date" id="ad" value="${todayISO()}"></label>
    </div>
    <label class="chk"><input type="checkbox" id="awk"> this is my whole-week total (replaces the week)</label>
    <button class="btn" id="ahlog">Log hours</button>
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
    return `<li><span class="li-d">${esc(r.date)}</span><span class="li-v">${esc(bits)} &middot; ${r.h} h</span>` +
      `<button class="del" data-arr="jobs" data-i="${i}" title="delete">&times;</button></li>`;
  }).join("");
  el.innerHTML = `
    <h3>Unassisted write-ups <span class="h3-r">${s.jobsDone}/${s.jobsTotal} &middot; ${s.jobHours} h</span></h3>
    <div class="tiles">${tile("Installs", "install", s.install, t.install)}${tile("Services", "service", s.service, t.service)}${tile("Repairs", "repair", s.repair, t.repair)}</div>
    <div class="cover">
      <div><span class="cl">Boilers</span> ${cover(s.boiler)}${s.boilerCovered ? ' <span class="ok">â</span>' : ""}</div>
      <div><span class="cl">Faults</span> ${cover(s.fault)}${s.faultsCovered ? ' <span class="ok">â</span>' : ""}</div>
    </div>
    <div class="form3">
      <label>Type<select id="jtype">${["install", "service", "repair"].map(opt).join("")}</select></label>
      <label>Boiler<select id="jboiler">${s.boilerTypes.map(opt).join("")}</select></label>
      <label>Fault<select id="jfault">${s.repairFaults.map(opt).join("")}</select></label>
      <label>Hours<input type="number" id="jh" step="0.5" min="0" value="2" inputmode="decimal"></label>
    </div>
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

function settingsPane() {
  const el = document.createElement("section");
  el.className = "card";
  const d = { ...DEFAULT_DATA, ...data };
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
    </div>
    <label class="ta">College block weeks &mdash; one Monday per line (YYYY-MM-DD)
      <textarea id="s_blocks">${d.blocks.join("\n")}</textarea></label>
    <label class="ta">Holidays / days off &mdash; one date per line
      <textarea id="s_off">${(d.off || []).join("\n")}</textarea></label>
    <div class="form3" style="align-items:end">
      <label>Time off from<input type="date" id="off_start" value="${todayISO()}"></label>
      <label>Days<input type="number" id="off_days" value="5" min="1"></label>
      <button class="btn ghost" id="off_add">Add</button>
    </div>
    <button class="btn" id="s_save">Save settings</button>
    <label class="chk" id="s_widget_l"><input type="checkbox" id="s_widget"> Show desktop widget &mdash; a translucent card on your desktop, controlled from the menu bar</label>
    <div class="row-links">
      <a id="s_export">export my data</a>
      <label class="filelink">import data<input type="file" id="s_import" accept="application/json" hidden></label>
      <a id="s_reset" class="danger">reset everything</a>
    </div>
    <p class="dim sm" style="margin-top:12px;text-align:center">v${window.__ver || "1.0"}</p>`;
  return el;
}

function methodsPane() {
  const el = document.createElement("section");
  el.className = "card help methods";
  const m = (title, open, body) =>
    `<details${open ? " open" : ""}><summary>${title}</summary><div class="m">${body}</div></details>`;
  el.innerHTML = `
    <h3>Methods &mdash; how-to and working</h3>
    <p class="lead">The common jobs, step by step, so you can do the working on paper &mdash; where calculators and apps aren't allowed.</p>

    ${m("Gas rating &mdash; checking the heat input", true, `
      <p class="when">Measure the volume of gas the appliance burns over a timed period, convert it to a heat input in kW, and compare against the appliance data badge.</p>
      <p class="when"><b>Before you start</b></p>
      <ol>
        <li>Isolate every other gas appliance on the installation.</li>
        <li>Set the appliance under test to maximum rate and let it stabilise for about <b>10 minutes</b> before timing.</li>
      </ol>
      <p class="when"><b>Metric meter (m&sup3;)</b></p>
      <ol>
        <li>Record the meter index.</li>
        <li>Time the test &mdash; <b>2 minutes</b>, or <b>1 minute</b> (permitted by Gas Safe TB 162 for domestic metric meters). Add any extra seconds for the test dial to reach the next whole unit.</li>
        <li>Record the index again. Second reading &minus; first reading = <b>volume used</b> (m&sup3;).</li>
        <li>Gas rate: <code>volume used &times; 3600 &divide; test time (s) = m&sup3;/h</code></li>
        <li>Gross heat input: <code>m&sup3;/h &times; 38.76 &divide; 3.6 = kW gross</code></li>
        <li>The data badge normally states a <b>net</b> input &mdash; divide by <b>1.1</b> to compare like for like.</li>
      </ol>
      <div class="eg"><b>Example:</b> 0.08 m&sup3; used in 2 min 6 s (126 s). &nbsp; 0.08 &times; 3600 &divide; 126 = <b>2.29 m&sup3;/h</b> &rarr; 2.29 &times; 38.76 &divide; 3.6 = <b>24.6 kW gross</b> &rarr; &divide; 1.1 = <b>22.4 kW net</b>.</div>
      <p class="when"><b>Imperial meter (ft&sup3;)</b></p>
      <ol>
        <li>Note the test dial size &mdash; <b>1, 2, 5 or 10 ft&sup3;</b> per revolution (marked on the dial). Time <b>one complete revolution</b>.</li>
        <li>Gas rate: <code>ft&sup3; per rev &times; 3600 &divide; time for one rev (s) = ft&sup3;/h</code></li>
        <li>Heat input: <code>ft&sup3;/h &times; 1040 = Btu/h</code>, then <code>&divide; 3412 = kW gross</code>, then <code>&divide; 1.1 = kW net</code></li>
      </ol>
      <div class="eg"><b>Example:</b> 2 ft&sup3; dial, one revolution in 68 s. &nbsp; 2 &times; 3600 &divide; 68 = <b>105.9 ft&sup3;/h</b> &rarr; &times; 1040 = 110,118 Btu/h &rarr; &divide; 3412 = <b>32.3 kW gross</b> &rarr; &divide; 1.1 = <b>29.3 kW net</b>.</div>
      <p class="chk">The net figure should be within about <b>5%</b> of the appliance data badge &mdash; the manufacturer's instructions take precedence. Figures per NICEIC Pocket Guide Gas 3 / ACS &amp; BPEC teaching.</p>
    `)}

    ${m("Air supply &mdash; is purpose-provided ventilation needed?", false, `
      <p class="when">Applies to <b>open-flued</b> appliances (combustion air drawn from the room). A <b>room-sealed</b> / balanced-flue appliance takes its air from outside and normally needs no vent.</p>
      <ol>
        <li>Get the appliance's <b>net</b> heat input in kW (data badge, or from the gas rate above).</li>
        <li><b>7 kW or below:</b> no purpose-provided ventilation required &mdash; adventitious ventilation (natural infiltration through the building fabric) is taken to cover it.</li>
        <li><b>Above 7 kW:</b> <code>(net kW &minus; 7) &times; 5 = free area required (cm&sup2;)</code></li>
        <li>That figure is the <b>free area</b> &mdash; the actual unobstructed opening. Size the grille from its stated free area, not its overall dimensions.</li>
      </ol>
      <div class="eg"><b>Example:</b> 18 kW net. &nbsp; (18 &minus; 7) &times; 5 = <b>55 cm&sup2;</b> of permanent free area.</div>
      <p class="when">Air may be taken direct from outside, or from an adjacent room that itself has an equivalent vent to outside. Appliances in a compartment use a separate, larger set of figures with high- and low-level vents.</p>
      <p class="chk">BS 5440-2:2023 (superseded the 2009 edition on 31 Dec 2023).</p>
    `)}

    ${m("Tightness test &mdash; proving soundness", false, `
      <p class="when">Carried out after any work on the installation pipework, before gas is admitted for use. Domestic natural gas, IGEM/UP/1B.</p>
      <ol>
        <li>Connect a manometer to a test point, raise the installation to <b>20&ndash;21 mbar</b>, then close the ECV.</li>
        <li><b>Let-by test:</b> the pressure must not <em>rise</em>. A rise shows the ECV is letting by &mdash; investigate before continuing.</li>
        <li>Allow <b>1 minute</b> for temperature stabilisation.</li>
        <li>Time the test for <b>2 minutes</b> and record the pressure drop.</li>
        <li>Compare the drop against the permitted figure.</li>
      </ol>
      <p class="when"><b>Permitted drop &mdash; current (IGEM/UP/1B Edition 3), by meter</b></p>
      <div class="figs">Diaphragm meter &le; 6 m&sup3;/h (U6 / G4): <b>4 mbar</b> for pipework &le; 28 mm, <b>2.5 mbar</b> for pipework &gt; 28 mm.</div>
      <p class="when"><b>Permitted drop &mdash; from 1 Oct 2026 (IGEM/UP/1B Edition 4), by installation volume (IV)</b></p>
      <div class="figs">
        IV &le; 0.005 m&sup3; &rarr; <b>8 mbar</b> &nbsp;&middot;&nbsp;
        &gt; 0.005&ndash;0.010 m&sup3; &rarr; <b>4 mbar</b><br>
        &gt; 0.010&ndash;0.015 m&sup3; &rarr; <b>2.5 mbar</b> &nbsp;&middot;&nbsp;
        &gt; 0.015&ndash;0.035 m&sup3; &rarr; <b>1 mbar</b> (typical dwelling)
      </div>
      <div class="eg">New pipework, nothing connected &mdash; <b>no perceptible drop permitted</b>. Any drop beyond the permitted figure, any let-by, or any smell of gas is a <b>fail</b>; do not admit gas.</div>
      <p class="chk">IGEM/UP/1B Edition 4 replaces Edition 3 on <b>1 Oct 2026</b> (Edition 3 withdrawn 30 Sep 2026) &mdash; the basis moves from meter size to installation volume. Work to the edition your centre assesses on.</p>
    `)}

    ${m("Pipe sizing &mdash; the 1 mbar method", false, `
      <p class="when">A new run must be sized so the total pressure loss from the meter outlet to any appliance does not exceed <b>1 mbar</b>.</p>
      <ol>
        <li>Determine the gas rate carried by each section in m&sup3;/h &mdash; sum the connected appliances. Convert each: <code>kW gross &divide; 10.8 = m&sup3;/h</code> (or use the manufacturer's figure).</li>
        <li>Measure each section's actual length, then add the <b>equivalent length</b> for every fitting (elbow, tee, etc.) from the BS 6891 table.</li>
        <li>For each section, read the pressure loss from the BS 6891 discharge table for that material and diameter at its gas rate and effective length (tabulated for a 1.0 mbar drop, relative density 0.6).</li>
        <li>Sum the losses along the <b>index run</b> (the longest / most onerous route). If the total exceeds 1 mbar, increase the pipe size and repeat.</li>
      </ol>
      <div class="eg"><b>Example:</b> a 22 mm copper section &mdash; 6 m actual + fittings &asymp; <b>7.6 m effective length</b> &mdash; carrying 1.8 m&sup3;/h. The BS 6891 table gives well under <b>1 mbar</b> for that section; confirm the whole index run still totals under 1 mbar.</div>
      <p class="chk">BS 6891:2015 (+A1:2019), Annex A. Use the discharge and equivalent-length tables for the pipe material being installed.</p>
    `)}

    <p class="disc">Revision notes to support your training &mdash; not a substitute for it, the current standards, or the appliance instructions. On site, the calorific value and gross-to-net factor come from the gas supplier's declared values. Not endorsed by Gas Safe, BPEC or IGEM.<br><br>
    Checked Aug 2026 against: NICEIC Pocket Guide Gas 3; Gas Safe TB 162 (1-minute gas rate, Sep 2023); BS 5440-2:2023; IGEM/UP/1B Edition 3 and Edition 4 (in force 1 Oct 2026); BS 6891:2015+A1:2019. Always work to the current edition and the one your centre assesses on.</p>
  `;
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
    <b>boiler</b> and, for repairs, the <b>fault</b>, set the hours, <b>Log write-up</b>.
    Those hours count toward your total too. Tapping a tile logs one instantly. The
    coverage lines confirm you've hit every boiler type and every fault type.</p>
    <h4>Report tab</h4>
    <p><b>Export PDF</b> &mdash; a one-page progress sheet for your lecturer. Add your name on the Report tab before exporting.</p>
    <h4>Settings</h4>
    <p>Every number is adjustable. <b>export / import data</b> moves your whole tracker
    between machines.</p>
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
      b.addEventListener("click", () => addHours(b.dataset.q, todayISO())));
    app.querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => { tab = b.dataset.goto; render(); }));
  }
  app.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", () => removeEntry(b.dataset.arr, parseInt(b.dataset.i, 10))));
  if (tab === "assisted") {
    const h = document.getElementById("ah");
    const go = () => {
      if (document.getElementById("awk").checked) setWeekTotal(h.value);
      else addHours(h.value, document.getElementById("ad").value);
    };
    document.getElementById("ahlog").onclick = go;
    h.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    h.focus({ preventScroll: true });
  }

  if (tab === "unassisted") {
    const jt = document.getElementById("jtype");
    const jb = document.getElementById("jboiler");
    const jf = document.getElementById("jfault");
    const jh = document.getElementById("jh");
    const syncFault = () => {
      const on = jt.value === "repair";
      jf.disabled = !on;
      jf.closest("label").style.opacity = on ? "1" : "0.4";
    };
    jt.addEventListener("change", syncFault);
    syncFault();
    document.querySelectorAll(".tile").forEach((el) =>
      el.addEventListener("click", () => {
        const type = el.dataset.type;
        addJob(type, Number(jh.value) || 2, jb.value, type === "repair" ? jf.value : undefined);
      }));
    const go = () => addJob(jt.value, jh.value, jb.value, jt.value === "repair" ? jf.value : undefined);
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
    document.getElementById("off_add").onclick = () =>
      addOff(document.getElementById("off_start").value, Number(document.getElementById("off_days").value));
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
  for (const k of ["hours", "jobs", "off", "blocks"])
    if (!Array.isArray(d[k])) d[k] = structuredClone(DEFAULT_DATA[k]);
  if (!d.jobTargets || typeof d.jobTargets !== "object") d.jobTargets = structuredClone(DEFAULT_DATA.jobTargets);
  if (!Array.isArray(d.boilerTypes) || !d.boilerTypes.length) d.boilerTypes = [...DEFAULT_DATA.boilerTypes];
  if (!Array.isArray(d.repairFaults) || !d.repairFaults.length) d.repairFaults = [...DEFAULT_DATA.repairFaults];
  if (typeof d.deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) d.deadline = DEFAULT_DATA.deadline;
  return d;
}

(async function () {
  setTimeout(() => document.getElementById("splash")?.remove(), 4800);
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

  // check GitHub for a newer release (Electron only; the web build is always latest)
  if (window.api.checkUpdate) {
    window.api.checkUpdate().then((u) => {
      if (!u || !u.newer) return;
      const bar = document.getElementById("update");
      bar.hidden = false;
      bar.innerHTML =
        `<span>Update available &mdash; <b>${esc(u.tag)}</b></span>` +
        `<a id="u_dl">Download</a><span class="x" id="u_x">&times;</span>`;
      document.getElementById("u_dl").onclick = () => window.api.openUrl(u.url);
      document.getElementById("u_x").onclick = () => { bar.hidden = true; };
    }).catch(() => {});
  }
})();
