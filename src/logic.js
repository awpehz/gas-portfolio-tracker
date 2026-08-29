// Pure computation — no DOM, no Node. Shared by renderer (and testable).

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
  baseHours: 29,
  required: 275,
  goal: 330,
  hoursPerDay: 8,
  deadline: "2026-12-22",
  jobTargets: { install: 5, service: 5, repair: 4 },
  blocks: [
    "2026-08-24", "2026-09-14", "2026-10-05", "2026-11-02", "2026-11-23",
    "2026-12-14", "2027-01-25", "2027-02-15", "2027-03-08", "2027-04-12",
    "2027-05-03", "2027-05-24", "2027-07-05"
  ],
  hours: [],   // { date: "YYYY-MM-DD", h: number, note?: string }
  jobs: [],    // { date, type: "install"|"service"|"repair", h: number }
  off: []      // "YYYY-MM-DD"
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

  // walk every day to the deadline, classify weekdays
  let workDays = 0, collegeDays = 0, offDays = 0, availDays = 0;
  for (let t = today.getTime(); t <= deadline.getTime(); t += DAY) {
    const dt = new Date(t);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    workDays++;
    if (collegeWeeks.has(isoWeek(dt))) collegeDays++;
    else if (offSet.has(toISO(dt))) offDays++;
    else availDays++;
  }
  const capacity = availDays * d.hoursPerDay;
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
  for (const j of d.jobs) if (counts[j.type] != null) counts[j.type]++;
  const jobsDone = counts.install + counts.service + counts.repair;
  const jobsTotal = d.jobTargets.install + d.jobTargets.service + d.jobTargets.repair;

  // college schedule
  const atCollegeNow = today.getDay() >= 1 && today.getDay() <= 5 && collegeWeeks.has(twKey);
  let nextBlock = "none left", nextBlockDays = null;
  for (const b of d.blocks) {
    const bd = parseISO(b);
    if (bd > today) { nextBlock = fmtShort(bd); nextBlockDays = Math.round((bd - today) / DAY); break; }
  }
  let backOnTools = null;
  if (atCollegeNow) {
    let m = mondayOf(today);
    do { m = new Date(m.getTime() + 7 * DAY); } while (collegeWeeks.has(isoWeek(m)));
    backOnTools = fmtShort(m);
  }
  const blocksBeforeDeadline = d.blocks.filter((b) => {
    const bd = parseISO(b);
    return bd > today && bd <= deadline;
  }).length;

  const daysLeft = Math.round((deadline - today) / DAY);

  return {
    total: Math.round(total * 10) / 10, required: d.required, goal: d.goal,
    toRequired: Math.round(toRequired * 10) / 10, toGoal: Math.round(toGoal * 10) / 10,
    pctGoal, requiredMark, past275: total >= d.required,
    daysLeft, workDays, collegeDays, offDays, availDays, capacity,
    perDayGoal, perDayPass, slack, verdict, verdictOk,
    weekLogged, assistedHours: Math.round(assisted * 10) / 10, jobHours: Math.round(jobH * 10) / 10,
    jobsDone, jobsTotal, ...counts, targets: d.jobTargets,
    atCollegeNow, backOnTools, nextBlock, nextBlockDays, blocksBeforeDeadline,
  };
}

const GasLogic = { computeStatus, DEFAULT_DATA, toISO, parseISO };
if (typeof module !== "undefined" && module.exports) module.exports = GasLogic;
if (typeof window !== "undefined") window.GasLogic = GasLogic;
