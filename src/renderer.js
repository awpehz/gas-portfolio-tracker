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
    `${cap1(k)}: <b>${v}</b>${v > 0 ? " ✓" : ""}`).join(" &nbsp;&nbsp; ");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Gas Portfolio Progress</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    html, body { background: #fff; }
    body { font: 12px/1.5 -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 4px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .meta { color: #555; font-size: 11px; margin-bottom: 18px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #444;
         border-bottom: 1.5px solid #222; padding-bottom: 3px; margin: 20px 0 8px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; }
    .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; min-width: 120px; }
    .kpi .n { font-size: 18px; font-weight: 700; }
    .kpi .l { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: .5px; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0 4px; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
    th { background: #f0f0f0; }
    .note { font-size: 10px; color: #666; margin-top: 4px; }
    footer { margin-top: 26px; border-top: 1px solid #ccc; padding-top: 6px; font-size: 10px; color: #777; }
  </style></head><body>
    <h1>Gas Portfolio Progress</h1>
    <div class="meta">Generated ${gen}</div>

    <h2>Hours</h2>
    <div class="kpis">
      <div class="kpi"><div class="n">${s.total} h</div><div class="l">Total logged</div></div>
      <div class="kpi"><div class="n">${s.past275 ? "reached" : s.toRequired + " h"}</div><div class="l">To pass mark (${d.required})</div></div>
      <div class="kpi"><div class="n">${s.toGoal} h</div><div class="l">To goal (${d.goal})</div></div>
      <div class="kpi"><div class="n">${Math.round(s.pctGoal)}%</div><div class="l">Of goal</div></div>
      <div class="kpi"><div class="n">${s.assistedHours} h</div><div class="l">Assisted</div></div>
      <div class="kpi"><div class="n">${s.jobHours} h</div><div class="l">In write-ups</div></div>
    </div>

    <h2>Deadline &amp; pace</h2>
    <div class="kpis">
      <div class="kpi"><div class="n">${d.deadline}</div><div class="l">Deadline</div></div>
      <div class="kpi"><div class="n">${s.availDays}</div><div class="l">Working days left</div></div>
      <div class="kpi"><div class="n">${s.perDayGoal} h/day</div><div class="l">Rate needed</div></div>
    </div>
    <div class="note">Working day = Mon–Fri, excluding college block weeks and booked holidays. Verdict: ${esc(s.verdict)}.</div>

    <h2>Unassisted write-ups &nbsp;—&nbsp; ${s.jobsDone} of ${s.jobsTotal}</h2>
    <table>${row(["Category", "Logged", "Target"], true)}
      ${row(["Installs", s.install, d.jobTargets.install])}
      ${row(["Services", s.service, d.jobTargets.service])}
      ${row(["Repairs", s.repair, d.jobTargets.repair])}
    </table>
    <div class="note">Boiler types &nbsp; ${cover(s.boiler)}</div>
    <div class="note">Repair faults &nbsp; ${cover(s.fault)}</div>

    <h2>Write-up log</h2>
    <table>${row(["Date", "Category", "Boiler", "Fault", "Hours"], true)}${jobRows}</table>

    <h2>Assisted hours log</h2>
    <table>${row(["Date", "Hours", "Note"], true)}${hourRows}</table>

    <footer>Generated by Gas Portfolio Tracker · ${gen}</footer>
  </body></html>`;
}

async function exportPdf() {
  const d = { ...DEFAULT_DATA, ...data };
  const html = buildReport(d, computeStatus(data));
  if (window.api.exportPdf) {
    const r = await window.api.exportPdf(html);
    toast(r && r.ok ? "PDF saved" : "cancelled");
  } else {
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
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
  h = Number(h); if (!h || h <= 0) return;
  data.hours.push({ date: dateISO || todayISO(), h, note: note || "" });
  toast(`+${h}h logged`); save();
}
function setWeekTotal(h) {
  h = Number(h); if (isNaN(h)) return;
  const wk = window.GasLogic.parseISO(todayISO());
  const key = wkKey(wk);
  data.hours = data.hours.filter((r) => wkKey(window.GasLogic.parseISO(r.date)) !== key);
  data.hours.push({ date: todayISO(), h, note: "week total" });
  toast(`week set to ${h}h`); save();
}
function wkKey(d) {
  // mirror logic.js isoWeek roughly for filtering
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3);
  const firstThu = new Date(t.getFullYear(), 0, 4);
  const w = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${w}`;
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
  let n = 0;
  for (let i = 0; i < days; i++) {
    const iso = toISO(new Date(d0.getTime() + i * 86400000));
    if (!data.off.includes(iso)) { data.off.push(iso); n++; }
  }
  data.off.sort();
  toast(`${n} day(s) off added`); save();
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
  app.appendChild(tabBar());
  if (tab === "assisted") app.appendChild(assistedPane(s));
  else if (tab === "unassisted") app.appendChild(unassistedPane(s));
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
  for (const [k, label] of [["assisted", "Assisted"], ["unassisted", "Unassisted"], ["settings", "Settings"]]) {
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

function settingsPane() {
  const el = document.createElement("div");
  el.className = "card";
  const d = { ...DEFAULT_DATA, ...data };
  el.innerHTML = `
    <div class="cap"><span>Settings</span></div>
    <div class="grid" style="display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center">
      <span class="lbl">Starting hours</span><input type="number" id="s_base" value="${d.baseHours}" />
      <span class="lbl">Pass mark</span><input type="number" id="s_req" value="${d.required}" />
      <span class="lbl">Personal goal</span><input type="number" id="s_goal" value="${d.goal}" />
      <span class="lbl">Hours in a work day</span><input type="number" id="s_hpd" value="${d.hoursPerDay}" />
      <span class="lbl">Deadline</span><input type="date" id="s_dl" value="${d.deadline}" />
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

// ---------- wiring ----------
function wire(s) {
  document.getElementById("pin")?.addEventListener("click", async (e) => {
    window.api.win("pin");
    setTimeout(async () => e.target.classList.toggle("on", await window.api.isPinned()), 60);
  });
  document.getElementById("min")?.addEventListener("click", () => window.api.win("min"));
  document.getElementById("close")?.addEventListener("click", () => window.api.win("close"));

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
    document.querySelectorAll(".job").forEach((j) =>
      j.addEventListener("click", () => addJob(j.dataset.type, 2, jb.value, jf.value)));
    const go = () => addJob(jt.value, jh.value, jb.value, jf.value);
    document.getElementById("jlog").onclick = go;
    jh.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    document.getElementById("jundo").onclick = () => undoLast("jobs");
  }

  if (tab === "settings") {
    document.getElementById("off_add").onclick = () =>
      addOff(document.getElementById("off_start").value, Number(document.getElementById("off_days").value));
    document.getElementById("s_pdf").onclick = exportPdf;
    document.getElementById("s_save").onclick = () => {
      data.baseHours = Number(document.getElementById("s_base").value);
      data.required = Number(document.getElementById("s_req").value);
      data.goal = Number(document.getElementById("s_goal").value);
      data.hoursPerDay = Number(document.getElementById("s_hpd").value);
      data.deadline = document.getElementById("s_dl").value;
      data.blocks = document.getElementById("s_blocks").value.split("\n").map((x) => x.trim()).filter(Boolean);
      data.off = document.getElementById("s_off").value.split("\n").map((x) => x.trim()).filter(Boolean);
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
(async function () {
  data = { ...structuredClone(DEFAULT_DATA), ...(await window.api.getData()) };
  for (const k of ["hours", "jobs", "off", "blocks"]) if (!Array.isArray(data[k])) data[k] = structuredClone(DEFAULT_DATA[k]);
  window.api.onDataChanged((d) => { data = { ...structuredClone(DEFAULT_DATA), ...d }; render(); });
  render();
  setInterval(render, 1000 * 60 * 30); // keep day-countdown fresh
})();
