import assert from "node:assert/strict";
import test from "node:test";
import { unreadFromOtherParty } from "../lib/messageRead.ts";
import { counterpartyBrandPresence, counterpartyInfluencerPresence } from "../lib/presenceIdentity.ts";
import {
  beginPresenceLogout,
  presenceLogoutEpoch,
  presenceStillCurrent,
  registerPresenceStop,
} from "../lib/presenceControl.ts";

test("unread ids are only the other party's not-yet-read messages", () => {
  const messages = [
    { id: "own-unread", sender_type: "brand", read: false },
    { id: "own-read", sender_type: "brand", read: true },
    { id: "theirs-unread", sender_type: "influencer", read: false },
    { id: "theirs-null", sender_type: "influencer", read: null },
    { id: "theirs-read", sender_type: "influencer", read: true },
  ];
  assert.deepEqual(unreadFromOtherParty(messages, "brand"), ["theirs-unread", "theirs-null"]);
  assert.deepEqual(unreadFromOtherParty(messages, "influencer"), ["own-unread"]);
});

test("presence row is kept only when it is the requested counterparty", () => {
  const row = { influencer_id: "inf-1", is_online: true, last_seen: "2026-10-11T12:00:00.000Z" };
  assert.equal(counterpartyInfluencerPresence("inf-1", row, "brand-user"), row);
  assert.equal(counterpartyInfluencerPresence("inf-2", row, "brand-user"), null);
  assert.equal(counterpartyInfluencerPresence("inf-1", row, "inf-1"), null);
  assert.equal(counterpartyInfluencerPresence("inf-1", { is_online: true, last_seen: row.last_seen }, null), null);

  const brand = { brand_email: "Brand@Example.com", is_online: true, last_seen: row.last_seen };
  assert.equal(counterpartyBrandPresence("brand@example.com", brand), brand);
  assert.equal(counterpartyBrandPresence("other@example.com", brand), null);
});

test("logout stops heartbeats and invalidates the epoch they captured", () => {
  const before = presenceLogoutEpoch();
  let stopped = 0;
  const unregister = registerPresenceStop(() => {
    stopped += 1;
  });
  registerPresenceStop(() => {
    throw new Error("stop failed");
  });
  const epoch = beginPresenceLogout();
  assert.equal(stopped, 1);
  assert.equal(epoch, before + 1);
  assert.equal(presenceStillCurrent(before), false);
  assert.equal(presenceStillCurrent(epoch), true);
  unregister();
  let after = 0;
  registerPresenceStop(() => {
    after += 1;
  });
  beginPresenceLogout();
  assert.equal(after, 1);
});
