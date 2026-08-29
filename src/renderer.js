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
function addJob(type, h) {
  h = Number(h) || 2;
  data.jobs.push({ date: todayISO(), type, h });
  toast(`${type} logged (+${h}h)`); save();
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
  const jb = (label, key, n, tgt) =>
    `<div class="job" data-type="${key}">
       <div class="n ${n >= tgt ? "done" : ""}">${n}</div><div class="of">of ${tgt}</div>
       <div class="lbl">${label}</div></div>`;
  const recent = [...data.jobs].slice(-6).reverse().map((r) =>
    `<div class="row" style="font-size:11px;color:var(--mut);margin:2px 0">
       <span>${esc(r.date)} · ${esc(r.type)} · ${r.h}h</span></div>`).join("");
  el.innerHTML = `
    <div class="cap"><span>Unassisted write-ups</span><span>${s.jobsDone}/${s.jobsTotal} · ${s.jobHours}h</span></div>
    <div class="jobs">${jb("Install", "install", s.install, t.install)}${jb("Service", "service", s.service, t.service)}${jb("Repair", "repair", s.repair, t.repair)}</div>
    <div class="field" style="margin-top:10px">
      <span class="sub">type</span>
      <select id="jtype" style="background:rgba(255,255,255,.08);border:.5px solid var(--line);border-radius:7px;color:var(--fg);padding:5px 7px;font:inherit">
        <option value="install">Install</option><option value="service">Service</option><option value="repair">Repair</option>
      </select>
      <input type="number" id="jh" step="0.5" min="0" value="2" />
      <span class="pill blue" id="jlog" style="flex:0 0 auto;min-width:56px">Log</span>
    </div>
    <div class="tiny">tap a tile above for a quick +1 · or set the exact hours and Log</div>
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
    <div class="links" style="margin-top:10px"><a id="s_save">save settings</a></div>
    <div class="tiny" style="margin-top:12px;text-align:center">
      Gas Portfolio Tracker v1.0 &middot; made by <b style="color:var(--mut)">Connor Wales</b>
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
    document.querySelectorAll(".job").forEach((j) =>
      j.addEventListener("click", () => addJob(j.dataset.type, 2)));
    const go = () => addJob(document.getElementById("jtype").value, document.getElementById("jh").value);
    document.getElementById("jlog").onclick = go;
    document.getElementById("jh").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    document.getElementById("jundo").onclick = () => undoLast("jobs");
  }

  if (tab === "settings") {
    document.getElementById("off_add").onclick = () =>
      addOff(document.getElementById("off_start").value, Number(document.getElementById("off_days").value));
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
