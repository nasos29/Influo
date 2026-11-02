import assert from "node:assert/strict";
import test from "node:test";
import {
  USER_REPLY_SPLIT,
  helpDeskTicketUrl,
  isMissingRelation,
  legacyThread,
  reopenStatus,
  userHasRepliedSinceAdmin,
} from "../lib/supportThread.ts";

test("legacy thread keeps the first message, later user replies, and the admin reply in order", () => {
  const messages = legacyThread({
    id: "t1",
    user_id: "user-1",
    created_at: "2026-03-01T10:00:00.000Z",
    message: `Αρχικό${USER_REPLY_SPLIT}Δεύτερη απάντηση`,
    attachments: [{ url: "https://cdn.example/a.pdf", filename: "a.pdf" }],
    admin_reply: "Απάντηση admin",
    admin_reply_attachments: [{ url: "https://cdn.example/b.pdf", filename: "b.pdf" }],
    admin_replied_at: "2026-03-02T10:00:00.000Z",
  });
  assert.deepEqual(messages.map((message) => message.sender_role), ["user", "user", "admin"]);
  assert.equal(messages[0].body, "Αρχικό");
  assert.equal(messages[0].attachments[0]?.filename, "a.pdf");
  assert.equal(messages[1].body, "Δεύτερη απάντηση");
  assert.equal(messages[1].attachments.length, 0);
  assert.equal(messages[2].body, "Απάντηση admin");
  assert.equal(messages[2].created_at, "2026-03-02T10:00:00.000Z");
});

test("a missing messages table is detected and reopen follows the last speaker", () => {
  assert.equal(isMissingRelation({ code: "PGRST205", message: "Could not find the table" }), true);
  assert.equal(isMissingRelation({ code: "23505", message: "duplicate key" }), false);
  assert.equal(reopenStatus([{ sender_role: "user" }, { sender_role: "admin" }], true), "answered");
  assert.equal(reopenStatus([{ sender_role: "user" }, { sender_role: "admin" }, { sender_role: "user" }], true), "awaiting");
  assert.equal(reopenStatus([{ sender_role: "user" }], false), "open");
  assert.equal(userHasRepliedSinceAdmin({
    id: "t",
    message: `Γεια${USER_REPLY_SPLIT}Ξανά`,
    admin_reply: null,
  }), true);
  assert.equal(helpDeskTicketUrl("influo.gr", "abc"), "https://influo.gr/help-desk?ticket=abc");
});
