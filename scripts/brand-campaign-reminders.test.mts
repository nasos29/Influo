import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_NEXT_STEPS } from "../lib/emailNextSteps.ts";
import {
  BRAND_REMINDER_KINDS,
  DRAFT_FIRST_DAYS,
  DRAFT_SECOND_DAYS,
  NUDGE_MAX_STREAK,
  athensHour,
  brandOptedOutOfReminders,
  draftReminderDue,
  hasRecentReminderRateLimit,
  isBrandRemindersEnabled,
  isBrandRemindersLive,
  isBrandWeeklyNudgeZohoEnabled,
  isBrandWeeklyNudgeZohoLive,
  isWithinQuietSendWindow,
  noCampaignNudgeDue,
  resolveSendTo,
  unansweredNudgeStreak,
} from "../lib/brandCampaignReminders.ts";
import {
  brandReminderUnsubToken,
  parseBrandReminderUnsubToken,
  draftReminderMail,
  noCampaignNudgeMail,
} from "../lib/brandCampaignReminderMail.ts";
import {
  BRAND_WEEKLY_NUDGE_SUBJECT,
  brandWeeklyNudgeContentUrl,
  brandWeeklyNudgeEmailHtml,
} from "../lib/zohoBrandNudgeContent.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-15T12:00:00.000Z"); // ~14:00 Athens (EET)

test("feature flag and live default OFF", () => {
  assert.equal(isBrandRemindersEnabled({}), false);
  assert.equal(isBrandRemindersLive({}), false);
  assert.equal(isBrandRemindersEnabled({ BRAND_CAMPAIGN_REMINDERS_ENABLED: "1" }), true);
  assert.equal(isBrandRemindersLive({ BRAND_CAMPAIGN_REMINDERS_LIVE: "true" }), true);
});

test("Zoho weekly nudge flags default OFF; LIVE falls back to reminders LIVE", () => {
  assert.equal(isBrandWeeklyNudgeZohoEnabled({}), false);
  assert.equal(isBrandWeeklyNudgeZohoLive({}), false);
  assert.equal(isBrandWeeklyNudgeZohoEnabled({ BRAND_WEEKLY_NUDGE_ZOHO_ENABLED: "1" }), true);
  assert.equal(
    isBrandWeeklyNudgeZohoLive({ BRAND_CAMPAIGN_REMINDERS_LIVE: "1" }),
    true,
    "fallback to reminders LIVE"
  );
  assert.equal(
    isBrandWeeklyNudgeZohoLive({
      BRAND_CAMPAIGN_REMINDERS_LIVE: "1",
      BRAND_WEEKLY_NUDGE_ZOHO_LIVE: "0",
    }),
    false,
    "explicit ZOHO LIVE off wins"
  );
  assert.equal(
    isBrandWeeklyNudgeZohoLive({ BRAND_WEEKLY_NUDGE_ZOHO_LIVE: "yes" }),
    true
  );
});

test("Zoho weekly nudge content is Greek and public URL stable", () => {
  assert.match(BRAND_WEEKLY_NUDGE_SUBJECT, /καμπάνια/i);
  const html = brandWeeklyNudgeEmailHtml({ siteUrl: "https://influo.gr" });
  assert.match(html, /Δημιουργία καμπάνιας/);
  assert.match(html, /unsubscribe/i);
  assert.equal(
    brandWeeklyNudgeContentUrl("https://influo.gr"),
    "https://influo.gr/api/public/zoho-brand-nudge-content"
  );
});

test("non-live resolveSendTo always redirects to test inbox", () => {
  const r = resolveSendTo("brand@example.com", {
    BRAND_CAMPAIGN_REMINDERS_LIVE: "",
    BRAND_CAMPAIGN_REMINDERS_TEST_RECIPIENT: "nd.6@hotmail.com",
  });
  assert.equal(r.to, "nd.6@hotmail.com");
  assert.equal(r.redirected, true);
});

test("draft reminders: day 3 then day 10, max 2", () => {
  const created3 = new Date(NOW - DRAFT_FIRST_DAYS * DAY).toISOString();
  const created10 = new Date(NOW - DRAFT_SECOND_DAYS * DAY).toISOString();
  assert.equal(
    draftReminderDue({ status: "draft", createdAt: created3, sentKinds: [], nowMs: NOW }),
    BRAND_REMINDER_KINDS.draftDay3
  );
  assert.equal(
    draftReminderDue({
      status: "draft",
      createdAt: created3,
      sentKinds: [BRAND_REMINDER_KINDS.draftDay3],
      nowMs: NOW,
    }),
    null
  );
  assert.equal(
    draftReminderDue({ status: "draft", createdAt: created10, sentKinds: [], nowMs: NOW }),
    BRAND_REMINDER_KINDS.draftDay10
  );
  assert.equal(
    draftReminderDue({
      status: "draft",
      createdAt: created10,
      sentKinds: [BRAND_REMINDER_KINDS.draftDay3, BRAND_REMINDER_KINDS.draftDay10],
      nowMs: NOW,
    }),
    null
  );
  assert.equal(
    draftReminderDue({ status: "open", createdAt: created10, sentKinds: [], nowMs: NOW }),
    null
  );
});

