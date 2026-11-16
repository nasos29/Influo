import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  ESSENTIAL_NOTIF_KEYS,
  allowAnnouncementsEmail,
  allowInSiteAnnouncements,
  allowMatchesEmail,
  allowRemindersEmail,
  allowsMatchesEmailFromRow,
  isNotifCategory,
  normalizePreferences,
  preferencesFromLegacy,
} from "../lib/notificationPreferences.ts";
import {
  createNotifPrefsToken,
  parseNotifPrefsToken,
  brandReminderPrefsUnsubUrl,
  announcementsPrefsUnsubUrl,
} from "../lib/notificationUnsubToken.ts";
import { brandOptedOutOfReminders } from "../lib/brandCampaignReminders.ts";
import { brandReminderUnsubscribeUrl } from "../lib/brandCampaignReminderMail.ts";

test("defaults are all ON", () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
  assert.equal(allowMatchesEmail(null), true);
  assert.equal(allowRemindersEmail(undefined), true);
  assert.equal(allowAnnouncementsEmail({}), true);
});

test("legacy opted_out maps to preference false", () => {
  const prefs = preferencesFromLegacy({
    announcements_email_opted_out: true,
    reminders_email_opted_out: true,
  });
  assert.equal(prefs.announcements_email, false);
  assert.equal(prefs.reminders_email, false);
  assert.equal(prefs.matches_email, true);
  assert.equal(prefs.in_site, true);
});

test("prefs row wins over legacy columns", () => {
  const prefs = preferencesFromLegacy({
    announcements_email_opted_out: true,
    announcements_email: true,
    matches_email: false,
  });
  assert.equal(prefs.announcements_email, true);
  assert.equal(prefs.matches_email, false);
});

test("important bypass ignores announcements opt-out", () => {
  assert.equal(
    allowAnnouncementsEmail({ announcements_email: false }, { importantBypass: true }),
    true
  );
  assert.equal(allowAnnouncementsEmail({ announcements_email: false }), false);
});

test("in-site announcements always allowed", () => {
  assert.equal(allowInSiteAnnouncements(), true);
});

test("essential keys are listed and categories validated", () => {
  assert.ok(ESSENTIAL_NOTIF_KEYS.includes("new_message"));
  assert.ok(ESSENTIAL_NOTIF_KEYS.includes("new_proposal"));
  assert.equal(isNotifCategory("matches_email"), true);
  assert.equal(isNotifCategory("new_message"), false);
});

test("matches helper respects prefs and legacy", () => {
  assert.equal(allowsMatchesEmailFromRow({ matches_email: false }), false);
  assert.equal(allowsMatchesEmailFromRow({ announcements_email_opted_out: true }), false);
  assert.equal(allowsMatchesEmailFromRow({}), true);
});

test("brand reminder opt-out uses new or legacy fields", () => {
  assert.equal(brandOptedOutOfReminders({ reminders_email: false }), true);
  assert.equal(brandOptedOutOfReminders({ reminders_email: true }), false);
  assert.equal(brandOptedOutOfReminders({ reminders_email_opted_out: true }), true);
  assert.equal(brandOptedOutOfReminders({ announcements_email_opted_out: true }), true);
});

test("signed prefs token round-trips and rejects tampering", () => {
  const token = createNotifPrefsToken({
    kind: "brand",
    subjectId: "11111111-1111-4111-8111-111111111111",
    email: "Brand@Example.com",
    category: "reminders_email",
  });
  const parsed = parseNotifPrefsToken(token);
  assert.ok(parsed);
  assert.equal(parsed!.kind, "brand");
  assert.equal(parsed!.email, "brand@example.com");
  assert.equal(parsed!.category, "reminders_email");
  assert.equal(parseNotifPrefsToken(token.slice(0, -2) + "aa"), null);
});

test("unsubscribe URLs point at preferences page", () => {
  const url = brandReminderPrefsUnsubUrl("b1", "a@b.com");
  assert.match(url, /\/notifications\/preferences\?token=/);
  assert.match(announcementsPrefsUnsubUrl("influencer", "i1", "c@d.com"), /token=/);
  assert.match(brandReminderUnsubscribeUrl("b1", "a@b.com"), /\/notifications\/preferences/);
});
