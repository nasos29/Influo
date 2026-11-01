import assert from "node:assert/strict";
import test from "node:test";
import { formatAthensDateTime } from "../lib/formatDateTime.ts";

test("formatAthensDateTime shows Europe/Athens wall time as dd/mm/yyyy", () => {
  assert.equal(formatAthensDateTime("2026-11-01T10:00:00.000Z"), "01/11/2026 12:00");
});

test("formatAthensDateTime leaves a missing time blank", () => {
  assert.equal(formatAthensDateTime(null), "—");
  assert.equal(formatAthensDateTime(""), "—");
});