test("global reminder rate limit 7 days", () => {
  assert.equal(hasRecentReminderRateLimit([], NOW), false);
  assert.equal(
    hasRecentReminderRateLimit(
      [{ kind: BRAND_REMINDER_KINDS.draftDay3, created_at: new Date(NOW - 2 * DAY).toISOString() }],
      NOW
    ),
    true
  );
  assert.equal(
    hasRecentReminderRateLimit(
      [{ kind: BRAND_REMINDER_KINDS.targetReached, created_at: new Date(NOW - 1 * DAY).toISOString() }],
      NOW
    ),
    false,
    "events do not consume reminder rate limit"
  );
});

test("no-campaign nudge: streak, gap, recent campaign skip", () => {
  assert.equal(
    noCampaignNudgeDue({
      hasOpenCampaign: true,
      lastCampaignCreatedAt: null,
      nudgeAts: [],
      nowMs: NOW,
    }),
    false
  );
  assert.equal(
    noCampaignNudgeDue({
      hasOpenCampaign: false,
      lastCampaignCreatedAt: new Date(NOW - 3 * DAY).toISOString(),
      nudgeAts: [],
      nowMs: NOW,
    }),
    false,
    "created campaign recently"
  );
  assert.equal(
    noCampaignNudgeDue({
      hasOpenCampaign: false,
      lastCampaignCreatedAt: new Date(NOW - 30 * DAY).toISOString(),
      nudgeAts: [],
      nowMs: NOW,
    }),
    true
  );
  const four = Array.from({ length: NUDGE_MAX_STREAK }, (_, i) =>
    new Date(NOW - (i + 2) * 8 * DAY).toISOString()
  );
  assert.equal(unansweredNudgeStreak(four, new Date(NOW - 100 * DAY).toISOString(), NOW), 4);
  assert.equal(
    noCampaignNudgeDue({
      hasOpenCampaign: false,
      lastCampaignCreatedAt: new Date(NOW - 100 * DAY).toISOString(),
      nudgeAts: four,
      nowMs: NOW,
    }),
    false,
    "stop after 4 unanswered"
  );
});

test("quiet window uses Europe/Athens", () => {
  // 2026-11-15 12:00 UTC = 14:00 Athens → inside
  assert.equal(isWithinQuietSendWindow(NOW), true);
  assert.ok(athensHour(NOW) >= 10 && athensHour(NOW) < 19);
  // 06:00 UTC = 08:00 Athens → outside
  assert.equal(isWithinQuietSendWindow(Date.parse("2026-11-15T06:00:00.000Z")), false);
});

test("opt-out helpers", () => {
  assert.equal(brandOptedOutOfReminders({ reminders_email_opted_out: true }), true);
  assert.equal(brandOptedOutOfReminders({ announcements_email_opted_out: true }), true);
  assert.equal(brandOptedOutOfReminders({}), false);
});

test("unsubscribe token round-trip", () => {
  process.env.BRAND_REMINDERS_UNSUB_SECRET = "test-secret-brand-reminders";
  const token = brandReminderUnsubToken("11111111-1111-1111-1111-111111111111", "Brand@Example.com");
  const parsed = parseBrandReminderUnsubToken(token);
  assert.deepEqual(parsed, {
    brandId: "11111111-1111-1111-1111-111111111111",
    email: "brand@example.com",
  });
  assert.equal(parseBrandReminderUnsubToken("not-a-token"), null);
  delete process.env.BRAND_REMINDERS_UNSUB_SECRET;
});

test("reminder mails are Greek and include unsubscribe for reminder kinds", () => {
  const draft = draftReminderMail({
    brandEmail: "a@b.com",
    brandName: "TestBrand",
    campaignTitle: "Καλοκαιρινή",
    brandId: "11111111-1111-1111-1111-111111111111",
    which: "day3",
  });
  assert.match(draft.subject, /καμπάνια/i);
  assert.match(draft.html, /Δημοσιεύστε/);
  assert.match(draft.html, /\/notifications\/preferences\?token=/);

  const nudge = noCampaignNudgeMail({
    brandEmail: "a@b.com",
    brandName: "TestBrand",
    brandId: "11111111-1111-1111-1111-111111111111",
  });
  assert.match(nudge.html, /Δημιουργία καμπάνιας/);
  assert.match(nudge.html, /\/notifications\/preferences\?token=/);
});

test("email next-steps catalog includes brand reminder keys", () => {
  for (const key of [
    "brand_reminder_draft_day3",
    "brand_reminder_draft_day10",
    "brand_reminder_no_campaign",
    "brand_reminder_target_reached",
    "brand_reminder_campaign_closed",
  ] as const) {
    const steps = EMAIL_NEXT_STEPS[key];
    assert.ok(steps.length >= 1 && steps.length <= 4);
    for (const s of steps) assert.ok(s.el.trim() && s.en.trim());
  }
});
