import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignAlertTarget,
  campaignIsNationwide,
  meetsFollowerMinimum,
  outreachBudgetLeft,
  rankCampaignAlerts,
  samePlace,
  unseenAlerts,
} from "../lib/campaignAlert.ts";

const id = "11111111-1111-4111-8111-111111111111";

test("an available creator in the same category is notified in app", () => {
  assert.deepEqual(
    campaignAlertTarget(
      { id, approved: true, availability_status: "available", category: "Fashion & Style" },
      "Fashion & Style"
    ),
    { id, authUserId: id }
  );
});

test("unavailable and unapproved creators are excluded", () => {
  assert.equal(
    campaignAlertTarget(
      { id, approved: true, availability_status: "unavailable", category: "Fashion & Style" },
      "Fashion & Style"
    ),
    null
  );
  assert.equal(
    campaignAlertTarget(
      { id, approved: false, availability_status: "available", category: "Fashion & Style" },
      "Fashion & Style"
    ),
    null
  );
});

test("a different category is not a match", () => {
  assert.equal(
    campaignAlertTarget(
      { id, approved: true, availability_status: null, category: "Food & Drink" },
      "Fashion & Style"
    ),
    null
  );
});

function creator(id: string, location: string, followers: { platform: string; followers: string }[]) {
  return {
    id,
    approved: true,
    availability_status: "available" as const,
    category: "Food & Drink",
    location,
    accounts: followers,
  };
}

const athens = {
  category: "Food & Drink",
  location: "Athens",
  minFollowers: 5000,
  platforms: ["instagram", "tiktok"],
};

test("Athens, Attica, and Greek spellings are the same region", () => {
  assert.equal(samePlace("Athens", "Αθήνα"), true);
  assert.equal(samePlace("Athens", "Αθηνα"), true);
  assert.equal(samePlace("Αττική", "Athens, Greece"), true);
  assert.equal(samePlace("Attica", "Αθήνα"), true);
  assert.equal(samePlace("Athens", "Θεσσαλονίκη"), false);
  assert.equal(samePlace("Πάτρα", "Patras"), true);
});

test("a campaign with no city is nationwide", () => {
  assert.equal(campaignIsNationwide(""), true);
  assert.equal(campaignIsNationwide("Ελλάδα"), true);
  assert.equal(campaignIsNationwide("Athens, Greece"), false);
});

test("follower minimum uses the best count on the campaign platforms", () => {
  const accounts = [
    { platform: "Instagram", followers: "6000" },
    { platform: "TikTok", followers: "1000" },
  ];
  assert.equal(meetsFollowerMinimum(accounts, ["instagram", "tiktok"], 5000), true);
  assert.equal(meetsFollowerMinimum(accounts, ["tiktok"], 5000), false);
  assert.equal(meetsFollowerMinimum(accounts, ["instagram", "tiktok"], null), true);
});

test("every category match is kept, ordered by region then followers", () => {
  const ids = Array.from({ length: 30 }, (_, index) => {
    const n = (index + 1).toString(16).padStart(12, "0");
    return `11111111-1111-4111-8111-${n}`;
  });
  const rows = ids.map((id, index) => {
    if (index === 3) return creator(id, "Αθήνα", [{ platform: "instagram", followers: "8000" }]);
    if (index === 4) return creator(id, "Athens", [{ platform: "tiktok", followers: "200" }]);
    if (index === 5) return creator(id, "Θεσσαλονίκη", [{ platform: "instagram", followers: "9000" }]);
    if (index === 6) return creator(id, "Πάτρα", [{ platform: "instagram", followers: "100" }]);
    return creator(id, "Λάρισα", [{ platform: "instagram", followers: "100" }]);
  });
  rows.push(creator(ids[0], "Αθήνα", [{ platform: "instagram", followers: "100" }]));
  rows[1] = { ...rows[1], availability_status: "unavailable" };
  const ranked = rankCampaignAlerts(rows, athens);
  assert.equal(ranked.length, 29);
  assert.equal(ranked[0].id, ids[3]);
  assert.equal(ranked[0].strong, true);
  const athensLow = ranked.filter((row) => row.id === ids[0] || row.id === ids[4]);
  assert.deepEqual(athensLow.map((row) => row.strong), [false, false]);
  assert.ok(ranked.findIndex((row) => row.id === ids[5]) > ranked.findIndex((row) => row.id === ids[4]));
  assert.ok(ranked.findIndex((row) => row.id === ids[6]) > ranked.findIndex((row) => row.id === ids[5]));
  assert.equal(ranked.find((row) => row.id === ids[5])?.strong, false);
  assert.equal(ranked.some((row) => row.id === ids[1]), false);
  const fresh = unseenAlerts(ranked, [ranked[0].authUserId]);
  assert.equal(fresh.some((row) => row.authUserId === ranked[0].authUserId), false);
  assert.equal(fresh.length, ranked.length - 1);
});

test("outreach stops when the function time budget is gone", () => {
  const started = 1_000;
  assert.equal(outreachBudgetLeft(started, started + 1_000), true);
  assert.equal(outreachBudgetLeft(started, started + 45_000), false);
});

test("auth_user_id is the in-app target when it differs from the profile id", () => {
  const authUserId = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(
    campaignAlertTarget(
      { id, auth_user_id: authUserId, approved: true, category: "Fashion & Style" },
      "Fashion & Style"
    ),
    { id, authUserId }
  );
});
