import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { athensCalendarDaysElapsed } from "../lib/athensCalendar.ts";
import {
  hasSubmittedDeliverable,
  isAutomaticWarningEligible,
  isAutocancelDue,
  passesSinceCutoff,
  canAdminRestoreDeal,
} from "../lib/deliverableAutocancelEligibility.ts";
import { aggregatePastBrands, includeRowInPastBrands } from "../lib/pastBrands.ts";
import {
  DELIVERABLE_AUTOCANCEL_REASON,
  deliverableAutocancelSinceMs,
  isDeliverableAutocancelEmailsEnabled,
  isDeliverableAutocancelEnabled,
} from "../lib/deliveryFlags.ts";
import { canCancelDeal } from "../lib/dealCancelEligibility.ts";
import { canCancelCampaignDeal } from "../lib/campaignDealCancelEligibility.ts";

test("flag default off", () => {
  assert.equal(isDeliverableAutocancelEnabled({}), false);
  assert.equal(isDeliverableAutocancelEnabled({ DELIVERABLE_AUTOCANCEL_ENABLED: "0" }), false);
  assert.equal(isDeliverableAutocancelEnabled({ DELIVERABLE_AUTOCANCEL_ENABLED: "1" }), true);
  assert.equal(deliverableAutocancelSinceMs({}), null);
});

test("autocancel emails default on when feature enabled", () => {
  const on = { DELIVERABLE_AUTOCANCEL_ENABLED: "1" };
  assert.equal(isDeliverableAutocancelEmailsEnabled(on), true);
  assert.equal(isDeliverableAutocancelEmailsEnabled({ ...on, DELIVERABLE_AUTOCANCEL_EMAILS_ENABLED: "" }), true);
  assert.equal(
    isDeliverableAutocancelEmailsEnabled({ ...on, DELIVERABLE_AUTOCANCEL_EMAILS_ENABLED: "0" }),
    false
  );
  assert.equal(
    isDeliverableAutocancelEmailsEnabled({ ...on, DELIVERABLE_AUTOCANCEL_EMAILS_ENABLED: "false" }),
    false
  );
  assert.equal(isDeliverableAutocancelEmailsEnabled({}), false);
});

test("since-cutoff skips old acceptances for automatic warning", () => {
  const since = "2026-06-01T00:00:00Z";
  const env = { DELIVERABLE_AUTOCANCEL_SINCE: since };
  const nowMs = new Date("2026-06-20T00:00:00Z").getTime();
  const row = {
    source: "proposal" as const,
    id: "1",
    influencer_id: "inf",
    brand_name: "Brand",
    status: "completed",
    agreement_accepted_at: "2026-01-01T00:00:00Z",
    showcase_admin_hidden: false,
  };
  assert.equal(passesSinceCutoff(row, env), false);
  assert.equal(
    isAutomaticWarningEligible(row, nowMs, deliverableAutocancelSinceMs(env)),
    false
  );
  const fresh = { ...row, agreement_accepted_at: "2026-06-05T00:00:00Z" };
  assert.equal(passesSinceCutoff(fresh, env), true);
  assert.equal(
    isAutomaticWarningEligible(fresh, nowMs, deliverableAutocancelSinceMs(env)),
    true
  );
});

test("manual warning stamp makes row eligible for cancel 3 Athens days later", () => {
  const warned = "2026-03-01T10:00:00Z";
  const row = {
    source: "proposal" as const,
    id: "1",
    influencer_id: "inf",
    brand_name: "B",
    status: "completed",
    deliverable_warning_sent_at: warned,
    showcase_admin_hidden: false,
  };
  assert.equal(isAutocancelDue(row, new Date("2026-03-03T12:00:00Z").getTime()), false);
  assert.equal(isAutocancelDue(row, new Date("2026-03-04T12:00:00Z").getTime()), true);
});

test("submitted deliverable and hidden showcase skipped", () => {
  const base = {
    source: "proposal" as const,
    id: "1",
    influencer_id: "inf",
    brand_name: "B",
    status: "completed",
    agreement_accepted_at: "2026-06-10T00:00:00Z",
    showcase_admin_hidden: false,
  };
  assert.equal(hasSubmittedDeliverable({ ...base, published_post_url: "https://instagram.com/p/x" }), true);
  assert.equal(isAutomaticWarningEligible({ ...base, showcase_admin_hidden: true }, Date.now(), 0), false);
});

