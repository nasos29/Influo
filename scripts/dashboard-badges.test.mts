import assert from "node:assert/strict";
import test from "node:test";
import {
  badgeAfterOpen,
  brandApplicationSeenKey,
  brandProposalAlertIds,
  brandProposalSeenKey,
  companySeenKey,
  conversationSeenKey,
  countNewerThan,
  countUnseenIds,
  influencerCampaignSeenKey,
  influencerProposalAlertIds,
  influencerProposalSeenKey,
  latestIso,
  readIdList,
  readStamp,
  writeIdList,
  writeStamp,
  type SeenStore,
} from "../lib/dashboardBadges.ts";

function memoryStore(): SeenStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

test("opening conversations hides current threads and a later message counts again", () => {
  const store = memoryStore();
  const times = ["2026-10-18T10:00:00.000Z", "2026-10-18T12:00:00.000Z"];
  assert.equal(countNewerThan(times, null), 2);
  const openedAt = latestIso(times, "2026-10-18T09:00:00.000Z");
  writeStamp(store, conversationSeenKey("admin-1"), openedAt);
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-1"))), 0);
  assert.equal(
    countNewerThan([...times, "2026-10-18T12:05:00.000Z"], readStamp(store, conversationSeenKey("admin-1"))),
    1
  );
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-2"))), 2);
});

test("opening a tab hides the ids already on screen and a later id counts again", () => {
  const store = memoryStore();
  const pending = ["app-1", "app-2"];
  assert.equal(badgeAfterOpen(false, false, pending, []), 0);
  assert.equal(badgeAfterOpen(true, true, pending, []), 0);
  assert.equal(badgeAfterOpen(false, true, pending, []), 2);
  writeIdList(store, brandApplicationSeenKey("brand-user"), pending);
  const seen = readIdList(store, brandApplicationSeenKey("brand-user"));
  assert.equal(badgeAfterOpen(false, true, pending, seen), 0);
  assert.equal(badgeAfterOpen(false, true, [...pending, "app-3"], seen), 1);
  assert.equal(badgeAfterOpen(false, true, pending, readIdList(store, brandApplicationSeenKey("other-user"))), 2);
});

test("brand proposal alerts are counters and unsigned agreements", () => {
  const ids = brandProposalAlertIds([
    { id: 1, status: "pending", counter_proposal_status: "pending", counter_proposal_budget: 100 },
    { id: 2, status: "accepted", brand_agreement_accepted: false },
    { id: 3, status: "completed", brand_agreement_accepted: true },
    { id: 4, status: "rejected", counter_proposal_status: "pending", counter_proposal_budget: 0 },
  ]);
  assert.deepEqual(ids, ["counter:1", "agree:2"]);
  const store = memoryStore();
  writeIdList(store, brandProposalSeenKey("brand-user"), ids);
  assert.equal(badgeAfterOpen(false, true, ids, readIdList(store, brandProposalSeenKey("brand-user"))), 0);
  assert.equal(badgeAfterOpen(false, true, [...ids, "agree:9"], readIdList(store, brandProposalSeenKey("brand-user"))), 1);
});

test("influencer campaign and proposal alerts clear after the tab is opened", () => {
  const store = memoryStore();
  const campaigns = ["camp-1"];
  writeIdList(store, influencerCampaignSeenKey("inf-1"), campaigns);
  assert.equal(badgeAfterOpen(false, true, campaigns, readIdList(store, influencerCampaignSeenKey("inf-1"))), 0);
  assert.equal(
    badgeAfterOpen(false, true, [...campaigns, "camp-2"], readIdList(store, influencerCampaignSeenKey("inf-1"))),
    1
  );
  const offers = influencerProposalAlertIds([
    { id: 7, status: "pending" },
    { id: 8, status: "accepted" },
  ]);
  assert.deepEqual(offers, ["7"]);
  writeIdList(store, influencerProposalSeenKey("inf-1"), offers);
  assert.equal(badgeAfterOpen(true, true, offers, []), 0);
  assert.equal(badgeAfterOpen(false, true, offers, readIdList(store, influencerProposalSeenKey("inf-1"))), 0);
});

test("opening companies hides the unverified brands already on screen", () => {
  const store = memoryStore();
  const pending = ["brand-a", "brand-b"];
  assert.equal(countUnseenIds(pending, []), 2);
  writeIdList(store, companySeenKey("admin-1"), pending);
  assert.equal(countUnseenIds(pending, readIdList(store, companySeenKey("admin-1"))), 0);
  assert.equal(countUnseenIds([...pending, "brand-c"], readIdList(store, companySeenKey("admin-1"))), 1);
});
