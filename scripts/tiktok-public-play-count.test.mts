import assert from "node:assert/strict";
import test from "node:test";
import { parseTikTokPlayCountFromHtml } from "../lib/tikTokPublicPlayCount.ts";

const FIXTURE = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"itemInfo":{"itemStruct":{"id":"7123456789012345678","stats":{"playCount":4823190,"diggCount":1200}}}}}}</script>`;

test("parseTikTokPlayCountFromHtml reads integer playCount", () => {
  assert.equal(parseTikTokPlayCountFromHtml(FIXTURE), 4_823_190);
});

test("parseTikTokPlayCountFromHtml rejects missing or non-integer stats", () => {
  assert.equal(parseTikTokPlayCountFromHtml(""), null);
  assert.equal(parseTikTokPlayCountFromHtml("<html></html>"), null);
  assert.equal(
    parseTikTokPlayCountFromHtml(
      `{"__DEFAULT_SCOPE__":{"webapp.video-detail":{"itemInfo":{"itemStruct":{"stats":{"playCount":1.5}}}}}}`
    ),
    null
  );
});