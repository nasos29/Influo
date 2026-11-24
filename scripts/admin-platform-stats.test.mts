import assert from "node:assert/strict";
import test from "node:test";
import {
  addAthensYmdDays,
  aggregateTopLabels,
  athensDayStartIso,
  athensTodayYmd,
  athensYmdFromIso,
  bucketSignupsByDay,
  buildStatsPeriodBounds,
  changePct,
  countInPeriods,
  splitDelimitedLabels,
} from "../lib/adminPlatformStats.ts";

const FIXED = new Date("2026-11-24T10:00:00.000Z");

test("athensTodayYmd uses Europe/Athens civil day", () => {
  assert.equal(athensTodayYmd(FIXED), "2026-11-24");
});

test("athensDayStartIso returns midnight Athens", () => {
  const iso = athensDayStartIso("2026-11-24");
  assert.equal(athensYmdFromIso(iso), "2026-11-24");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  assert.equal(Number(parts.find((p) => p.type === "hour")?.value), 0);
});

test("addAthensYmdDays steps calendar days", () => {
  assert.equal(addAthensYmdDays("2026-11-24", -1), "2026-11-23");
  assert.equal(addAthensYmdDays("2026-11-24", 1), "2026-11-25");
});

test("changePct handles zero previous", () => {
  assert.equal(changePct(0, 0), null);
  assert.equal(changePct(5, 0), 100);
  assert.equal(changePct(11, 10), 10);
});

test("splitDelimitedLabels trims and splits commas", () => {
  assert.deepEqual(splitDelimitedLabels(" a , b,c "), ["a", "b", "c"]);
  assert.deepEqual(splitDelimitedLabels(""), []);
});

test("aggregateTopLabels counts and sorts", () => {
  const rows = aggregateTopLabels(["food", "beauty", "food", "travel"]);
  assert.equal(rows[0]?.label, "food");
  assert.equal(rows[0]?.count, 2);
});

test("bucketSignupsByDay fills day keys", () => {
  const bounds = buildStatsPeriodBounds(FIXED);
  const rows = bucketSignupsByDay(
    [bounds.todayStart],
    [bounds.d7Start],
    bounds.dayKeys30
  );
  const today = rows.find((r) => r.date === bounds.todayYmd);
  assert.ok(today);
  assert.equal(today!.creators, 1);
  assert.equal(today!.brands, 0);
});

test("countInPeriods buckets timestamps", () => {
  const bounds = buildStatsPeriodBounds(FIXED);
  const flags = countInPeriods(bounds.todayStart, bounds);
  assert.equal(flags.today, 1);
  assert.equal(flags.d7, 1);
  assert.equal(flags.d30, 1);
});