test("auto-cancel blocks creator upload and self-cancel", () => {
  const gate = {
    status: "cancelled",
    auto_cancelled_at: "2026-01-01T00:00:00Z",
    cancelled_by: "system",
  };
  assert.equal(canCancelDeal(gate), false);
  assert.equal(canCancelCampaignDeal({ status: "cancelled", auto_cancelled_at: gate.auto_cancelled_at }), false);
});

test("admin restore eligibility and pastBrands hide until completed again", () => {
  assert.equal(
    canAdminRestoreDeal({
      status: "cancelled",
      source: "proposal",
      auto_cancelled_at: "2026-01-01T00:00:00Z",
    }),
    true
  );
  const brands = aggregatePastBrands([
    { influencer_id: "a", brand_name: "X", status: "cancelled" },
    { influencer_id: "a", brand_name: "Y", status: "completed" },
  ]);
  assert.deepEqual(brands.get("a"), ["Y"]);

  assert.equal(
    includeRowInPastBrands({
      influencer_id: "a",
      brand_name: "Restored",
      status: "completed",
      restored_at: "2026-03-01T00:00:00Z",
    }),
    false
  );
  assert.equal(
    includeRowInPastBrands({
      influencer_id: "a",
      brand_name: "RestoredDone",
      status: "completed",
      restored_at: "2026-03-01T00:00:00Z",
      delivery_confirmed_at: "2026-03-05T00:00:00Z",
    }),
    true
  );
  assert.equal(
    includeRowInPastBrands({
      influencer_id: "a",
      brand_name: "Theodora",
      status: "completed",
    }),
    true
  );
  const restoredHidden = aggregatePastBrands([
    {
      influencer_id: "b",
      brand_name: "Hidden",
      status: "completed",
      restored_at: "2026-01-01T00:00:00Z",
    },
    { influencer_id: "b", brand_name: "Visible", status: "completed" },
  ]);
  assert.deepEqual(restoredHidden.get("b"), ["Visible"]);
});

test("Athens 3-calendar-day rule", () => {
  const warned = "2026-01-10T08:00:00Z"; // Athens civil day 2026-01-10
  assert.equal(athensCalendarDaysElapsed(warned, 3, new Date("2026-01-12T20:00:00Z").getTime()), false);
  assert.equal(athensCalendarDaysElapsed(warned, 3, new Date("2026-01-13T08:00:00Z").getTime()), true);
});

test("email copy includes self-cancel CTA and omits grace/refund language", () => {
  const src = readFileSync(new URL("../lib/deliveryMail.ts", import.meta.url), "utf8");
  const warning = src.slice(src.indexOf("mailDeliverableWarningCreator"), src.indexOf("mailDeliverableAutocancelNotice"));
  assert.match(warning, /Ακύρωση συμφωνίας/);
  assert.match(warning, /focus=cancel|cancelUrl/);
  assert.doesNotMatch(warning, /7.?ημέρ|grace|επιστροφή|refund/i);
  assert.match(warning, /3 ημέρες/);
  assert.equal(DELIVERABLE_AUTOCANCEL_REASON, "Δεν υποβλήθηκε παραδοτέο");
});

test("paired sibling helper brand key", async () => {
  const { normalizeBrandKey, pairKey } = await import("../lib/deliverableAutocancelEligibility.ts");
  assert.equal(normalizeBrandKey("  Foo  Bar "), "foo bar");
  assert.equal(pairKey("uuid", "Foo Bar"), "uuid::foo bar");
});

test("focus=cancel deep links do not fall back when proposalId is set", () => {
  const dash = readFileSync(new URL("../components/DashboardContent.tsx", import.meta.url), "utf8");
  const cancelBlock = dash.slice(dash.indexOf("focus') !== 'cancel'"), dash.indexOf("cancelFocusDone.current = true"));
  assert.doesNotMatch(
    cancelBlock,
    /proposalId\s*&&\s*proposals\.find[\s\S]*\|\|\s*proposals\.find/
  );
  const panel = readFileSync(new URL("../components/InfluencerCampaignsPanel.tsx", import.meta.url), "utf8");
  const panelCancel = panel.slice(panel.indexOf('focus") !== "cancel"'), panel.indexOf("setCancelApplicationId"));
  assert.doesNotMatch(panelCancel, /appId\s*&&\s*mine\.find[\s\S]*\|\|\s*mine\.find/);
  const panelDel = panel.slice(panel.indexOf('focus") !== "deliverable"'), panel.indexOf("setHighlightDeliverableId"));
  assert.doesNotMatch(panelDel, /appId\s*&&\s*mine\.find[\s\S]*\|\|\s*mine\.find/);
});