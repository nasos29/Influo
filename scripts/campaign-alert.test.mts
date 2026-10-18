import assert from "node:assert/strict";
import test from "node:test";
import { campaignAlertTarget } from "../lib/campaignAlert.ts";

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
