import assert from "node:assert/strict";
import test from "node:test";
import {
  DELIVERABLE_TIP_CTA_EL,
  DELIVERABLE_TIP_EL,
  deliverableTipContent,
  deliverableTipHref,
  extractPublishableDeliverableUrl,
  isDeliverableTipMessage,
  looksLikeDeliverableLink,
  parseDeliverableTipPayload,
} from "../lib/deliverableChatTip.ts";
import { looksLikeOffPlatformContact } from "../lib/offPlatformContact.ts";

test("flags WeTransfer / Drive / Dropbox links", () => {
  assert.equal(looksLikeDeliverableLink("να το link https://we.tl/t-abc123"), true);
  assert.equal(looksLikeDeliverableLink("https://wetransfer.com/downloads/xyz"), true);
  assert.equal(looksLikeDeliverableLink("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(looksLikeDeliverableLink("https://www.dropbox.com/s/abc/file.mp4"), true);
});

test("flags Instagram reel/post and TikTok video", () => {
  assert.equal(looksLikeDeliverableLink("https://www.instagram.com/reel/ABC123xyz/"), true);
  assert.equal(looksLikeDeliverableLink("https://instagram.com/p/ABC123/"), true);
  assert.equal(
    looksLikeDeliverableLink("https://www.tiktok.com/@creator/video/7123456789012345678"),
    true
  );
});

test("does not flag unrelated chat", () => {
  assert.equal(looksLikeDeliverableLink("καλημέρα, τι ώρα σας βολεύει;"), false);
  assert.equal(looksLikeDeliverableLink("https://instagram.com/somebrand"), false);
  assert.equal(looksLikeDeliverableLink("https://www.tiktok.com/@someuser"), false);
});

test("TikTok video is deliverable tip, not off-platform tip", () => {
  const video = "https://www.tiktok.com/@creator/video/7123456789012345678";
  assert.equal(looksLikeDeliverableLink(video), true);
  assert.equal(looksLikeOffPlatformContact(video), false);
});

test("extracts publishable URL for prefill", () => {
  assert.match(
    extractPublishableDeliverableUrl("δες https://instagram.com/reel/AbCdEfGhIj/") || "",
    /instagram\.com\/reel\/AbCdEfGhIj/
  );
  assert.equal(extractPublishableDeliverableUrl("https://we.tl/t-abc"), null);
});

test("tip payload round-trips and builds deep links", () => {
  const content = deliverableTipContent({
    kind: "campaign",
    id: "app-1",
    prefill: "https://instagram.com/reel/xyz/",
  });
  assert.equal(isDeliverableTipMessage(content), true);
  assert.equal(looksLikeDeliverableLink(content), false);
  const payload = parseDeliverableTipPayload(content);
  assert.equal(payload.kind, "campaign");
  assert.equal(payload.id, "app-1");
  const href = deliverableTipHref(payload, "influencer");
  assert.match(href, /\/dashboard\?/);
  assert.match(href, /tab=campaigns/);
  assert.match(href, /application=app-1/);
  assert.match(href, /focus=deliverable/);
  assert.match(deliverableTipHref(payload, "brand"), /\/brand\/dashboard\?/);
});

test("exact Greek tip + CTA strings are present", () => {
  assert.match(DELIVERABLE_TIP_EL, /Παραδοτέο/);
  assert.match(DELIVERABLE_TIP_EL, /Πρόσφατες συνεργασίες/);
  assert.equal(DELIVERABLE_TIP_CTA_EL, "Ανέβασέ το ως παραδοτέο");
});
