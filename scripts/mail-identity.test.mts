import assert from "node:assert/strict";
import test from "node:test";

const {
  MAIL_NOREPLY,
  mailFromNoreply,
  mailFromSupport,
  mailReplyToSupport,
  mailSupportAddress,
} = await import("../lib/mailIdentity.ts");

test("defaults: noreply + support@influo.gr (Zoho)", () => {
  delete process.env.SUPPORT_EMAIL;
  delete process.env.ZOHO_SUPPORT_EMAIL;
  assert.equal(MAIL_NOREPLY, "noreply@influo.gr");
  assert.equal(mailSupportAddress(), "support@influo.gr");
  assert.equal(mailReplyToSupport(), "support@influo.gr");
  assert.equal(mailFromNoreply(), "Influo <noreply@influo.gr>");
  assert.equal(mailFromSupport(), "Influo Support <support@influo.gr>");
});

test("SUPPORT_EMAIL env overrides Zoho reply address", () => {
  process.env.SUPPORT_EMAIL = "desk@example.com";
  assert.equal(mailSupportAddress(), "desk@example.com");
  assert.equal(mailReplyToSupport(), "desk@example.com");
  assert.equal(mailFromSupport(), "Influo Support <desk@example.com>");
  delete process.env.SUPPORT_EMAIL;
});
