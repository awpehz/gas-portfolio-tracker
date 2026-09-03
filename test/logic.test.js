// Plain Node assertions — run: node test/logic.test.js
const assert = require("assert");
const {
  computeStatus, DEFAULT_DATA,
  SCHEMES, weeklyHours, buildChecklist, engineerCardWarnings, dataWarnings,
} = require("../src/logic.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log("  ok  " + name); pass++; }
  catch (e) { console.log("FAIL  " + name + "\n      " + e.message); fail++; }
}

const NOW = new Date(2026, 7, 29); // Sat 29 Aug 2026, matches the session date

t("empty data → starts at 0, nothing logged", () => {
  const s = computeStatus({}, NOW);
  assert.strictEqual(s.total, 0);
  assert.strictEqual(s.toRequired, 275);
  assert.strictEqual(s.toGoal, 330);
  assert.strictEqual(s.jobsDone, 0);
});

t("adds assisted hours to the total and this-week", () => {
  const s = computeStatus({ hours: [{ date: "2026-08-29", h: 6 }] }, NOW);
  assert.strictEqual(s.total, 6);
  assert.strictEqual(s.weekLogged, 6);
  assert.strictEqual(s.toRequired, 269);
});

t("job carries hours AND bumps the count", () => {
  const s = computeStatus({ jobs: [{ date: "2026-08-29", type: "install", h: 3 }] }, NOW);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.install, 1);
  assert.strictEqual(s.jobsDone, 1);
  assert.strictEqual(s.jobHours, 3);
});

t("starting hours from settings add to the total", () => {
  const s = computeStatus({ baseHours: 29 }, NOW);
  assert.strictEqual(s.total, 29);
  assert.strictEqual(s.toRequired, 246);
});

t("college weeks + holidays are removed from available days", () => {
  const bare = computeStatus({ off: [], blocks: [] }, NOW);
  const real = computeStatus({}, NOW); // default blocks + no off
  assert.ok(real.availDays < bare.availDays, "default blocks should cut available days");
  assert.ok(real.collegeDays >= 25, "≈5 future block weeks * 5 days");
});

t("holiday days reduce availDays further", () => {
  const noOff = computeStatus({ off: [] }, NOW).availDays;
  const withOff = computeStatus({ off: ["2026-11-09", "2026-11-10"] }, NOW).availDays;
  assert.strictEqual(noOff - withOff, 2);
});

t("perDayGoal = toGoal / availDays", () => {
  const s = computeStatus({}, NOW);
  assert.ok(Math.abs(s.perDayGoal - s.toGoal / s.availDays) < 0.11);
});

t("weekend 'today' does not report atCollegeNow", () => {
  const s = computeStatus({}, NOW); // Saturday
  assert.strictEqual(s.atCollegeNow, false);
});

t("a weekday inside a block week reports atCollegeNow", () => {
  const s = computeStatus({}, new Date(2026, 8, 15)); // Tue 15 Sep, inside the 14 Sep block
  assert.strictEqual(s.atCollegeNow, true);
  assert.ok(s.backOnTools, "should say when you're back on the tools");
});

t("next block is the first future Monday", () => {
  const s = computeStatus({}, NOW);
  assert.strictEqual(s.nextBlockDays, 16); // 29 Aug → 14 Sep
});

t("past the pass mark flips past275", () => {
  const s = computeStatus({ hours: [{ date: "2026-08-29", h: 300 }] }, NOW);
  assert.strictEqual(s.past275, true);
  assert.strictEqual(s.toRequired, 0);
});

t("boiler-type and repair-fault coverage aggregate correctly", () => {
  const s = computeStatus({ jobs: [
    { date: "2026-08-29", type: "install", h: 2, boiler: "combi" },
    { date: "2026-08-29", type: "repair", h: 2, boiler: "system", fault: "water" },
    { date: "2026-08-29", type: "repair", h: 2, boiler: "traditional", fault: "gas" },
    { date: "2026-08-29", type: "service", h: 2, boiler: "combi", fault: "electrical" }, // fault ignored (not a repair)
  ] }, NOW);
  assert.strictEqual(s.boiler.combi, 2);
  assert.strictEqual(s.boiler.system, 1);
  assert.strictEqual(s.boiler.traditional, 1);
  assert.strictEqual(s.boilerCovered, true);
  assert.strictEqual(s.fault.water, 1);
  assert.strictEqual(s.fault.gas, 1);
  assert.strictEqual(s.fault.electrical, 0);      // service row does not count
  assert.strictEqual(s.faultsCovered, false);
});

