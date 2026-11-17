import assert from "node:assert/strict";
import { digestsForConversation, type SummaryConversation, type SummaryMessage } from "../lib/messageSummary.ts";

const now = new Date("2026-11-17T12:00:00.000Z");

function msg(
  partial: Partial<SummaryMessage> & Pick<SummaryMessage, "id" | "sender_type" | "content">
): SummaryMessage {
  return {
    conversation_id: "c1",
    created_at: "2026-11-17T11:00:00.000Z",
    read: false,
    email_sent: false,
    ...partial,
  };
}

{
  const conversation: SummaryConversation = {
    id: "c1",
    influencer_id: "inf-1",
    influencer_name: "Creator",
    influencer_email: "c@example.com",
    brand_email: null,
    brand_name: "Θανάσης - Influo.gr",
    last_message_at: "2026-11-17T11:00:00.000Z",
    conversation_kind: "admin",
  };
  const messages = [
    msg({ id: "1", sender_type: "admin", content: "Hello from admin" }),
    msg({ id: "2", sender_type: "influencer", content: "Reply" }),
  ];
  const digests = digestsForConversation(conversation, messages, {
    now,
    quietMinutes: 20,
    force: true,
  });
  assert.equal(digests.length, 2);
  assert.equal(digests.find((d) => d.recipient === "influencer")?.messages.length, 1);
  assert.equal(digests.find((d) => d.recipient === "admin")?.messages.length, 1);
}

{
  const conversation: SummaryConversation = {
    id: "c2",
    influencer_id: null,
    influencer_name: "Θανάσης - Influo.gr",
    influencer_email: null,
    brand_email: "brand@example.com",
    brand_name: "Acme",
    last_message_at: "2026-11-17T11:00:00.000Z",
    conversation_kind: "admin",
  };
  const messages = [msg({ id: "3", conversation_id: "c2", sender_type: "admin", content: "Hi brand" })];
  const digests = digestsForConversation(conversation, messages, {
    now,
    quietMinutes: 20,
    force: true,
  });
  assert.equal(digests.length, 1);
  assert.equal(digests[0].recipient, "brand");
}

console.log("admin-chat-digest.test.mts: ok");
