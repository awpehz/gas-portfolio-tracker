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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
