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
  assert.equal(looksLikeOffPlatformContact("μιλάμε στο ινσταγκραμ"), true);
  assert.equal(looksLikeOffPlatformContact("ΜΙΛΑΜΕ ΣΤΟ ΙΝΣΤΑ"), true);
  assert.equal(looksLikeOffPlatformContact("ta leme sto insta"), true);
  assert.equal(looksLikeOffPlatformContact("mila mou sto insta"), true);
  assert.equal(looksLikeOffPlatformContact("θα τα πούμε στο ινστα"), true);
  assert.equal(looksLikeOffPlatformContact("γραψε μου στο instagrm"), true);
});

test("flags TikTok contact prompts", () => {
  assert.equal(looksLikeOffPlatformContact("μιλαμε στο tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("ta leme sto tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("γράψε μου στο τικτοκ"), true);
  assert.equal(looksLikeOffPlatformContact("dm me on tiktok"), true);
  assert.equal(looksLikeOffPlatformContact("https://www.tiktok.com/@someuser"), true);
  assert.equal(
    looksLikeOffPlatformContact("https://www.tiktok.com/@creator/video/7123456789012345678"),
    false
  );
});

test("flags phone numbers and emails", () => {
  assert.equal(looksLikeOffPlatformContact("κάλεσε με στο 6912345678"), true);
  assert.equal(looksLikeOffPlatformContact("το email μου είναι brand@example.com"), true);
  assert.equal(looksLikeOffPlatformContact("+30 691 234 5678"), true);
});

test("allows deliverable talk about Instagram / TikTok", () => {
  assert.equal(looksLikeOffPlatformContact("θα ανεβάσω story στο Instagram αύριο"), false);
  assert.equal(looksLikeOffPlatformContact("το reel θα δημοσιευτεί στο Instagram"), false);
  assert.equal(looksLikeOffPlatformContact("θα ανεβάσω το video στο TikTok"), false);
  assert.equal(looksLikeOffPlatformContact("καλημέρα, τι ώρα σας βολεύει;"), false);
  assert.equal(looksLikeOffPlatformContact("ο προϋπολογισμός είναι 1500 ευρώ"), false);
});

test("flags email / mail / Drive / WeTransfer for file transfer", () => {
  assert.equal(
    looksLikeOffPlatformContact("στείλε μου το email σου να σου στείλω το βίντεο"),
    true
  );
  assert.equal(looksLikeOffPlatformContact("δώσε μου το mail σου"), true);
  assert.equal(looksLikeOffPlatformContact("πες μου το μέιλ σου για τα αρχεία"), true);
  assert.equal(
    looksLikeOffPlatformContact("send me your email so I can send the files"),
    true
  );
  assert.equal(
    looksLikeOffPlatformContact("give me your email so I can send the file"),
    true
  );
  assert.equal(looksLikeOffPlatformContact("θα σου το στείλω με wetransfer"), true);
});

test("in-app file talk stays allowed", () => {
  assert.equal(looksLikeOffPlatformContact("ανέβασα το βίντεο"), false);
  assert.equal(looksLikeOffPlatformContact("το reel δημοσιεύτηκε"), false);
  assert.equal(looksLikeOffPlatformContact("έστειλα το βίντεο στο chat"), false);
});

test("tip message is recognized and not re-flagged", () => {
  const tip = offPlatformTipContent();
  assert.equal(isOffPlatformTipMessage(tip), true);
  assert.equal(looksLikeOffPlatformContact(tip), false);
});
