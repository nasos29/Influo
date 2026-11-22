import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/social-refresh-batch/route.ts", "utf8");
const refresh = fs.readFileSync("lib/refreshSocialStats.ts", "utf8");
const py = fs.readFileSync("scripts/social_refresh_batch.py", "utf8");

test("social-refresh-batch uses request-body skip_gemini, not isGeminiPaused", () => {
  assert.doesNotMatch(route, /paused: true,\s*message: GEMINI_PAUSED_MSG/);
  assert.doesNotMatch(route, /isGeminiPaused/);
  assert.match(route, /Boolean\(body\?\.skip_gemini\)/);
  assert.match(route, /skip_gemini:\s*true/);
});

test("Oracle scraper forwards skip_gemini on start and apply", () => {
  assert.match(py, /skip_gemini/);
  assert.match(py, /"action": "apply"/);
});

test("refreshSocialStats exposes skipGemini", () => {
  assert.match(refresh, /skipGemini\?: boolean/);
  assert.match(refresh, /audit skipped \(skipGemini\)/);
});