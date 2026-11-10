import assert from "node:assert/strict";
import test from "node:test";
import {
  isZeroCreatorReach,
  oldestPendingAgeDays,
  pendingAppsSlaLabel,
  shouldSendPendingAppsReminder,
} from "../lib/campaignPendingApps.ts";
import {
  campaignCategoryContentUrl,
  campaignCategoryEmailHtml,
  campaignCategoryEmailSubject,
} from "../lib/zohoCampaignCategoryContent.ts";
import {
  deliverableReviewToCreator,
  deliverableSubmittedToBrand,
  pendingAppsReminderToBrand,
} from "../lib/campaignMail.ts";

test("Q1 zero-recipient alert skips test brands and fires when all channels are 0", () => {
  assert.equal(isZeroCreatorReach({ testBrand: true, inApp: 0, emailed: 0, categoryQueued: 0 }), false);
  assert.equal(isZeroCreatorReach({ testBrand: false, inApp: 0, emailed: 0, categoryQueued: 0 }), true);
  assert.equal(isZeroCreatorReach({ testBrand: false, inApp: 1, emailed: 0, categoryQueued: 0 }), false);
  assert.equal(isZeroCreatorReach({ testBrand: false, inApp: 0, emailed: 2, categoryQueued: 0 }), false);
  assert.equal(isZeroCreatorReach({ testBrand: false, inApp: 0, emailed: 0, categoryQueued: 5 }), false);
});

test("Q5 pending-apps SLA label is bilingual", () => {
  assert.equal(pendingAppsSlaLabel("el", 0, 0), null);
  assert.equal(pendingAppsSlaLabel("el", 17, 11), "17 αναπάντητες αιτήσεις · παλαιότερη 11 ημέρες");
  assert.equal(pendingAppsSlaLabel("en", 1, 1), "1 unanswered application · oldest 1 day");
  assert.equal(pendingAppsSlaLabel("en", 2, 5), "2 unanswered applications · oldest 5 days");
});

test("Q5 reminder cooldown and age gate", () => {
  const now = Date.parse("2026-11-10T12:00:00.000Z");
  assert.equal(oldestPendingAgeDays("2026-11-07T12:00:00.000Z", now), 3);
  assert.equal(
    shouldSendPendingAppsReminder({ pendingOlderThanAge: 2, lastSentAt: null, nowMs: now }),
    true
  );
  assert.equal(
    shouldSendPendingAppsReminder({
      pendingOlderThanAge: 2,
      lastSentAt: "2026-11-09T12:00:00.000Z",
      nowMs: now,
    }),
    false
  );
  assert.equal(
    shouldSendPendingAppsReminder({
      pendingOlderThanAge: 2,
      lastSentAt: "2026-11-07T12:00:00.000Z",
      nowMs: now,
    }),
    true
  );
  assert.equal(
    shouldSendPendingAppsReminder({ pendingOlderThanAge: 0, lastSentAt: null, nowMs: now }),
    false
  );
});

test("M3 Zoho campaign content helpers produce public HTML + subject", () => {
  const subject = campaignCategoryEmailSubject("Reels για Γενικά");
  assert.match(subject, /Νέα καμπάνια/);
  assert.match(subject, /Reels/);
  const url = campaignCategoryContentUrl("11111111-1111-4111-8111-111111111111", "https://www.influo.gr");
  assert.equal(
    url,
    "https://www.influo.gr/api/public/zoho-campaign-content?campaignId=11111111-1111-4111-8111-111111111111"
  );
  const html = campaignCategoryEmailHtml({
    title: "Test",
    brandName: "Brand",
    campaignId: "11111111-1111-4111-8111-111111111111",
    siteUrl: "https://www.influo.gr",
  });
  assert.match(html, /Test/);
  assert.match(html, /Brand/);
  assert.match(html, /campaigns\/11111111-1111-4111-8111-111111111111/);
  assert.match(html, /category/);
});

test("Q5/Q6 mail templates include EL + EN cues and stay Greek-primary", () => {
  const pending = pendingAppsReminderToBrand({
    brandEmail: "brand@example.com",
    brandName: "Άθος",
    campaignTitle: "Εστιατόριο",
    pendingCount: 17,
    oldestDays: 11,
  });
  assert.match(pending.subject, /Αναπάντητες/);
  assert.match(pending.html, /17/);
  assert.match(pending.html, /unanswered/i);

  const submitted = deliverableSubmittedToBrand({
    brandEmail: "brand@example.com",
    brandName: "Brand",
    campaignTitle: "Καμπάνια",
    influencerName: "Μαρία",
    deliverableUrl: "https://example.com/v",
  });
  assert.match(submitted.subject, /παράδοση/i);
  assert.match(submitted.html, /submitted a deliverable/i);

  const approved = deliverableReviewToCreator({
    influencerName: "Μαρία",
    brandName: "Brand",
    campaignTitle: "Καμπάνια",
    status: "approved",
  });
  assert.match(approved.subject, /εγκρίθηκε/i);
  assert.match(approved.html, /approved/i);

  const changes = deliverableReviewToCreator({
    influencerName: "Μαρία",
    brandName: "Brand",
    campaignTitle: "Καμπάνια",
    status: "changes_requested",
    reviewNote: "Πιο κοντινά shots",
  });
  assert.match(changes.subject, /αλλαγές/i);
  assert.match(changes.html, /requested changes/i);
  assert.match(changes.html, /Πιο κοντινά/);
});

test("M4 force-include set semantics: budget-skipped ids are distinct from skippedStrong", () => {
  const strong = new Set(["a", "b", "c"]);
  const forceInclude = new Set(["b"]);
  const includeStrong = false;
  let skippedStrong = 0;
  const tier = new Set<string>();
  for (const id of ["a", "b", "c", "d"]) {
    if (strong.has(id) && !includeStrong && !forceInclude.has(id)) skippedStrong += 1;
    else tier.add(id);
  }
  assert.equal(skippedStrong, 2); // a, c
  assert.deepEqual([...tier].sort(), ["b", "d"]);
});
