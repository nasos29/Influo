import { test } from "node:test";
import assert from "node:assert/strict";
import { transcriptFromResults, appendDictation, mergeSegments } from "../lib/dictation.ts";
const r = (...xs: [string, boolean][]) => xs.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } }));
test("android cumulative finals are deduped", () => {
  const res = r(["έλα", true], ["έλα καλημέρα", true], ["έλα καλημέρα τι", true], ["έλα καλημέρα τι γίνεται", true]);
  assert.equal(transcriptFromResults(res).text, "έλα καλημέρα τι γίνεται");
});
test("desktop separate finals + interim", () => {
  const res = r(["έλα καλημέρα", true], [" τι γίνεται", false]);
  const o = transcriptFromResults(res);
  assert.equal(o.finals, "έλα καλημέρα");
  assert.equal(o.text, "έλα καλημέρα τι γίνεται");
});
test("repeated identical segment skipped", () => assert.equal(mergeSegments(["γεια σου", "γεια σου"]), "γεια σου"));
test("append to typed text", () => assert.equal(appendDictation("Hi", "έλα"), "Hi έλα"));
