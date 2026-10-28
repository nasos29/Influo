// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/announcement-targets.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS,
  collectTargetIds,
  parseSpecificTargetIds,
} from "../lib/announcementTargets.ts";

test("collectTargetIds dedupes plural + singular and trims", () => {
  assert.deepEqual(
    collectTargetIds({
      plural: [" a ", "b", "a", "", "  "],
      singular: "b",
    }),
    ["a", "b"]
  );
  assert.deepEqual(collectTargetIds({ singular: "only" }), ["only"]);
  assert.deepEqual(collectTargetIds({ plural: "one" }), ["one"]);
  assert.deepEqual(collectTargetIds({}), []);
});

test("collectTargetIds ignores nullish and non-string junk", () => {
  assert.deepEqual(
    collectTargetIds({
      plural: [null, undefined, 12, "ok", { id: "x" }, "ok"],
      singular: null,
    }),
    ["12", "ok"]
  );
});

test("parseSpecificTargetIds requires at least one when required", () => {
  const empty = parseSpecificTargetIds({ required: true, kind: "influencer" });
  assert.equal(empty.ok, false);
  if (empty.ok) return;
  assert.equal(empty.code, "empty");

  const brandEmpty = parseSpecificTargetIds({ required: true, kind: "brand" });
  assert.equal(brandEmpty.ok, false);
  if (brandEmpty.ok) return;
  assert.equal(brandEmpty.code, "empty");
  assert.match(brandEmpty.error, /target_brand/);
});

test("parseSpecificTargetIds enforces max 50", () => {
  const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
  const tooMany = parseSpecificTargetIds({ plural: ids, required: true });
  assert.equal(tooMany.ok, false);
  if (tooMany.ok) return;
  assert.equal(tooMany.code, "too_many");
  assert.match(tooMany.error, /50/);
  assert.match(tooMany.error, /51/);
});

test("parseSpecificTargetIds accepts exactly 50 unique ids", () => {
  const ids = Array.from({ length: MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS }, (_, i) => `u-${i}`);
  const ok = parseSpecificTargetIds({
    plural: [...ids, ids[0], ids[1]],
    singular: ids[0],
    required: true,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.ids.length, 50);
  assert.equal(ok.ids[0], "u-0");
});

test("singular-only stays backward compatible", () => {
  const ok = parseSpecificTargetIds({
    singular: "legacy-id",
    plural: undefined,
    required: true,
    kind: "brand",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.deepEqual(ok.ids, ["legacy-id"]);
});