t("custom settings are honoured", () => {
  const s = computeStatus({ baseHours: 100, goal: 200, required: 150 }, NOW);
  assert.strictEqual(s.total, 100);
  assert.strictEqual(s.toGoal, 100);
  assert.strictEqual(s.toRequired, 50);
});

t("job targets are adjustable", () => {
  const s = computeStatus({ jobTargets: { install: 3, service: 2, repair: 1 } }, NOW);
  assert.strictEqual(s.jobsTotal, 6);
  assert.strictEqual(s.targets.install, 3);
});

t("isoWeek is exported and stable across a DST boundary", () => {
  const { isoWeek } = require("../src/logic.js");
  // 26 Oct 2026 is the Monday after the UK clocks go back (25 Oct)
  assert.strictEqual(isoWeek(new Date(2026, 9, 26)), isoWeek(new Date(2026, 9, 30)));
});

t("availDays walk is unaffected by the Oct DST change", () => {
  // deadline just past the change; every weekday 26-30 Oct should count once
  const s = computeStatus({ deadline: "2026-10-30", blocks: [], off: [] }, new Date(2026, 9, 26));
  assert.strictEqual(s.workDays, 5);
  assert.strictEqual(s.availDays, 5);
});

t("garbage in the block/holiday lists doesn't crash", () => {
  const s = computeStatus({ blocks: ["not-a-date", ""], off: ["2026-13-99"] }, NOW);
  assert.ok(typeof s.perDayGoal === "number");
});

t("fastest finish: full days needed + a date, before the deadline", () => {
  // need 40 h at 8 h/day => 5 full days; plenty of runway to the deadline
  const s = computeStatus({ baseHours: 290, goal: 330, hoursPerDay: 8, deadline: "2026-12-22", blocks: [], off: [] }, new Date(2026, 8, 1));
  assert.strictEqual(s.finishDays, 5);
  assert.strictEqual(s.canFinish, true);
  assert.strictEqual(s.finishDate, "2026-09-07"); // Mon 7 Sep — 5th weekday from Tue 1 Sep
  assert.ok(s.finishSpareDays > 0);
});

t("fastest finish: already at goal => zero days, today", () => {
  const s = computeStatus({ baseHours: 340, goal: 330 }, NOW);
  assert.strictEqual(s.finishDays, 0);
  assert.strictEqual(s.finishDate, "2026-08-29");
});

t("fastest finish: not enough capacity => canFinish false, shortfall reported", () => {
  const s = computeStatus({ goal: 330, hoursPerDay: 8, deadline: "2026-09-04", blocks: [], off: [] }, new Date(2026, 8, 1));
  assert.strictEqual(s.canFinish, false);
  assert.ok(s.shortfall > 0);
});

t("heatInputMetric: 2.91 m3/h -> 31.3 kW gross / 28.5 kW net (CV 38.76, /1.1)", () => {
  const { heatInputMetric } = require("../src/logic.js");
  const r = heatInputMetric(2.91);
  assert.strictEqual(r.gross, 31.3);
  assert.strictEqual(r.net, 28.5);
});

t("heatInputImperial: 103 ft3/h -> Btu/h then /3412 -> kW", () => {
  const { heatInputImperial } = require("../src/logic.js");
  const r = heatInputImperial(103);
  assert.strictEqual(r.btuh, 107120);
  assert.strictEqual(r.gross, 31.4);
  assert.strictEqual(r.net, 28.5);
});

t("timed methods: (3600 x V) / T", () => {
  const { gasRateMetric, gasRateImperial } = require("../src/logic.js");
  assert.strictEqual(gasRateMetric(0.08, 126), 2.286);
  assert.strictEqual(gasRateImperial(2, 68), 105.88);
  assert.strictEqual(gasRateMetric(1, 0), null); // guard divide-by-zero
});

t("custom CV and gross-to-net factor are honoured", () => {
  const { heatInputMetric } = require("../src/logic.js");
  const r = heatInputMetric(2.0, 39.5, 1.11);
  assert.strictEqual(r.gross, Math.round((2 * 39.5 / 3.6) * 10) / 10);
  assert.strictEqual(r.net, Math.round((2 * 39.5 / 3.6 / 1.11) * 10) / 10);
});

