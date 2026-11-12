import assert from "node:assert/strict";
import test from "node:test";
import {
  isOffPlatformTipMessage,
  looksLikeOffPlatformContact,
  offPlatformTipContent,
} from "../lib/offPlatformContact.ts";

test("flags Instagram contact prompts", () => {
  assert.equal(looksLikeOffPlatformContact("γράψε μου στο ινστα"), true);
  assert.equal(looksLikeOffPlatformContact("στείλε μου στο Instagram"), true);
  assert.equal(looksLikeOffPlatformContact("dm me on ig"), true);
  assert.equal(looksLikeOffPlatformContact("https://instagram.com/somebrand"), true);
  assert.equal(looksLikeOffPlatformContact("μιλαμε στο instagram"), true);
  assert.equal(looksLikeOffPlatformContact("ta leme sto insta"), true);
  assert.equal(looksLikeOffPlatformContact("θα τα πούμε στο ινστα"), true);
  assert.equal(looksLikeOffPlatformContact("γραψε μου στο instagrm"), true);
});

test("flags TikTok contact prompts", () => {
  assert.equal(looksLikeOffPlatformContact("μιλαμε στο tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("ta leme sto tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("γράψε μου στο τικτοκ"), true);
  assert.equal(looksLikeOffPlatformContact("dm me on tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("https://www.tiktok.com/@someuser"), true);
});

test("allows deliverable talk about Instagram / TikTok", () => {
  assert.equal(looksLikeOffPlatformContact("θα ανεβάσω story στο Instagram αύριο"), false);
  assert.equal(looksLikeOffPlatformContact("το reel θα δημοσιευτεί στο Instagram"), false);
  assert.equal(looksLikeOffPlatformContact("θα ανεβάσω το video στο TikTok"), false);
  assert.equal(looksLikeOffPlatformContact("καλημέρα, τι ώρα σας βολεύει;"), false);
});

test("tip message is recognized and not re-flagged", () => {
  const tip = offPlatformTipContent();
  assert.equal(isOffPlatformTipMessage(tip), true);
  assert.equal(looksLikeOffPlatformContact(tip), false);
});
