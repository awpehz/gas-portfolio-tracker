// Pure computation — no DOM, no Node. Shared by renderer (and testable).
// Wrapped so nothing leaks into global scope (renderer.js runs in the same scope).
(function () {

const DAY = 86400000;

function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function isoWeek(dt) {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = (d.getDay() + 6) % 7;            // Mon=0
  d.setDate(d.getDate() - day + 3);            // nearest Thursday
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThu) / DAY - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function mondayOf(dt) {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function fmtShort(dt) {
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const DEFAULT_DATA = {
  baseHours: 0,        // hours you already had before using this — set yours in Settings
  required: 275,
  goal: 330,
  hoursPerDay: 8,
  deadline: "2026-12-22",
  jobTargets: { install: 5, service: 5, repair: 4 },
  jobsPerWeek: 1,     // write-ups you reckon you can log in a week — used for the portfolio finish estimate
  boilerTypes: ["traditional", "combi", "system"],
  repairFaults: ["water", "gas", "electrical"],
  blocks: [
    "2026-08-24", "2026-09-14", "2026-10-05", "2026-11-02", "2026-11-23",
    "2026-12-14", "2027-01-25", "2027-02-15", "2027-03-08", "2027-04-12",
    "2027-05-03", "2027-05-24", "2027-07-05"
  ],
  hours: [],   // { date: "YYYY-MM-DD", h: number, note?: string }
  jobs: [],    // { date, type: "install"|"service"|"repair", h: number, engineer?: string }
  off: [],     // "YYYY-MM-DD"
  engineers: []// { name, licence, regNo, company, categories, expiry }
};

function computeStatus(data, now = new Date()) {
  const d = { ...DEFAULT_DATA, ...data };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadline = parseISO(d.deadline);
  const twKey = isoWeek(today);
  const collegeWeeks = new Set(d.blocks.map((b) => isoWeek(parseISO(b))));
  const offSet = new Set(d.off);

  const sumH = (rows, key) => {
    let tot = 0, wk = 0;
    for (const r of rows) {
      const h = Number(r[key] ?? r.h ?? 0);
      if (!h) continue;
      tot += h;
      if (r.date && isoWeek(parseISO(r.date)) === twKey) wk += h;
    }
    return [tot, wk];
  };
  const [assisted, assistedWk] = sumH(d.hours, "h");
  const [jobH, jobWk] = sumH(d.jobs, "h");
  const logged = assisted + jobH;
  const total = d.baseHours + logged;
  const weekLogged = Math.round((assistedWk + jobWk) * 10) / 10;

  const toRequired = Math.max(0, d.required - total);
  const toGoal = Math.max(0, d.goal - total);
  const pctGoal = Math.min(100, (total / d.goal) * 100);
  const requiredMark = (d.required / d.goal) * 100;

  // walk every day to the deadline, classify weekdays.
  // Step by calendar date (not +86400000ms) so the Oct DST change can't drift.
  let workDays = 0, collegeDays = 0, offDays = 0, availDays = 0;
  let finishDate = null, finishAvail = null;                 // earliest the goal is reachable at full days
  const need = Math.max(0, d.goal - total);
  for (const dt = new Date(today); dt <= deadline; dt.setDate(dt.getDate() + 1)) {
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    workDays++;
    if (collegeWeeks.has(isoWeek(dt))) collegeDays++;
    else if (offSet.has(toISO(dt))) offDays++;
    else {
      availDays++;
      if (finishDate === null && need > 0 && availDays * d.hoursPerDay >= need) {
        finishDate = toISO(dt); finishAvail = availDays;
      }
    }
  }
  if (need <= 0) { finishDate = toISO(today); finishAvail = 0; }
  const finishDays = need > 0 ? Math.ceil(need / d.hoursPerDay) : 0;
  const canFinish = finishDate !== null;
  const finishSlackDays = canFinish ? Math.round((deadline - parseISO(finishDate)) / DAY) : null;
  const finishSpareDays = canFinish ? availDays - finishAvail : null;   // spare working days if you go flat out
  const capacity = availDays * d.hoursPerDay;
  const shortfall = Math.max(0, Math.round((need - capacity) * 10) / 10); // hours you'd still be short at full days
  const perDayGoal = availDays ? Math.round((toGoal / availDays) * 10) / 10 : 999;
  const perDayPass = availDays ? Math.round((toRequired / availDays) * 10) / 10 : 999;
  const slack = Math.round(capacity - toGoal);

  let verdict, verdictOk;
  if (toGoal <= 0) { verdict = "goal reached"; verdictOk = true; }
  else if (perDayGoal > d.hoursPerDay) { verdict = `over a full ${d.hoursPerDay}h day needed — talk to your assessor`; verdictOk = false; }
  else if (perDayGoal > d.hoursPerDay * 0.75) { verdict = "tight, but under a full day"; verdictOk = true; }
  else { verdict = "comfortable — well under a full day"; verdictOk = true; }

  // jobs
  const counts = { install: 0, service: 0, repair: 0 };
  const boiler = Object.fromEntries(d.boilerTypes.map((k) => [k, 0]));
  const fault = Object.fromEntries(d.repairFaults.map((k) => [k, 0]));
  for (const j of d.jobs) {
    if (counts[j.type] != null) counts[j.type]++;
    if (boiler[j.boiler] != null) boiler[j.boiler]++;
    if (j.type === "repair" && fault[j.fault] != null) fault[j.fault]++;
  }
  const jobsDone = counts.install + counts.service + counts.repair;
  const jobsTotal = d.jobTargets.install + d.jobTargets.service + d.jobTargets.repair;
  const boilerCovered = Object.values(boiler).every((v) => v > 0);
  const faultsCovered = Object.values(fault).every((v) => v > 0);

  // ---- whole-portfolio finish estimate (hours gate + write-ups gate) ----
  const jobsNeeded =
    Math.max(0, d.jobTargets.install - counts.install) +
    Math.max(0, d.jobTargets.service - counts.service) +
    Math.max(0, d.jobTargets.repair - counts.repair);
  const boilerGaps = d.boilerTypes.filter((k) => boiler[k] === 0);
  const faultGaps = d.repairFaults.filter((k) => fault[k] === 0);

  // your actual write-up pace so far — jobs per week since the first thing you logged
  const logDates = [...d.hours, ...d.jobs].map((r) => r.date).filter(Boolean).sort();
  const firstLog = logDates.length ? parseISO(logDates[0]) : today;
  const weeksElapsed = Math.max(1, (today - firstLog) / (7 * DAY));
  const jobsPerWeekActual = d.jobs.length ? Math.round((d.jobs.length / weeksElapsed) * 10) / 10 : 0;

  const planRate = Number(d.jobsPerWeek) > 0 ? Number(d.jobsPerWeek) : 1;
  const weeksToJobs = jobsNeeded > 0 ? Math.ceil(jobsNeeded / planRate) : 0;
  const jobsFinishDate = toISO(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + weeksToJobs * 7)
  );

  // portfolio is done at the LATER of the two gates
  let portfolioFinishDate = null;
  const portfolioCanFinish = canFinish;
  let portfolioGate = "hours";
  if (canFinish) {
    if (parseISO(jobsFinishDate) > parseISO(finishDate)) {
      portfolioFinishDate = jobsFinishDate; portfolioGate = "write-ups";
    } else {
      portfolioFinishDate = finishDate; portfolioGate = "hours";
    }
  }
  const portfolioSlackDays = portfolioFinishDate
    ? Math.round((deadline - parseISO(portfolioFinishDate)) / DAY) : null;

  // college schedule
  const atCollegeNow = today.getDay() >= 1 && today.getDay() <= 5 && collegeWeeks.has(twKey);
  let nextBlock = "none left", nextBlockDays = null;
  for (const b of d.blocks) {
    const bd = parseISO(b);
    if (bd > today) { nextBlock = fmtShort(bd); nextBlockDays = Math.round((bd - today) / DAY); break; }
  }
  let backOnTools = null;
  if (atCollegeNow) {
    const m = mondayOf(today);
    do { m.setDate(m.getDate() + 7); } while (collegeWeeks.has(isoWeek(m)));
    backOnTools = fmtShort(m);
  }
  const blocksBeforeDeadline = d.blocks.filter((b) => {
    const bd = parseISO(b);
    return bd > today && bd <= deadline;
  }).length;

  const daysLeft = Math.round((deadline - today) / DAY);

  // ---- accountability: last entry, gap, and logging streak ----
  const isWorkingDay = (dt) =>
    dt.getDay() >= 1 && dt.getDay() <= 5 &&
    !collegeWeeks.has(isoWeek(dt)) && !offSet.has(toISO(dt));
  const logDaySet = new Set(
    [...d.hours, ...d.jobs].map((r) => r.date).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
  );
  const loggedToday = logDaySet.has(toISO(today));
  const allLogDays = [...logDaySet].sort();
  const lastLog = allLogDays.length ? allLogDays[allLogDays.length - 1] : null;

  let daysSinceLog = null;   // *working* days with no entry since the last one
  if (lastLog) {
    daysSinceLog = 0;
    for (const dt = new Date(parseISO(lastLog)); dt < today; dt.setDate(dt.getDate() + 1)) {
      if (toISO(dt) === lastLog) continue;
      if (isWorkingDay(dt)) daysSinceLog++;
    }
  }

  let logStreak = 0;  // consecutive working days each with >=1 entry, ending today/yesterday
  {
    const dt = new Date(today);
    if (!loggedToday) dt.setDate(dt.getDate() - 1);
    for (let guard = 0; guard < 90; guard++) {
      if (!isWorkingDay(dt)) { dt.setDate(dt.getDate() - 1); continue; }
      if (logDaySet.has(toISO(dt))) { logStreak++; dt.setDate(dt.getDate() - 1); }
      else break;
    }
  }

  return {
    total: Math.round(total * 10) / 10, required: d.required, goal: d.goal,
    toRequired: Math.round(toRequired * 10) / 10, toGoal: Math.round(toGoal * 10) / 10,
    pctGoal, requiredMark, past275: total >= d.required,
    daysLeft, workDays, collegeDays, offDays, availDays, capacity,
    hoursPerDay: d.hoursPerDay,
    finishDays, finishDate, finishSlackDays, finishSpareDays, canFinish, shortfall,
    perDayGoal, perDayPass, slack, verdict, verdictOk,
    weekLogged, assistedHours: Math.round(assisted * 10) / 10, jobHours: Math.round(jobH * 10) / 10,
    jobsDone, jobsTotal, ...counts, targets: d.jobTargets,
    boiler, fault, boilerCovered, faultsCovered,
    jobsNeeded, boilerGaps, faultGaps,
    jobsPerWeek: planRate, jobsPerWeekActual, weeksToJobs, jobsFinishDate,
    portfolioFinishDate, portfolioCanFinish, portfolioSlackDays, portfolioGate,
    boilerTypes: d.boilerTypes, repairFaults: d.repairFaults,
    atCollegeNow, backOnTools, nextBlock, nextBlockDays, blocksBeforeDeadline,
    loggedToday, lastLog, daysSinceLog, logStreak,
  };
}

// ---------- gas rating: gas rate -> heat input ----------
// Defaults per NICEIC Pocket Guide Gas 3 / standard ACS & BPEC teaching (natural gas).
const GAS = {
  cvMetric: 38.76,    // MJ/m3, gross
  cvImperial: 1040,   // Btu/ft3, gross
  grossToNet: 1.1,    // natural gas
  kwBtuH: 3412,       // 1 kW = 3412 Btu/h
};
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

// metric timed method: volume V (m3) passed in T seconds -> m3/h
function gasRateMetric(volumeM3, seconds) {
  const s = Number(seconds);
  if (!s || s <= 0) return null;
  return r3((3600 * Number(volumeM3)) / s);
}
// imperial timed method: F ft3 per test-dial revolution, T seconds for one rev -> ft3/h
function gasRateImperial(ft3PerRev, seconds) {
  const s = Number(seconds);
  if (!s || s <= 0) return null;
  return r2((3600 * Number(ft3PerRev)) / s);
}
// metric: m3/h -> kW gross and net
function heatInputMetric(m3h, cv, g2n) {
  cv = Number(cv) || GAS.cvMetric;
  g2n = Number(g2n) || GAS.grossToNet;
  const rate = Number(m3h);
  if (!(rate > 0)) return null;
  const gross = (rate * cv) / 3.6;
  return { m3h: rate, cv, g2n, gross: r1(gross), net: r1(gross / g2n) };
}
// imperial: ft3/h -> Btu/h -> kW gross and net
function heatInputImperial(ft3h, cv, g2n) {
  cv = Number(cv) || GAS.cvImperial;
  g2n = Number(g2n) || GAS.grossToNet;
  const rate = Number(ft3h);
  if (!(rate > 0)) return null;
  const btuh = rate * cv;
  const gross = btuh / GAS.kwBtuH;
  return { ft3h: rate, cv, g2n, btuh: Math.round(btuh), gross: r1(gross), net: r1(gross / g2n) };
}

// ---------- scheme presets (targets are only a starting point; centres vary) ----------
const SCHEMES = [
  { id: "standard", label: "Standard gas portfolio",
    required: 275, goal: 330, hoursPerDay: 8,
    jobTargets: { install: 5, service: 5, repair: 4 } },
  { id: "extended", label: "Extended — some centres",
    required: 300, goal: 350, hoursPerDay: 8,
    jobTargets: { install: 6, service: 6, repair: 5 } },
  { id: "custom", label: "Custom — my centre's numbers" },
];

// ---------- weekly hours history (for the progress view) ----------
function weeklyHours(data, now = new Date(), weeks = 8) {
  const d = { ...DEFAULT_DATA, ...data };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMon = mondayOf(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(thisMon); from.setDate(from.getDate() - i * 7);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    let assisted = 0, jobH = 0;
    for (const r of d.hours || []) {
      const dt = parseISO(r.date);
      if (!isNaN(dt) && dt >= from && dt < to) assisted += Number(r.h) || 0;
    }
    for (const r of d.jobs || []) {
      const dt = parseISO(r.date);
      if (!isNaN(dt) && dt >= from && dt < to) jobH += Number(r.h) || 0;
    }
    out.push({
      weekStart: toISO(from), week: isoWeek(from),
      assisted: r1(assisted), jobHours: r1(jobH), total: r1(assisted + jobH),
      current: i === 0,
    });
  }
  return out;
}

// ---------- Gas Safe card warnings for engineers you've logged work under ----------
function engineerCardWarnings(data, now = new Date()) {
  const d = { ...DEFAULT_DATA, ...data };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const soon = new Date(today); soon.setDate(soon.getDate() + 30);
  const out = [];
  for (const e of d.engineers || []) {
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.expiry || "")) continue;
    const exp = parseISO(e.expiry);
    const jobs = (d.jobs || []).filter((j) => j.engineer === e.name).length;
    if (exp < today) {
      out.push({ name: e.name, expired: true, jobs,
        detail: `card expired ${toISO(exp)}${jobs ? ` — ${jobs} write-up${jobs === 1 ? "" : "s"} linked` : ""}` });
    } else if (exp < soon) {
      out.push({ name: e.name, expired: false, soon: true, jobs, detail: `card expires ${toISO(exp)}` });
    }
  }
  return out;
}

// ---------- "what's left" checklist ----------
function buildChecklist(data, now = new Date()) {
  const s = computeStatus(data, now);
  const d = { ...DEFAULT_DATA, ...data };
  const items = [];
  items.push({ key: "pass", label: `Reach the ${d.required} h pass mark`, done: !!s.past275,
    detail: s.past275 ? `${s.total} h logged` : `${s.toRequired} h to go` });
  items.push({ key: "goal", label: `Reach your ${d.goal} h goal`, done: s.toGoal <= 0,
    detail: s.toGoal <= 0 ? `${s.total} h logged` : `${s.toGoal} h to go` });
  for (const [k, lbl] of [["install", "installs"], ["service", "services"], ["repair", "repairs"]]) {
    const have = s[k] || 0, need = (s.targets && s.targets[k]) || 0;
    items.push({ key: "wu:" + k, label: `${need} unassisted ${lbl}`, done: have >= need, detail: `${have} of ${need}` });
  }
  for (const b of d.boilerTypes || [])
    items.push({ key: "boiler:" + b, label: `Write-up on a ${b} boiler`, done: (s.boiler[b] || 0) > 0,
      detail: (s.boiler[b] || 0) > 0 ? `${s.boiler[b]} logged` : "none yet" });
  for (const f of d.repairFaults || [])
    items.push({ key: "fault:" + f, label: `Repair write-up — ${f} fault`, done: (s.fault[f] || 0) > 0,
      detail: (s.fault[f] || 0) > 0 ? `${s.fault[f]} logged` : "none yet" });
  for (const w of engineerCardWarnings(data, now))
    if (w.expired) items.push({ key: "eng:" + w.name, label: `${w.name}'s Gas Safe card`, done: false, detail: w.detail, warn: true });
  const counted = items.filter((x) => !x.warn);
  return { items, done: counted.filter((x) => x.done).length, total: counted.length };
}

// ---------- data sanity warnings ----------
function dataWarnings(data, now = new Date()) {
  const d = { ...DEFAULT_DATA, ...data };
  const perDay = Number(d.hoursPerDay) || 8;
  const collegeWeeks = new Set((d.blocks || []).map((b) => isoWeek(parseISO(b))));
  const out = [];
  const byDay = {};
  const all = [
    ...(d.hours || []).map((r) => ({ ...r, kind: "hours" })),
    ...(d.jobs || []).map((r) => ({ ...r, kind: "job" })),
  ];
  for (const r of all) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) continue;
    byDay[r.date] = (byDay[r.date] || 0) + (Number(r.h) || 0);
    if (!(Number(r.h) > 0))
      out.push({ kind: "zero", date: r.date, msg: `${r.kind === "job" ? "Write-up" : "Hours entry"} on ${r.date} has no hours` });
    if (collegeWeeks.has(isoWeek(parseISO(r.date))))
      out.push({ kind: "college", date: r.date, msg: `Entry dated ${r.date} is in a college block week` });
  }
  for (const [day, h] of Object.entries(byDay))
    if (h > perDay + 0.01) out.push({ kind: "overday", date: day, msg: `${r1(h)} h on ${day} — more than a ${perDay} h day` });
  const hd = {};
  for (const r of d.hours || [])
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) hd[r.date] = (hd[r.date] || 0) + 1;
  for (const [day, n] of Object.entries(hd))
    if (n > 1) out.push({ kind: "dupe", date: day, msg: `${n} separate hours entries on ${day} — check that's right` });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------- College Hub photo folders: match "NN. YYYY-MM-DD  <description>" to a date ----------
