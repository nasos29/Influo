// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/youtube-handle.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeYouTubeUsernameForSave,
  parseYouTubeChannelFromUrl,
  youtubeChannelUrl,
  youtubeUsernameForAuditpr,
} from "../lib/youtubeHandle.ts";

test("youtubeChannelUrl prefers channel_id then channel_handle then username", () => {
  assert.equal(
    youtubeChannelUrl({
      username: "oldname",
      channel_handle: "MyHandle",
      channel_id: "UCxxxxxxxxxxxxxxxxxxxxxx",
    }),
    "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx"
  );
  assert.equal(
    youtubeChannelUrl({
      username: "oldname",
      channel_handle: "@WithAt",
    }),
    "https://www.youtube.com/@WithAt"
  );
  assert.equal(
    youtubeChannelUrl({
      username: "oldname",
      channel_id: "UCxxxxxxxxxxxxxxxxxxxxxx",
    }),
    "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx"
  );
  assert.equal(
    youtubeChannelUrl({ username: "creator_name" }),
    "https://www.youtube.com/@creator_name"
  );
  assert.equal(
    youtubeChannelUrl({ username: "@creator_name" }),
    "https://www.youtube.com/@creator_name"
  );
});

test("youtubeChannelUrl parses username that is a full channel URL", () => {
  assert.equal(
    youtubeChannelUrl({ username: "https://www.youtube.com/@SomeCreator" }),
    "https://www.youtube.com/@SomeCreator"
  );
  assert.equal(
    youtubeChannelUrl({
      username: "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    }),
    "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"
  );
  assert.equal(
    youtubeChannelUrl({ username: "UCabcdefghijklmnopqrstuv" }),
    "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"
  );
  assert.equal(youtubeChannelUrl({ username: "has spaces" }), null);
  assert.equal(youtubeChannelUrl(null), null);
});

test("parseYouTubeChannelFromUrl extracts handle and channel id", () => {
  assert.deepEqual(parseYouTubeChannelFromUrl("https://youtube.com/@Foo"), {
    handle: "Foo",
  });
  assert.deepEqual(
    parseYouTubeChannelFromUrl("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"),
    { channelId: "UCabcdefghijklmnopqrstuv" }
  );
  assert.equal(parseYouTubeChannelFromUrl("https://www.youtube.com/watch?v=abc"), null);
});

test("normalizeYouTubeUsernameForSave adds @ when missing; Auditpr strips it", () => {
  assert.equal(normalizeYouTubeUsernameForSave("Creator"), "@Creator");
  assert.equal(normalizeYouTubeUsernameForSave("@Creator"), "@Creator");
  assert.equal(normalizeYouTubeUsernameForSave("  @@Creator  "), "@Creator");
  assert.equal(
    normalizeYouTubeUsernameForSave("https://www.youtube.com/@Creator"),
    "@Creator"
  );
  assert.equal(
    normalizeYouTubeUsernameForSave("UCabcdefghijklmnopqrstuv"),
    "UCabcdefghijklmnopqrstuv"
  );
  assert.equal(youtubeUsernameForAuditpr("@Creator"), "Creator");
  assert.equal(youtubeUsernameForAuditpr("Creator"), "Creator");
});
