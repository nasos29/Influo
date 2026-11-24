import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateProfileAnalytics,
  isSocialOutboundProfileClick,
  proposalBudgetAmount,
  athensDayKeysInRange,
} from "../lib/adminInfluencerStats.ts";
import { athensDayStartIso } from "../lib/adminPlatformStats.ts";

test("isSocialOutboundProfileClick respects metadata.source", () => {
  assert.equal(isSocialOutboundProfileClick({ event_type: "profile_click", metadata: { source: "social_outbound" } }), true);
  assert.equal(isSocialOutboundProfileClick({ event_type: "profile_click", metadata: {} }), false);
  assert.equal(isSocialOutboundProfileClick({ event_type: "profile_view" }), false);
});

test("proposalBudgetAmount prefers counter_proposal_budget", () => {
  assert.equal(proposalBudgetAmount({ budget: "100", counter_proposal_budget: "250" }), 250);
  assert.equal(proposalBudgetAmount({ budget: "99" }), 99);
});

test("aggregateProfileAnalytics splits views, influo clicks, and outbound", () => {
  const rows = [
    { event_type: "profile_view", created_at: "2026-11-20T10:00:00.000Z", metadata: null },
    { event_type: "profile_click", created_at: "2026-11-20T11:00:00.000Z", metadata: {} },
    {
      event_type: "profile_click",
      created_at: "2026-11-20T12:00:00.000Z",
      metadata: { source: "social_outbound", platform: "Instagram" },
    },
  ];
  const agg = aggregateProfileAnalytics(rows, ["2026-11-20"]);
  assert.equal(agg.profileViews, 1);
  assert.equal(agg.profileClicksInfluo, 1);
  assert.equal(agg.socialOutboundClicks, 1);
  assert.equal(agg.socialOutboundByPlatform.instagram, 1);
  assert.equal(agg.daily[0].views, 1);
  assert.equal(agg.daily[0].clicks, 1);
});

test("athensDayKeysInRange spans inclusive Athens days", () => {
  const start = athensDayStartIso("2026-11-20");
  const end = athensDayStartIso("2026-11-23");
  const keys = athensDayKeysInRange(start, end);
  assert.deepEqual(keys, ["2026-11-20", "2026-11-21", "2026-11-22"]);
});