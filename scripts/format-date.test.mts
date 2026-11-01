import assert from "node:assert/strict";
import test from "node:test";
import {
  dmyToYmd,
  formatDisplayDate,
  formatDisplayDateTime,
  maskDmyInput,
  ymdToDmy,
} from "../lib/formatDate.ts";
import { formatAthensDateTime, formatDate } from "../lib/formatDateTime.ts";

test("date-only values stay on the stored civil day", () => {
  assert.equal(formatDisplayDate("2026-11-15"), "15/11/2026");
  assert.equal(formatDate("2026-11-15", "en"), "15/11/2026");
  assert.equal(formatDate("2026-11-15", "el"), "15/11/2026");
  assert.equal(ymdToDmy("2026-02-29"), "");
  assert.equal(ymdToDmy("2024-02-29"), "29/02/2024");
});

test("dd/mm/yyyy parses back to YYYY-MM-DD", () => {
  assert.equal(dmyToYmd("15/11/2026"), "2026-11-15");
  assert.equal(dmyToYmd("5/1/2026"), "2026-01-05");
  assert.equal(dmyToYmd("15-11-2026"), "2026-11-15");
  assert.equal(dmyToYmd("31/02/2026"), "");
  assert.equal(maskDmyInput("15112026"), "15/11/2026");
  assert.equal(maskDmyInput("2026-11-15"), "15/11/2026");
});

test("a slash is inserted after two day digits and two month digits", () => {
  assert.equal(maskDmyInput("1", ""), "1");
  assert.equal(maskDmyInput("15", "1"), "15/");
  assert.equal(maskDmyInput("15/1", "15/"), "15/1");
  assert.equal(maskDmyInput("15/11", "15/1"), "15/11/");
  assert.equal(maskDmyInput("15/11/2", "15/11/"), "15/11/2");
  assert.equal(maskDmyInput("15/11/2026", "15/11/202"), "15/11/2026");
});

test("backspace deletes a slash instead of putting it back", () => {
  assert.equal(maskDmyInput("15", "15/"), "15");
  assert.equal(maskDmyInput("1", "15"), "1");
  assert.equal(maskDmyInput("", "1"), "");
  assert.equal(maskDmyInput("15/11", "15/11/"), "15/11");
  assert.equal(maskDmyInput("15/1", "15/11"), "15/1");
  assert.equal(maskDmyInput("15/", "15/1"), "15/");
  assert.equal(maskDmyInput("1", "1/"), "1");
});

test("a slash the user types is not doubled", () => {
  assert.equal(maskDmyInput("1/", "1"), "1/");
  assert.equal(maskDmyInput("1//", "1/"), "1/");
  assert.equal(maskDmyInput("15/", "15"), "15/");
  assert.equal(maskDmyInput("15//", "15/"), "15/");
  assert.equal(maskDmyInput("15/1/", "15/1"), "15/1/");
  assert.equal(maskDmyInput("15/11/", "15/11"), "15/11/");
  assert.equal(maskDmyInput("15/11//", "15/11/"), "15/11/");
});

test("instants use Europe/Athens and dd/mm/yyyy", () => {
  assert.equal(formatDisplayDateTime("2026-11-01T10:00:00.000Z"), "01/11/2026 12:00");
  assert.equal(formatAthensDateTime("2026-11-01T10:00:00.000Z"), "01/11/2026 12:00");
  assert.equal(formatDisplayDateTime("2026-11-15"), "15/11/2026");
  assert.equal(formatAthensDateTime(null), "—");
  assert.equal(formatAthensDateTime(""), "—");
});
