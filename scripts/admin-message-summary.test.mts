// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/admin-message-summary.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  adminConversationLink,
  adminInboxAddress,
  buildAdminSummaryEmail,
  deliverAdminSummaries,
  type AdminConversation,
  type AdminSummaryMessage,
  type AdminSummaryStore,
} from "../lib/adminMessageSummary.ts";

const now = new Date("2026-10-11T12:00:00.000Z");

function msg(partial: Partial<AdminSummaryMessage> & Pick<AdminSummaryMessage, "id" | "sender_type">): AdminSummaryMessage {
  return {
    conversation_id: "conv-1",
    content: "Γεια",
    created_at: "2026-10-11T11:00:00.000Z",
    admin_notified: false,
    ...partial,
  };
}

function conversation(partial: Partial<AdminConversation> = {}): AdminConversation {
  return {
    id: "conv-1",
    influencer_name: "Ελένη",
    brand_name: "Καφέ",
    brand_email: "brand@example.com",
    last_message_at: "2026-10-11T11:30:00.000Z",
    closed_at: null,
    ...partial,
  };
}

function memoryStore(seed: AdminSummaryMessage[], convs: AdminConversation[]): AdminSummaryStore & { rows: Map<string, AdminSummaryMessage> } {
  const rows = new Map(seed.map((m) => [m.id, { ...m }]));
  return {
    rows,
    async listUnnotified(limit: number) {
      return [...rows.values()].filter((m) => m.admin_notified !== true).slice(0, limit);
    },
    async listUnnotifiedForConversation(conversationId: string) {
      return [...rows.values()].filter((m) => m.conversation_id === conversationId && m.admin_notified !== true);
    },
    async listConversations(ids: string[]) {
      return convs.filter((c) => ids.includes(c.id));
    },
    async claim(ids: string[]) {
      const claimed: string[] = [];
      for (const id of ids) {
        const row = rows.get(id);
        if (!row || row.admin_notified === true) continue;
        row.admin_notified = true;
        claimed.push(id);
      }
      return claimed;
    },
    async release(ids: string[]) {
      for (const id of ids) {
        const row = rows.get(id);
        if (row) row.admin_notified = false;
      }
    },
  };
}

test("admin inbox falls back to the historical address", () => {
  assert.equal(adminInboxAddress(undefined), "nd.6@hotmail.com");
  assert.equal(adminInboxAddress("  "), "nd.6@hotmail.com");
  assert.equal(adminInboxAddress("ops@influo.gr"), "ops@influo.gr");
  assert.equal(
    adminConversationLink("https://influo.gr/", "conv 1"),
    "https://influo.gr/admin?conversation=conv%201"
  );
});

test("a burst still inside the quiet window sends the admin nothing", async () => {
  const store = memoryStore(
    [msg({ id: "m1", sender_type: "brand" }), msg({ id: "m2", sender_type: "influencer" })],
    [conversation({ last_message_at: "2026-10-11T11:50:00.000Z" })]
  );
  const result = await deliverAdminSummaries({
    store,
    send: async () => {
      throw new Error("should not send");
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(result.sent, 0);
  assert.equal(store.rows.get("m1")?.admin_notified, false);
});

test("after the quiet window one admin email covers both sides, including messages already read", async () => {
  const store = memoryStore(
    [
      msg({ id: "m1", sender_type: "brand", content: "πρώτο <b>" }),
      msg({ id: "m2", sender_type: "influencer", content: "απάντηση" }),
      msg({ id: "m3", sender_type: "brand", content: "ήδη ειδοποιήθηκε", admin_notified: true }),
    ],
    [conversation()]
  );
  const mails: { to: string; subject: string; html: string; ids: string[] }[] = [];
  const result = await deliverAdminSummaries({
    store,
    send: async (mail) => {
      mails.push({ to: mail.to, subject: mail.subject, html: mail.html, ids: mail.messageIds });
    },
    adminEmail: "",
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(result.sent, 1);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "nd.6@hotmail.com");
  assert.deepEqual(mails[0].ids.sort(), ["m1", "m2"]);
  assert.match(mails[0].subject, /Ελένη ↔ Καφέ/);
  assert.match(mails[0].subject, /2 μηνύματα/);
  assert.match(mails[0].html, /Ελένη/);
  assert.match(mails[0].html, /Καφέ/);
  assert.match(mails[0].html, /admin\?conversation=conv-1/);
  assert.match(mails[0].html, /&lt;b&gt;/);
  assert.equal(mails[0].html.includes("<b>"), false);
  assert.equal(store.rows.get("m3")?.admin_notified, true);

  const again = await deliverAdminSummaries({
    store,
    send: async () => {
      throw new Error("should not send twice");
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(again.sent, 0);
});

test("ending a conversation sends the admin summary immediately and a failed send is released", async () => {
  const store = memoryStore(
    [msg({ id: "m1", sender_type: "influencer", content: "τελευταίο", created_at: now.toISOString() })],
    [conversation({ last_message_at: now.toISOString(), closed_at: now.toISOString() })]
  );
  const failed = await deliverAdminSummaries({
    store,
    send: async () => {
      throw new Error("resend down");
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    forceConversationId: "conv-1",
    siteUrl: "https://influo.gr",
  });
  assert.equal(failed.sent, 0);
  assert.equal(store.rows.get("m1")?.admin_notified, false);

  const mails: { html: string }[] = [];
  const ok = await deliverAdminSummaries({
    store,
    send: async (mail) => {
      mails.push({ html: mail.html });
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    forceConversationId: "conv-1",
    siteUrl: "https://influo.gr",
  });
  assert.equal(ok.sent, 1);
  assert.match(mails[0].html, /Η συνομιλία έκλεισε/);
  const built = buildAdminSummaryEmail({
    influencerName: "Ελένη",
    brandName: "Καφέ",
    count: 1,
    previews: ["Ελένη: τελευταίο"],
    link: "https://influo.gr/admin?conversation=conv-1",
    ended: false,
  });
  assert.match(built.html, /έμεινε ήσυχη/);
  assert.equal(built.subject, "Σύνοψη συνομιλίας: Ελένη ↔ Καφέ (1 μήνυμα)");
});

test("a closed thread is included even when it is not yet quiet", async () => {
  const store = memoryStore(
    [msg({ id: "m1", sender_type: "brand", created_at: "2026-10-11T11:55:00.000Z" })],
    [conversation({ last_message_at: "2026-10-11T11:55:00.000Z", closed_at: "2026-10-11T11:56:00.000Z" })]
  );
  let sent = 0;
  const waiting = await deliverAdminSummaries({
    store,
    send: async () => {
      sent += 1;
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(waiting.sent, 0);
  const closed = await deliverAdminSummaries({
    store,
    send: async () => {
      sent += 1;
    },
    adminEmail: "nd.6@hotmail.com",
    now,
    quietMinutes: 20,
    includeClosed: true,
    siteUrl: "https://influo.gr",
  });
  assert.equal(closed.sent, 1);
  assert.equal(sent, 1);
});