t("portfolio: no jobs done => write-ups gate is 14 at the plan rate", () => {
  const s = computeStatus(
    { goal: 330, hoursPerDay: 8, deadline: "2027-06-01", blocks: [], off: [], jobsPerWeek: 1 },
    new Date(2026, 8, 1)
  );
  assert.strictEqual(s.jobsNeeded, 14);
  assert.strictEqual(s.weeksToJobs, 14);
  assert.strictEqual(s.jobsFinishDate, "2026-12-08");   // 14 weeks (98 days) on from 1 Sep
  assert.strictEqual(s.portfolioGate, "write-ups");
  assert.strictEqual(s.portfolioFinishDate, s.jobsFinishDate);
});

t("portfolio: a faster write-up rate pulls the finish in", () => {
  const base = { goal: 330, hoursPerDay: 8, deadline: "2027-06-01", blocks: [], off: [] };
  const slow = computeStatus({ ...base, jobsPerWeek: 1 }, new Date(2026, 8, 1));
  const fast = computeStatus({ ...base, jobsPerWeek: 2 }, new Date(2026, 8, 1));
  assert.ok(fast.weeksToJobs < slow.weeksToJobs);
});

t("portfolio: all targets met => jobsNeeded 0 and hours become the gate", () => {
  const jobs = [
    ...Array(5).fill(0).map(() => ({ type: "install", boiler: "combi", h: 2, date: "2026-08-10" })),
    ...Array(5).fill(0).map(() => ({ type: "service", boiler: "system", h: 2, date: "2026-08-11" })),
    { type: "repair", boiler: "traditional", fault: "water", h: 2, date: "2026-08-12" },
    { type: "repair", boiler: "combi", fault: "gas", h: 2, date: "2026-08-12" },
    { type: "repair", boiler: "system", fault: "electrical", h: 2, date: "2026-08-12" },
    { type: "repair", boiler: "combi", fault: "water", h: 2, date: "2026-08-12" },
  ];
  const s = computeStatus(
    { goal: 330, hoursPerDay: 8, deadline: "2027-06-01", blocks: [], off: [], jobs },
    new Date(2026, 8, 1)
  );
  assert.strictEqual(s.jobsNeeded, 0);
  assert.strictEqual(s.weeksToJobs, 0);
  assert.strictEqual(s.portfolioGate, "hours");
  assert.strictEqual(s.portfolioFinishDate, s.finishDate);
});

t("accountability: no entries => lastLog null, streak 0", () => {
  const s = computeStatus({ blocks: [], off: [] }, new Date(2026, 8, 10));
  assert.strictEqual(s.lastLog, null);
  assert.strictEqual(s.daysSinceLog, null);
  assert.strictEqual(s.logStreak, 0);
  assert.strictEqual(s.loggedToday, false);
});

t("accountability: logged today builds a streak over working days", () => {
  // Wed 9, Thu 10 Sep 2026 are weekdays; Fri 11 is 'today'
  const s = computeStatus({
    blocks: [], off: [],
    hours: [{ date: "2026-09-09", h: 4 }, { date: "2026-09-10", h: 4 }, { date: "2026-09-11", h: 4 }],
  }, new Date(2026, 8, 11));
  assert.strictEqual(s.loggedToday, true);
  assert.strictEqual(s.lastLog, "2026-09-11");
  assert.strictEqual(s.daysSinceLog, 0);
  assert.strictEqual(s.logStreak, 3);
});

t("accountability: a gap of working days is counted; streak resets", () => {
  // last entry Mon 7 Sep; today Fri 11 Sep -> Tue/Wed/Thu = 3 working days missed
  const s = computeStatus({ blocks: [], off: [], hours: [{ date: "2026-09-07", h: 6 }] }, new Date(2026, 8, 11));
  assert.strictEqual(s.lastLog, "2026-09-07");
  assert.strictEqual(s.daysSinceLog, 3);
  assert.strictEqual(s.logStreak, 0);
});

t("accountability: weekend + days off don't count against the streak", () => {
  // entry Fri 4 Sep, today Mon 7 Sep -> only weekend between => no missed working days
  const s = computeStatus({ blocks: [], off: [], jobs: [{ date: "2026-09-04", type: "install", h: 3, boiler: "combi" }] }, new Date(2026, 8, 7));
  assert.strictEqual(s.daysSinceLog, 0);
});

