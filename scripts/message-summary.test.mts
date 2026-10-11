import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSummaryEmail,
  conversationIsQuiet,
  conversationLink,
  deliverSummaries,
  quietMinutesFromEnv,
  type SummaryConversation,
  type SummaryMessage,
  type SummaryStore,
} from "../lib/messageSummary.ts";
import { formatActiveLabel, presenceOnline } from "../lib/presenceStatus.ts";

const now = new Date("2026-10-11T12:00:00.000Z");

function msg(partial: Partial<SummaryMessage> & Pick<SummaryMessage, "id" | "sender_type">): SummaryMessage {
  return {
    conversation_id: "conv-1",
    content: "Γεια",
    created_at: "2026-10-11T11:00:00.000Z",
    read: false,
    email_sent: false,
    ...partial,
  };
}

function conversation(partial: Partial<SummaryConversation> = {}): SummaryConversation {
  return {
    id: "conv-1",
    influencer_id: "inf-1",
    influencer_name: "Ελένη",
    influencer_email: "eleni@example.com",
    brand_email: "brand@example.com",
    brand_name: "Καφέ",
    last_message_at: "2026-10-11T11:30:00.000Z",
    ...partial,
  };
}

function memoryStore(seed: SummaryMessage[], convs: SummaryConversation[]): SummaryStore & { sentFlags: Map<string, boolean> } {
  const rows = new Map(seed.map((m) => [m.id, { ...m }]));
  const sentFlags = new Map<string, boolean>();
  return {
    sentFlags,
    async listPending(limit: number) {
      return [...rows.values()].filter((m) => !m.read && !m.email_sent).slice(0, limit);
    },
    async listPendingForConversation(conversationId: string) {
      return [...rows.values()].filter((m) => m.conversation_id === conversationId && !m.read && !m.email_sent);
    },
    async listConversations(ids: string[]) {
      return convs.filter((c) => ids.includes(c.id));
    },
    async claim(ids: string[]) {
      const claimed: string[] = [];
      for (const id of ids) {
        const row = rows.get(id);
        if (!row || row.read || row.email_sent) continue;
        row.email_sent = true;
        claimed.push(id);
        sentFlags.set(id, true);
      }
      return claimed;
    },
    async release(ids: string[]) {
      for (const id of ids) {
        const row = rows.get(id);
        if (row) row.email_sent = false;
      }
    },
    async influencerEmail() {
      return "eleni@example.com";
    },
    async brandEmail(email: string) {
      return email.toLowerCase();
    },
  };
}

test("quiet window defaults to 20 minutes and clamps", () => {
  assert.equal(quietMinutesFromEnv(undefined), 20);
  assert.equal(quietMinutesFromEnv("30"), 30);
  assert.equal(quietMinutesFromEnv("1"), 5);
  assert.equal(quietMinutesFromEnv("nope"), 20);
});

