// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/gate-avatars.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { inviteOpenResult, pickGateAvatarUrls, showCampaignInviteButton } from "../lib/gateAvatars.ts";

test("picks eight real avatar urls and skips blanks", () => {
  const rows = [
    { avatar_url: "" },
    { avatar_url: null },
    { avatar_url: "not-a-url" },
    { avatar_url: "https://cdn.example/placeholder.png" },
    ...Array.from({ length: 10 }, (_, i) => ({ avatar_url: `https://cdn.example/a${i}.jpg` })),
    { avatar_url: "https://cdn.example/a0.jpg" },
  ];
  const urls = pickGateAvatarUrls(rows);
  assert.equal(urls.length, 8);
  assert.equal(urls[0], "https://cdn.example/a0.jpg");
  assert.equal(new Set(urls).size, 8);
});

test("invite button is for visitors, brands, and admins", () => {
  const base = { sessionChecked: true, hasSession: false, isBrand: false, isAdmin: false };
  assert.equal(showCampaignInviteButton(base), true);
  assert.equal(showCampaignInviteButton({ ...base, hasSession: true, isBrand: true }), true);
  assert.equal(showCampaignInviteButton({ ...base, hasSession: true, isAdmin: true }), true);
  assert.equal(showCampaignInviteButton({ ...base, hasSession: true }), false);
  assert.equal(showCampaignInviteButton({ ...base, sessionChecked: false }), false);
});

test("admin without a brand does not get the login popup", () => {
  assert.equal(inviteOpenResult({ isBrand: false, hasBrandId: false, isAdmin: false }), "login");
  assert.equal(inviteOpenResult({ isBrand: true, hasBrandId: true, isAdmin: false }), "campaigns");
  assert.equal(inviteOpenResult({ isBrand: false, hasBrandId: false, isAdmin: true }), "admin-notice");
  assert.equal(inviteOpenResult({ isBrand: true, hasBrandId: true, isAdmin: true }), "campaigns");
});
