import assert from "node:assert/strict";
import test from "node:test";
import { formatAthensDateTime } from "../lib/formatDateTime.ts";

test("formatAthensDateTime shows Europe/Athens wall time", () => {
  const text = formatAthensDateTime("2026-11-01T10:00:00.000Z");
  assert.match(text, /12:00/);
  assert.match(text, /2026/);
});

test("formatAthensDateTime leaves a missing time blank", () => {
  assert.equal(formatAthensDateTime(null), "—");
  assert.equal(formatAthensDateTime(""), "—");
});
