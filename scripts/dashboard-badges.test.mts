import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationSeenKey,
  countNewerThan,
  countUnseenIds,
  latestIso,
  readProposalSeenIds,
  readStamp,
  writeIdList,
  writeStamp,
  type SeenStore,
} from "../lib/dashboardBadges.ts";

function memoryStore(seed: Record<string, string> = {}): SeenStore & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

test("a conversation newer than the admin's last open is unseen, and opening stamps that moment", () => {
  const store = memoryStore();
  const times = ["2026-10-18T10:00:00.000Z", "2026-10-18T12:00:00.000Z"];
  assert.equal(countNewerThan(times, null), 2);
  const openedAt = latestIso(times, "2026-10-18T09:00:00.000Z");
  writeStamp(store, conversationSeenKey("admin-1"), openedAt);
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-1"))), 0);
  assert.equal(countNewerThan([...times, "2026-10-18T12:05:00.000Z"], readStamp(store, conversationSeenKey("admin-1"))), 1);
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-2"))), 2);
});

test("pending proposal ids the admin already opened stay hidden, including the legacy list", () => {
  const store = memoryStore({ admin_seen_pending_proposal_ids: JSON.stringify([7, 8]) });
  const seen = readProposalSeenIds(store, "admin-1");
  assert.deepEqual(seen, ["7", "8"]);
  assert.equal(countUnseenIds([7, 8, 9], seen), 1);
  writeIdList(store, "influo.seen.admin-1.proposals", [7, 8, 9]);
  assert.equal(countUnseenIds([7, 8, 9], readProposalSeenIds(store, "admin-1")), 0);
});

test("an open campaign the influencer has not opened counts once, then not again", () => {
  const store = memoryStore();
  const openIds = ["camp-a", "camp-b"];
  assert.equal(countUnseenIds(openIds, []), 2);
  writeIdList(store, "influo.seen.inf-1.campaigns", openIds);
  assert.equal(countUnseenIds([...openIds, "camp-c"], ["camp-a", "camp-b"]), 1);
  assert.equal(store.getItem("influo.seen.inf-1.campaigns"), JSON.stringify(openIds));
});
