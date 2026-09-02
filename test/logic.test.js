// Plain Node assertions — run: node test/logic.test.js
const assert = require("assert");
const { computeStatus, DEFAULT_DATA } = require("../src/logic.js");

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
