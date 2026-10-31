import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATOR_PROFILE_EDIT_PATH,
  countMatchedPushUsers,
  filterInfluencerEmailSubscriptions,
  influencerSubscriptionOrFilter,
  parseInfluencerPushBroadcast,
} from "../lib/influencerPushBroadcast.ts";

test("influencer push broadcast matches emails case-insensitively and defaults to the creator profile editor", () => {
  const parsed = parseInfluencerPushBroadcast({
    emails: [" Creator@Influo.gr ", "creator@influo.gr", "other_user@influo.gr"],
    title: "  Ενημέρωση  ",
    body: "  Συμπλήρωσε το προφίλ σου  ",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.emails, ["creator@influo.gr", "other_user@influo.gr"]);
  assert.equal(parsed.title, "Ενημέρωση");
  assert.equal(parsed.body, "Συμπλήρωσε το προφίλ σου");
  assert.equal(parsed.url, "/dashboard?tab=profile");
  assert.equal(parsed.url, CREATOR_PROFILE_EDIT_PATH);
  assert.equal(
    influencerSubscriptionOrFilter(parsed.emails),
    "user_identifier.ilike.creator@influo.gr,user_identifier.ilike.other_user@influo.gr"
  );

  const custom = parseInfluencerPushBroadcast({
    emails: ["a@influo.gr"],
    title: "t",
    body: "b",
    url: "  /dashboard?tab=tools  ",
  });
  assert.equal(custom.ok, true);
  if (!custom.ok) return;
  assert.equal(custom.url, "/dashboard?tab=tools");

  const matched = filterInfluencerEmailSubscriptions(
    [
      { user_type: "influencer", user_identifier: "Creator@Influo.gr", endpoint: "a" },
      { user_type: "influencer", user_identifier: "CREATOR@INFLUO.GR", endpoint: "b" },
      { user_type: "influencer", user_identifier: "otherXuser@influo.gr", endpoint: "wild" },
      { user_type: "influencer", user_identifier: "Other_User@Influo.gr", endpoint: "c" },
      { user_type: "brand", user_identifier: "creator@influo.gr", endpoint: "brand" },
      { user_type: "influencer", user_identifier: "nope@influo.gr", endpoint: "d" },
    ],
    parsed.emails
  );
  assert.deepEqual(
    matched.map((row) => row.endpoint),
    ["a", "b", "c"]
  );
  assert.equal(countMatchedPushUsers(matched), 2);

  const exactly50 = parseInfluencerPushBroadcast({
    emails: Array.from({ length: 50 }, (_, i) => `user${i}@influo.gr`),
    title: "t",
    body: "b",
  });
  assert.equal(exactly50.ok, true);

  const tooMany = parseInfluencerPushBroadcast({
    emails: Array.from({ length: 51 }, (_, i) => `user${i}@influo.gr`),
    title: "t",
    body: "b",
  });
  assert.equal(tooMany.ok, false);
  if (tooMany.ok) return;
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.error, /50/);
});
