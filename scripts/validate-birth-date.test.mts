// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/validate-birth-date.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  BIRTH_DATE_MIN,
  BIRTH_DATE_RANGE_MESSAGE,
  BIRTH_DATE_TOO_YOUNG_MESSAGE,
  athensTodayYmd,
  validateBirthDate,
} from "../lib/validateBirthDate.ts";

/** Fixed "now" in Athens afternoon: 2026-10-28. */
const NOW = new Date("2026-10-28T12:00:00.000Z");

test("1929 is out of range", () => {
  const r = validateBirthDate("1929-12-31", NOW);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "out_of_range");
  assert.equal(r.message.el, BIRTH_DATE_RANGE_MESSAGE.el);
  assert.equal(r.message.en, BIRTH_DATE_RANGE_MESSAGE.en);
});

test("1930-01-01 is accepted (and old enough)", () => {
  const r = validateBirthDate("1930-01-01", NOW);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.normalized, BIRTH_DATE_MIN);
  assert.ok(r.age >= 15);
});

test("today is in range but too young", () => {
  const today = athensTodayYmd(NOW);
  const r = validateBirthDate(today, NOW);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "too_young");
  assert.equal(r.message.el, BIRTH_DATE_TOO_YOUNG_MESSAGE.el);
  assert.equal(r.message.en, BIRTH_DATE_TOO_YOUNG_MESSAGE.en);
});

test("tomorrow is out of range", () => {
  // 2026-10-29 relative to NOW (2026-10-28 Athens)
  const r = validateBirthDate("2026-10-29", NOW);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "out_of_range");
});

test("14 years old is rejected", () => {
  // Born 2011-10-29 → still 14 on 2026-10-28 Athens
  const r = validateBirthDate("2011-10-29", NOW);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "too_young");
});

test("exactly 15 today is accepted", () => {
  // Born 2011-10-28 → turns 15 on 2026-10-28 Athens
  const r = validateBirthDate("2011-10-28", NOW);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.age, 15);
  assert.equal(r.normalized, "2011-10-28");
});

test("impossible calendar day is invalid", () => {
  const r = validateBirthDate("2024-02-30", NOW);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.code, "invalid");
});
