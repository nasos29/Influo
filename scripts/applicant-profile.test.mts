import assert from "node:assert/strict";
import test from "node:test";
import { mergeApplicantProfile } from "../lib/applicantProfile.ts";
import { statsFromAccounts } from "../lib/platformStats.ts";

test("an array embed still yields the direct accounts used on suggestion cards", () => {
  const profile = mergeApplicantProfile(
    [{ display_name: "Δημήτρης", avatar_url: null }],
    {
      id: "abc",
      display_name: "Δημήτρης Γκότοβος",
      accounts: [{ platform: "TikTok", followers: "2.4k" }],
    }
  );
  assert.equal(profile?.display_name, "Δημήτρης Γκότοβος");
  assert.deepEqual(statsFromAccounts(profile?.accounts).map((row) => row.followers), ["2.4k"]);
});

test("a declared platform with a blank follower count stays visible on an applicant row", () => {
  const profile = mergeApplicantProfile(null, {
    display_name: "test",
    accounts: JSON.stringify([{ platform: "Instagram", followers: "" }]),
  });
  const declared = statsFromAccounts(profile?.accounts, { keepEmpty: true });
  assert.deepEqual(declared.map((row) => row.platform), ["instagram"]);
  assert.equal(statsFromAccounts(profile?.accounts).length, 0);
});
