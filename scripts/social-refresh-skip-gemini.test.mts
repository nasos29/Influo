import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/social-refresh-batch/route.ts", "utf8");
const refresh = fs.readFileSync("lib/refreshSocialStats.ts", "utf8");

test("social-refresh-batch does not block start when Gemini is paused", () => {
  assert.doesNotMatch(route, /paused: true,\s*message: GEMINI_PAUSED_MSG/);
  assert.match(route, /skip_gemini:\s*true/);
  assert.match(route, /skipGemini:\s*isGeminiPaused\(\)/);
});

test("refreshSocialStats exposes skipGemini", () => {
  assert.match(refresh, /skipGemini\?: boolean/);
  assert.match(refresh, /audit skipped \(skipGemini\)/);
});