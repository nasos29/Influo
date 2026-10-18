import assert from "node:assert/strict";
import test from "node:test";
import { campaignAudience } from "../lib/campaignAudience.ts";

test("only a signed-out visitor is asked to log in", () => {
  assert.deepEqual(
    campaignAudience({ signedIn: false, influencerId: null, brandId: null, campaignBrandId: "brand-1" }),
    { kind: "anonymous" }
  );
});

test("the owning brand manages the campaign and does not see apply", () => {
  assert.deepEqual(
    campaignAudience({
      signedIn: true,
      influencerId: "inf-1",
      brandId: "brand-1",
      campaignBrandId: "brand-1",
    }),
    { kind: "brand", owns: true }
  );
});

test("another brand sees no apply or login call to action", () => {
  assert.deepEqual(
    campaignAudience({ signedIn: true, influencerId: null, brandId: "brand-2", campaignBrandId: "brand-1" }),
    { kind: "brand", owns: false }
  );
});

test("a signed-in influencer can apply", () => {
  assert.deepEqual(
    campaignAudience({ signedIn: true, influencerId: "inf-1", brandId: null, campaignBrandId: "brand-1" }),
    { kind: "influencer" }
  );
});
