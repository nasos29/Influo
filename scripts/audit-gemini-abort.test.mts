import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_FALLBACK_MESSAGE,
  auditprAuditFieldAfterGeminiAttempt,
  clearGeminiSystemicPause,
  isAuditFallbackResult,
  isGeminiSystemicallyPaused,
  isSystemicGeminiError,
  markGeminiSystemicFailure,
} from "../lib/auditGemini.ts";

test("isSystemicGeminiError classification", () => {
  assert.equal(isSystemicGeminiError(new Error("Gemini request failed: 403 billing")), true);
  assert.equal(isSystemicGeminiError(new Error("401 Unauthorized")), true);
  assert.equal(isSystemicGeminiError(new Error("Gemini API key missing (GEMINI_API_KEY).")), true);
  assert.equal(isSystemicGeminiError(new Error("429 resource exhausted")), true);
  assert.equal(isSystemicGeminiError(new Error("Gemini request timeout after 90000ms")), false);
  assert.equal(isSystemicGeminiError(new Error("503 service unavailable")), false);
  assert.equal(isSystemicGeminiError(new Error("ECONNRESET")), false);
  assert.equal(isSystemicGeminiError(new Error("Gemini response parse failed: bad json")), false);
});

test("auditprAuditFieldAfterGeminiAttempt never returns fallback placeholder", () => {
  const fallback = {
    scoreBreakdown: [AUDIT_FALLBACK_MESSAGE],
    brandSafe: true,
    niche: "Creator",
    negatives: [],
    negatives_en: [],
  };
  assert.equal(isAuditFallbackResult(fallback), true);
  assert.equal(auditprAuditFieldAfterGeminiAttempt(fallback, "fp"), undefined);
});

test("successful strict result yields audit payload with fingerprint", () => {
  const ok = {
    scoreBreakdown: ["Real line"],
    brandSafe: true,
    niche: "Food",
    negatives: [],
    negatives_en: [],
  };
  const field = auditprAuditFieldAfterGeminiAttempt(ok, "abc123");
  assert.ok(field);
  assert.equal(field?.input_fingerprint, "abc123");
  assert.deepEqual(field?.scoreBreakdown, ["Real line"]);
});

test("systemic pause blocks further evaluation until cleared", () => {
  clearGeminiSystemicPause();
  assert.equal(isGeminiSystemicallyPaused(), false);
  markGeminiSystemicFailure("403 billing");
  assert.equal(isGeminiSystemicallyPaused(), true);
  clearGeminiSystemicPause();
  assert.equal(isGeminiSystemicallyPaused(), false);
});