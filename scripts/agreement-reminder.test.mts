import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_NEXT_STEPS } from "../lib/emailNextSteps.ts";
import {
  AGREEMENT_REMINDER_MAX_HOURS,
  AGREEMENT_REMINDER_MIN_HOURS,
  agreementReminderTarget,
} from "../lib/agreementReminder.ts";
import { BRAND_REVIEW_MARKER, CREATOR_TARGET_REVIEW_FILTER, isBrandTargetReview } from "../lib/brandReview.ts";

const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-13T09:05:00.000Z");
const ago = (hours: number) => new Date(NOW - hours * H).toISOString();

test("creator accepted → brand is reminded inside the 48–96h window", () => {
  const row = { status: "accepted", influencer_agreement_accepted: true, brand_agreement_accepted: false, influencer_agreement_accepted_at: ago(60) };
  assert.equal(agreementReminderTarget(row, NOW), "brand");
});

test("brand accepted → creator is reminded", () => {
  const row = { status: "completed", influencer_agreement_accepted: false, brand_agreement_accepted: true, brand_agreement_accepted_at: ago(72) };
  assert.equal(agreementReminderTarget(row, NOW), "creator");
});

test("window edges are inclusive at 48h and 96h, excluded just outside", () => {
  const base = { status: "accepted", influencer_agreement_accepted: true, brand_agreement_accepted: false };
  assert.equal(agreementReminderTarget({ ...base, influencer_agreement_accepted_at: ago(AGREEMENT_REMINDER_MIN_HOURS) }, NOW), "brand");
  assert.equal(agreementReminderTarget({ ...base, influencer_agreement_accepted_at: ago(AGREEMENT_REMINDER_MAX_HOURS) }, NOW), "brand");
  assert.equal(agreementReminderTarget({ ...base, influencer_agreement_accepted_at: ago(47.9) }, NOW), null);
  assert.equal(agreementReminderTarget({ ...base, influencer_agreement_accepted_at: ago(96.1) }, NOW), null);
  assert.equal(agreementReminderTarget({ ...base, influencer_agreement_accepted_at: ago(24 * 30) }, NOW), null, "old deals never mailed");
});

test("already reminded, both/none accepted, missing timestamp or wrong status → no reminder", () => {
  const ok = { status: "accepted", influencer_agreement_accepted: true, brand_agreement_accepted: false, influencer_agreement_accepted_at: ago(60) };
  assert.equal(agreementReminderTarget({ ...ok, agreement_reminder_sent_at: ago(1) }, NOW), null);
  assert.equal(agreementReminderTarget({ ...ok, brand_agreement_accepted: true }, NOW), null);
  assert.equal(agreementReminderTarget({ ...ok, influencer_agreement_accepted: false }, NOW), null);
  assert.equal(agreementReminderTarget({ ...ok, influencer_agreement_accepted_at: null }, NOW), null);
  assert.equal(agreementReminderTarget({ ...ok, status: "pending" }, NOW), null);
  assert.equal(agreementReminderTarget({ ...ok, status: "rejected" }, NOW), null);
});

test("agreement_reminder has a bilingual «Τι κάνω τώρα;» step list", () => {
  const steps = EMAIL_NEXT_STEPS.agreement_reminder;
  assert.ok(steps.length >= 1 && steps.length <= 4);
  for (const s of steps) assert.ok(s.el.trim() && s.en.trim());
});

test("brand-target review marker and creator-review filter", () => {
  assert.equal(isBrandTargetReview(BRAND_REVIEW_MARKER), true);
  assert.equal(isBrandTargetReview(null), false);
  assert.equal(isBrandTargetReview("Instagram post"), false);
  assert.equal(CREATOR_TARGET_REVIEW_FILTER, `project_type.is.null,project_type.neq.${BRAND_REVIEW_MARKER}`);
});
