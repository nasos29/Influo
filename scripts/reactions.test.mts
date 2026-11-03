import { test } from "node:test";
import assert from "node:assert/strict";
import { groupReactions, byMessage, quoteText } from "../lib/reactions.ts";
test("group", () => {
  const g = groupReactions([{ reactor: "brand", emoji: "👍" }, { reactor: "influencer", emoji: "👍" }, { reactor: "brand", emoji: "❤️" }], "influencer");
  assert.deepEqual(g, [{ emoji: "👍", count: 2, mine: true }, { emoji: "❤️", count: 1, mine: false }]);
});
test("byMessage", () => assert.equal(byMessage([{ message_id: "a", reactor: "brand", emoji: "👍" }]).a.length, 1));
test("quote", () => {
  assert.equal(quoteText("", true), "📎 Συνημμένο");
  assert.equal(quoteText("a".repeat(100)).length, 90);
});
