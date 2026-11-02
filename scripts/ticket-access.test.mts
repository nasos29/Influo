import assert from "node:assert/strict";
import test from "node:test";
import {
  emailsMatch,
  ticketReadStatus,
  ticketStatusChange,
  userOwnsTicket,
} from "../lib/ticketAccessRules.ts";

test("ticket ownership follows influencer contact email and brand user email", () => {
  assert.equal(emailsMatch(" ND.6@hotmail.com ", "nd.6@hotmail.com"), true);
  assert.equal(
    userOwnsTicket(
      { user_type: "influencer", user_id: "inf-1", user_email: "other@example.com" },
      "owner@example.com",
      "owner@example.com"
    ),
    true
  );
  assert.equal(
    userOwnsTicket(
      { user_type: "influencer", user_id: "inf-1", user_email: "owner@example.com" },
      "owner@example.com",
      "someone-else@example.com"
    ),
    false
  );
  assert.equal(
    userOwnsTicket(
      { user_type: "brand", user_id: "brand-1", user_email: "brand@example.com" },
      "brand@example.com",
      null
    ),
    true
  );
  assert.equal(
    userOwnsTicket(
      { user_type: "brand", user_id: "brand-1", user_email: "brand@example.com" },
      "other@example.com",
      null
    ),
    false
  );
});

test("thread reads and status changes are 401, 403, or allowed", () => {
  assert.equal(ticketReadStatus({ signedIn: false, isAdmin: false, owns: false }), 401);
  assert.equal(ticketReadStatus({ signedIn: true, isAdmin: false, owns: false }), 403);
  assert.equal(ticketReadStatus({ signedIn: true, isAdmin: false, owns: true }), 200);
  assert.equal(ticketReadStatus({ signedIn: true, isAdmin: true, owns: false }), 200);

  assert.equal(ticketStatusChange({ signedIn: false, isAdmin: false, owns: true, action: "close" }), 401);
  assert.equal(ticketStatusChange({ signedIn: true, isAdmin: false, owns: true, action: "close" }), 200);
  assert.equal(ticketStatusChange({ signedIn: true, isAdmin: false, owns: true, action: "reopen" }), 403);
  assert.equal(ticketStatusChange({ signedIn: true, isAdmin: true, owns: false, action: "reopen" }), 200);
  assert.equal(ticketStatusChange({ signedIn: true, isAdmin: false, owns: false, action: "close" }), 403);
});
