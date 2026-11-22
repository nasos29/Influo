import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  isSkipGeminiRequest,
  shouldRunGeminiAudit,
} from "../lib/skipGeminiRequest.ts";

const route = fs.readFileSync("app/api/cron/social-refresh-batch/route.ts", "utf8");

test("isSkipGeminiRequest accepts truthy skip_gemini forms", () => {
  assert.equal(isSkipGeminiRequest({ skip_gemini: true }), true);
  assert.equal(isSkipGeminiRequest({ skip_gemini: "true" }), true);
  assert.equal(isSkipGeminiRequest({ skip_gemini: "1" }), true);
  assert.equal(isSkipGeminiRequest({ skip_gemini: 1 }), true);
});

test("isSkipGeminiRequest rejects falsy or missing skip_gemini", () => {
  assert.equal(isSkipGeminiRequest({}), false);
  assert.equal(isSkipGeminiRequest({ skip_gemini: false }), false);
  assert.equal(isSkipGeminiRequest({ skip_gemini: "false" }), false);
  assert.equal(isSkipGeminiRequest({ skip_gemini: 0 }), false);
  assert.equal(isSkipGeminiRequest({ skip_gemini: "0" }), false);
  assert.equal(isSkipGeminiRequest({ skip_gemini: undefined }), false);
});

test("shouldRunGeminiAudit", () => {
  assert.equal(
    shouldRunGeminiAudit({ skipGemini: true, didRefreshSocials: true }),
    false
  );
  assert.equal(
    shouldRunGeminiAudit({ skipGemini: false, didRefreshSocials: true }),
    true
  );
  assert.equal(
    shouldRunGeminiAudit({ skipGemini: false, didRefreshSocials: false }),
    false
  );
});

test("social-refresh-batch route uses pause guard and request skip_gemini helper", () => {
  assert.match(route, /isGeminiPaused\(\)/);
  assert.match(route, /isSkipGeminiRequest\(body\)/);
});