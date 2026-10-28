// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/instagram-media-type.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagramMediaTypeFromEmbedHtml } from "../lib/instagramMediaType.ts";

test("parseInstagramMediaTypeFromEmbedHtml: GraphImage → image", () => {
  const html = `<html><script>window._sharedData = {"__typename":"GraphImage","id":"1"};</script></html>`;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "image");
});

test("parseInstagramMediaTypeFromEmbedHtml: GraphVideo → video", () => {
  const html = `{"graphql":{"shortcode_media":{"__typename":"GraphVideo","video_url":"https://..."}}}`;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "video");
});

test("parseInstagramMediaTypeFromEmbedHtml: GraphSidecar with is_video true → video", () => {
  const html = `
    {"__typename":"GraphSidecar","edge_sidecar_to_children":{"edges":[
      {"node":{"__typename":"GraphImage","is_video":false}},
      {"node":{"__typename":"GraphVideo","is_video":true}}
    ]}}
  `;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "video");
});

test("parseInstagramMediaTypeFromEmbedHtml: GraphSidecar photos only → image", () => {
  const html = `
    {"__typename":"GraphSidecar","edge_sidecar_to_children":{"edges":[
      {"node":{"__typename":"GraphImage","is_video":false}},
      {"node":{"__typename":"GraphImage","is_video":false}}
    ]}}
  `;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "image");
});

test("parseInstagramMediaTypeFromEmbedHtml: missing/unknown → undefined", () => {
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(""), undefined);
  assert.equal(parseInstagramMediaTypeFromEmbedHtml("<html>no media</html>"), undefined);
  assert.equal(
    parseInstagramMediaTypeFromEmbedHtml('{"__typename":"GraphUser"}'),
    undefined
  );
  // og:type alone must not decide — article for both photos and videos
  assert.equal(
    parseInstagramMediaTypeFromEmbedHtml('<meta property="og:type" content="article" />'),
    undefined
  );
});