const HUB_FOLDER_DATE = /^\d+\.\s+(\d{4}-\d{2}-\d{2})(?:\s|$)/;
function matchHubFolder(folders, dateISO) {
  return (folders || []).find((f) => {
    const name = typeof f === "string" ? f : f.name;
    const m = HUB_FOLDER_DATE.exec(name || "");
    return m && m[1] === dateISO;
  }) || null;
}

// ---------- next N days, classified for the Home "pipe run" strip ----------
function nextDaysStrip(data, now = new Date(), days = 14) {
  const d = { ...DEFAULT_DATA, ...data };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const collegeWeeks = new Set((d.blocks || []).map((b) => isoWeek(parseISO(b))));
  const offSet = new Set(d.off || []);
  const logDaySet = new Set(
    [...(d.hours || []), ...(d.jobs || [])].map((r) => r.date).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
  );
  const out = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(today); dt.setDate(dt.getDate() + i);
    const iso = toISO(dt);
    const dow = dt.getDay();
    const weekend = dow === 0 || dow === 6;
    const college = collegeWeeks.has(isoWeek(dt));
    const off = offSet.has(iso);
    const logged = logDaySet.has(iso);
    // precedence: college > off > weekend > logged > plain working day
    let status = "work";
    if (logged) status = "logged";
    if (weekend) status = "weekend";
    if (off) status = "off";
    if (college) status = "college";
    out.push({ date: iso, dow, today: i === 0, weekend, college, off, logged, status });
  }
  return out;
}

const GasLogic = {
  computeStatus, DEFAULT_DATA, toISO, parseISO, isoWeek,
  GAS, gasRateMetric, gasRateImperial, heatInputMetric, heatInputImperial,
  SCHEMES, weeklyHours, buildChecklist, engineerCardWarnings, dataWarnings, nextDaysStrip,
  matchHubFolder,
};
if (typeof module !== "undefined" && module.exports) module.exports = GasLogic;
if (typeof window !== "undefined") window.GasLogic = GasLogic;

})();
