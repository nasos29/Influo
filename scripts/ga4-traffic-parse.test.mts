import assert from "node:assert/strict";
import test from "node:test";
import {
  GA4_MAX_DATE_RANGES,
  parseGa4DateRangeMetricRows,
  splitGa4DateRangeBatches,
} from "../lib/ga4Traffic.ts";

test("splitGa4DateRangeBatches uses at most 4 date ranges per batch", () => {
  const batches = splitGa4DateRangeBatches({
    today: { name: "today", startDate: "2026-11-24", endDate: "2026-11-24" },
    d7: { name: "d7", startDate: "2026-11-17", endDate: "2026-11-24" },
    prev7: { name: "prev7", startDate: "2026-11-10", endDate: "2026-11-16" },
    d30: { name: "d30", startDate: "2026-10-25", endDate: "2026-11-24" },
    prev30: { name: "prev30", startDate: "2026-09-25", endDate: "2026-10-24" },
  });
  assert.equal(batches.length, 2);
  assert.ok(batches.every((b) => b.batch.length <= GA4_MAX_DATE_RANGES));
  assert.deepEqual(batches[0]!.keys, ["today", "d7", "prev7", "d30"]);
  assert.deepEqual(batches[1]!.keys, ["prev30"]);
});

test("parseGa4DateRangeMetricRows maps date_range_N rows to period keys", () => {
  const parsed = parseGa4DateRangeMetricRows(
    {
      rows: [
        {
          dimensionValues: [{ value: "date_range_0" }],
          metricValues: [{ value: "12" }, { value: "20" }],
        },
        {
          dimensionValues: [{ value: "date_range_3" }],
          metricValues: [{ value: "99" }, { value: "150" }],
        },
      ],
    },
    ["today", "d7", "prev7", "d30"],
    0
  );
  assert.equal(parsed.today, 12);
  assert.equal(parsed.d30, 99);
  assert.equal(parsed.d7, undefined);
});