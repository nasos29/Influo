import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdminDailyDigestHtml } from "../lib/adminDailyDigest.ts";
import { brandCampaignGroupKey } from "../lib/brandApplicationDigest.ts";
import {
  BRAND_APPLICATION_DIGEST_HOURS,
  isAdminDailyDigestEnabled,
  isBrandApplicationDigestEnabled,
} from "../lib/emailDigestFlags.ts";

test("brand application digest hours is 3", () => {
  assert.equal(BRAND_APPLICATION_DIGEST_HOURS, 3);
});

test("brand campaign group key", () => {
  assert.equal(brandCampaignGroupKey("abc"), "campaign:abc");
});

test("admin daily digest html groups kinds", () => {
  const mail = buildAdminDailyDigestHtml([
    {
      payload: {
        kind: "campaign_application",
        influencerName: "A",
        brandName: "B",
        campaignTitle: "C",
        at: "2026-11-17T08:00:00.000Z",
      },
    },
    {
      payload: {
        kind: "signup_creator",
        name: "Neo",
        email: "neo@example.com",
        at: "2026-11-17T08:10:00.000Z",
      },
    },
    {
      payload: {
        kind: "event_confirm_pending",
        brandName: "Cafe",
        creatorName: "Maria",
        source: "proposal",
        id: "42",
        at: "2026-11-17T08:20:00.000Z",
      },
    },
  ]);
  assert.match(mail.subject, /digest/i);
  assert.match(mail.html, /Αιτήσεις καμπάνιας/);
  assert.match(mail.html, /Νέοι creators/);
  assert.match(mail.html, /Neo/);
  assert.match(mail.html, /Εκκρεμεί επιβεβαίωση \(event\)/);
  assert.match(mail.html, /Cafe/);
  assert.match(mail.html, /ολοκλήρωσε χειροκίνητα/);
});

test("digest flags off by default", () => {
  const prevB = process.env.BRAND_APPLICATION_DIGEST_ENABLED;
  const prevA = process.env.ADMIN_DAILY_DIGEST_ENABLED;
  delete process.env.BRAND_APPLICATION_DIGEST_ENABLED;
  delete process.env.ADMIN_DAILY_DIGEST_ENABLED;
  assert.equal(isBrandApplicationDigestEnabled(), false);
  assert.equal(isAdminDailyDigestEnabled(), false);
  if (prevB === undefined) delete process.env.BRAND_APPLICATION_DIGEST_ENABLED;
  else process.env.BRAND_APPLICATION_DIGEST_ENABLED = prevB;
  if (prevA === undefined) delete process.env.ADMIN_DAILY_DIGEST_ENABLED;
  else process.env.ADMIN_DAILY_DIGEST_ENABLED = prevA;
});