test("a burst still inside the quiet window sends nothing", async () => {
  const store = memoryStore(
    [msg({ id: "m1", sender_type: "brand" }), msg({ id: "m2", sender_type: "brand", content: "δεύτερο" })],
    [conversation({ last_message_at: "2026-10-11T11:50:00.000Z" })]
  );
  const sent: string[] = [];
  const result = await deliverSummaries({
    store,
    send: async (mail) => {
      sent.push(mail.to);
    },
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(result.sent, 0);
  assert.equal(sent.length, 0);
  assert.equal(store.sentFlags.size, 0);
});

test("after the quiet window one email covers every unread message", async () => {
  const store = memoryStore(
    [
      msg({ id: "m1", sender_type: "brand", content: "πρώτο" }),
      msg({ id: "m2", sender_type: "brand", content: "δεύτερο <script>" }),
      msg({ id: "m3", sender_type: "influencer", content: "απάντηση" }),
      msg({ id: "m4", sender_type: "brand", content: "ήδη διαβάστηκε", read: true }),
    ],
    [conversation()]
  );
  const mails: { to: string; subject: string; html: string; ids: string[] }[] = [];
  const result = await deliverSummaries({
    store,
    send: async (mail) => {
      mails.push({ to: mail.to, subject: mail.subject, html: mail.html, ids: mail.messageIds });
    },
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(result.sent, 2);
  const toInfluencer = mails.find((m) => m.to === "eleni@example.com");
  const toBrand = mails.find((m) => m.to === "brand@example.com");
  assert.ok(toInfluencer);
  assert.ok(toBrand);
  assert.deepEqual(toInfluencer.ids.sort(), ["m1", "m2"]);
  assert.deepEqual(toBrand.ids, ["m3"]);
  assert.match(toInfluencer.subject, /2 αδιάβαστα μηνύματα/);
  assert.match(toInfluencer.html, /Άνοιγμα συνομιλίας/);
  assert.match(toInfluencer.html, /dashboard\?tab=messages&amp;conversation=conv-1/);
  assert.match(toInfluencer.html, /&lt;script&gt;/);
  assert.equal(toInfluencer.html.includes("<script>"), false);
  assert.equal(store.sentFlags.has("m4"), false);

  const again = await deliverSummaries({
    store,
    send: async () => {
      throw new Error("should not send twice");
    },
    now,
    quietMinutes: 20,
    siteUrl: "https://influo.gr",
  });
  assert.equal(again.sent, 0);
});

test("explicit close emails only that conversation, even if others are already quiet", async () => {
  const store = memoryStore(
    [
      msg({ id: "m1", sender_type: "influencer", created_at: now.toISOString() }),
      msg({ id: "other", conversation_id: "conv-2", sender_type: "brand", content: "παλιό" }),
    ],
    [
      conversation({ last_message_at: now.toISOString() }),
      conversation({
        id: "conv-2",
        influencer_email: "other@example.com",
        brand_email: "other-brand@example.com",
        last_message_at: "2026-10-11T10:00:00.000Z",
      }),
    ]
  );
  const sent: string[] = [];
  const result = await deliverSummaries({
    store,
    send: async (mail) => {
      sent.push(mail.conversationId);
    },
    now,
    quietMinutes: 20,
    forceConversationId: "conv-1",
    siteUrl: "https://influo.gr",
  });
  assert.equal(result.sent, 1);
  assert.deepEqual(sent, ["conv-1"]);
  assert.equal((await store.listPending(10)).some((m) => m.id === "other"), true);
});

test("explicit close sends immediately and a failed send is released for retry", async () => {
  const store = memoryStore(
    [msg({ id: "m1", sender_type: "influencer", created_at: now.toISOString() })],
    [conversation({ last_message_at: now.toISOString() })]
  );
  const failed = await deliverSummaries({
    store,
    send: async () => {
      throw new Error("resend down");
    },
    now,
    quietMinutes: 20,
    forceConversationId: "conv-1",
    siteUrl: "https://influo.gr",
  });
  assert.equal(failed.sent, 0);
  assert.equal(failed.errors.length, 1);
  assert.equal(store.sentFlags.get("m1"), true);
  const rowStillPending = (await store.listPending(10)).some((m) => m.id === "m1");
  assert.equal(rowStillPending, true);

  const sent: string[] = [];
  const ok = await deliverSummaries({
    store,
    send: async (mail) => {
      sent.push(mail.to);
    },
    now,
    quietMinutes: 20,
    forceConversationId: "conv-1",
    siteUrl: "https://influo.gr",
  });
  assert.equal(ok.sent, 1);
  assert.deepEqual(sent, ["brand@example.com"]);
});

test("links and presence labels", () => {
  assert.equal(
    conversationLink("https://influo.gr/", "brand", "abc"),
    "https://influo.gr/brand/dashboard?tab=messages&conversation=abc"
  );
  assert.equal(conversationIsQuiet("2026-10-11T11:30:00.000Z", now, 20), true);
  assert.equal(conversationIsQuiet("2026-10-11T11:50:00.000Z", now, 20), false);
  const fresh = new Date(Date.now() - 20_000).toISOString();
  const stale = new Date(Date.now() - 120_000).toISOString();
  assert.equal(presenceOnline({ is_online: true, last_seen: fresh }), true);
  assert.equal(presenceOnline({ is_online: true, last_seen: stale }), false);
  assert.equal(presenceOnline({ is_online: false, last_seen: fresh }), false);
  assert.equal(formatActiveLabel(fresh, true, "el"), "Ενεργός τώρα");
  assert.match(formatActiveLabel(new Date(Date.now() - 5 * 60_000).toISOString(), false, "el"), /Ενεργός πριν από 5 λεπτά/);
  const mail = buildSummaryEmail({
    count: 1,
    counterpartName: "Καφέ",
    previews: ["Γεια"],
    link: "https://influo.gr/dashboard?tab=messages&conversation=abc",
  });
  assert.equal(mail.subject, "1 αδιάβαστο μήνυμα από Καφέ");
});