// ---------- scheme presets ----------
t("scheme presets: standard + extended carry full numbers, custom is a blank", () => {
  const std = SCHEMES.find((x) => x.id === "standard");
  assert.strictEqual(std.required, 275);
  assert.strictEqual(std.goal, 330);
  assert.deepStrictEqual(std.jobTargets, { install: 5, service: 5, repair: 4 });
  const ext = SCHEMES.find((x) => x.id === "extended");
  assert.ok(ext.goal > std.goal && ext.jobTargets.repair >= std.jobTargets.repair);
  assert.strictEqual(SCHEMES.find((x) => x.id === "custom").required, undefined);
});

// ---------- weekly hours history ----------
t("weeklyHours: buckets assisted + write-up hours into Mon–Sun weeks", () => {
  const w = weeklyHours({
    hours: [{ date: "2026-08-31", h: 6 }, { date: "2026-09-02", h: 4 }],
    jobs: [{ date: "2026-09-01", type: "install", h: 3, boiler: "combi" }],
  }, new Date(2026, 8, 4), 3);
  assert.strictEqual(w.length, 3);
  const cur = w[w.length - 1];
  assert.strictEqual(cur.current, true);
  assert.strictEqual(cur.assisted, 10);
  assert.strictEqual(cur.jobHours, 3);
  assert.strictEqual(cur.total, 13);
  assert.strictEqual(w[0].total, 0);
});

// ---------- engineer card warnings ----------
t("engineerCardWarnings: expired card with a linked write-up is flagged", () => {
  const out = engineerCardWarnings({
    engineers: [{ name: "D. Harper", expiry: "2026-01-01" }, { name: "M. Cole", expiry: "2030-01-01" }],
    jobs: [{ date: "2026-08-20", type: "install", h: 3, engineer: "D. Harper" }],
  }, new Date(2026, 8, 4));
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].name, "D. Harper");
  assert.strictEqual(out[0].expired, true);
  assert.strictEqual(out[0].jobs, 1);
});

t("engineerCardWarnings: a card expiring within 30 days is a soft warning, not expired", () => {
  const out = engineerCardWarnings({
    engineers: [{ name: "A. Fitter", expiry: "2026-09-20" }],
  }, new Date(2026, 8, 4));
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].expired, false);
  assert.strictEqual(out[0].soon, true);
});

// ---------- checklist ----------
t("buildChecklist: every target becomes an item; done count tracks progress", () => {
  const c = buildChecklist({}, NOW);
  // 2 hours targets + 3 write-up counts + 3 boilers + 3 faults = 11, none done
  assert.strictEqual(c.total, 11);
  assert.strictEqual(c.done, 0);
  const c2 = buildChecklist({
    baseHours: 400,
    jobs: [{ date: "2026-08-01", type: "install", h: 3, boiler: "combi" }],
  }, NOW);
  assert.ok(c2.done >= 3); // pass + goal + combi boiler
  assert.ok(c2.items.some((i) => i.key === "boiler:combi" && i.done));
});

// ---------- data sanity warnings ----------
t("dataWarnings: zero-hour entry, over-long day, duplicate day and college-week entry", () => {
  const w = dataWarnings({
    hoursPerDay: 8,
    blocks: ["2026-08-24"],
    hours: [{ date: "2026-08-25", h: 5 }, { date: "2026-08-25", h: 6 }, { date: "2026-09-02", h: 0 }],
    jobs: [{ date: "2026-08-26", type: "service", h: 2, boiler: "system" }],
  }, new Date(2026, 8, 4));
  const kinds = w.map((x) => x.kind);
  assert.ok(kinds.includes("zero"));
  assert.ok(kinds.includes("overday")); // 25 Aug: 5 + 6 = 11 h
  assert.ok(kinds.includes("dupe"));
  assert.ok(kinds.includes("college")); // w/c 24 Aug block, entries 25/26 Aug
});

t("dataWarnings: a clean log produces nothing", () => {
  const w = dataWarnings({
    hoursPerDay: 8, blocks: [],
    hours: [{ date: "2026-08-25", h: 6 }],
    jobs: [{ date: "2026-08-26", type: "service", h: 2, boiler: "system" }],
  }, new Date(2026, 8, 4));
  assert.strictEqual(w.length, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
