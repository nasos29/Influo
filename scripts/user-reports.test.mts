import assert from "node:assert/strict";
import { test } from "node:test";
import { isUserReportEmailsEnabled } from "../lib/userReportFlags.ts";
import {
  USER_REPORT_REASON_KEYS,
  allUserReportReasons,
  isOpenUserReportStatus,
  parseUserReportSubmit,
  userReportReasonLabel,
} from "../lib/userReports.ts";

test("reason keys have el/en labels", () => {
  assert.equal(USER_REPORT_REASON_KEYS.length, 7);
  for (const key of USER_REPORT_REASON_KEYS) {
    assert.ok(userReportReasonLabel(key, "el").length > 3);
    assert.ok(userReportReasonLabel(key, "en").length > 3);
  }
  assert.equal(allUserReportReasons("el").length, 7);
});

test("comment required only for other", () => {
  const base = {
    target_type: "creator",
    target_id: "11111111-1111-4111-8111-111111111111",
    reason: "inappropriate",
    context: "profile",
  };
  assert.equal(parseUserReportSubmit(base).ok, true);
  assert.equal(
    parseUserReportSubmit({ ...base, reason: "other" }).ok,
    false
  );
  assert.equal(
    parseUserReportSubmit({ ...base, reason: "other", comment: "details" }).ok,
    true
  );
});

test("chat context requires conversation_id", () => {
  const base = {
    target_type: "creator",
    target_id: "11111111-1111-4111-8111-111111111111",
    reason: "harassment",
    context: "chat",
  };
  assert.equal(parseUserReportSubmit(base).ok, false);
  assert.equal(
    parseUserReportSubmit({
      ...base,
      conversation_id: "22222222-2222-4222-8222-222222222222",
    }).ok,
    true
  );
});

test("brand target may use brand_email without target_id", () => {
  const parsed = parseUserReportSubmit({
    target_type: "brand",
    brand_email: "brand@example.com",
    reason: "spam_fraud",
    context: "chat",
    conversation_id: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.target_id, "");
    assert.equal(parsed.value.brand_email, "brand@example.com");
  }
});

test("open report status helper", () => {
  assert.equal(isOpenUserReportStatus("new"), true);
  assert.equal(isOpenUserReportStatus("in_review"), true);
  assert.equal(isOpenUserReportStatus("closed"), false);
});

test("USER_REPORT_EMAILS_ENABLED off by default", () => {
  const prev = process.env.USER_REPORT_EMAILS_ENABLED;
  delete process.env.USER_REPORT_EMAILS_ENABLED;
  assert.equal(isUserReportEmailsEnabled(), false);
  process.env.USER_REPORT_EMAILS_ENABLED = "true";
  assert.equal(isUserReportEmailsEnabled(), true);
  if (prev === undefined) delete process.env.USER_REPORT_EMAILS_ENABLED;
  else process.env.USER_REPORT_EMAILS_ENABLED = prev;
});