import { test } from "node:test";
import assert from "node:assert/strict";
import { insertAtCursor, pushRecent, searchEmojis, EMOJI_CATEGORIES } from "../lib/emojiData.ts";
test("insert at cursor", () => assert.deepEqual(insertAtCursor("ab", "😀", 1, 1), { value: "a😀b", caret: 3 }));
test("insert replaces selection", () => assert.equal(insertAtCursor("abc", "❤️", 0, 3).value, "❤️"));
test("recent dedupes and caps", () => {
  assert.deepEqual(pushRecent(["a", "b"], "b"), ["b", "a"]);
  assert.equal(pushRecent(Array.from({ length: 30 }, (_, i) => String(i)), "x").length, 24);
});
test("search greek and english", () => {
  assert.ok(searchEmojis("καρδιά").includes("❤️"));
  assert.ok(searchEmojis("pizza").includes("🍕"));
});
test("categories have items", () => assert.ok(EMOJI_CATEGORIES.every((c) => c.items.length > 5)));
