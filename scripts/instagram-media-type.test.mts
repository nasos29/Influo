// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/instagram-media-type.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseInstagramEmbedKindFromHtml,
  parseInstagramMediaTypeFromEmbedHtml,
} from "../lib/instagramMediaType.ts";

test("parseInstagramMediaTypeFromEmbedHtml: GraphImage → image", () => {
  const html = `<html><script>window._sharedData = {"__typename":"GraphImage","id":"1"};</script></html>`;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "image");
  assert.equal(parseInstagramEmbedKindFromHtml(html), "image");
});

test("parseInstagramMediaTypeFromEmbedHtml: GraphVideo → video", () => {
  const html = `{"graphql":{"shortcode_media":{"__typename":"GraphVideo","video_url":"https://..."}}}`;
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "video");
  assert.equal(parseInstagramEmbedKindFromHtml(html), "video");
});

test("parseInstagramEmbedKindFromHtml: GraphSidecar → carousel", () => {
  const html = `
    {"__typename":"GraphSidecar","edge_sidecar_to_children":{"edges":[
      {"node":{"__typename":"GraphImage","is_video":false}},
      {"node":{"__typename":"GraphImage","is_video":false}}
    ]}}
  `;
  assert.equal(parseInstagramEmbedKindFromHtml(html), "carousel");
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "image");
});

test("parseInstagramMediaTypeFromEmbedHtml: GraphSidecar with is_video true → video (coarse)", () => {
  const html = `
    {"__typename":"GraphSidecar","edge_sidecar_to_children":{"edges":[
      {"node":{"__typename":"GraphImage","is_video":false}},
      {"node":{"__typename":"GraphVideo","is_video":true}}
    ]}}
  `;
  assert.equal(parseInstagramEmbedKindFromHtml(html), "carousel");
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "video");
});

test("parseInstagramEmbedKindFromHtml: escaped crawler JSON", () => {
  const html = `\\"__typename\\":\\"GraphImage\\",\\"is_video\\":false`;
  assert.equal(parseInstagramEmbedKindFromHtml(html), "image");
});

test("parseInstagramEmbedKindFromHtml: data-media-type attr (crawler embed)", () => {
  const html = `<div data-media-type="GraphImage" data-media-id="1"><img class="EmbeddedMediaImage" src="https://example.com/a.jpg" /></div>`;
  assert.equal(parseInstagramEmbedKindFromHtml(html), "image");
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(html), "image");

  const video = `<div data-media-type="GraphVideo" data-media-id="2"></div>`;
  assert.equal(parseInstagramEmbedKindFromHtml(video), "video");

  const carousel = `<div data-media-type="GraphSidecar" data-media-id="3"></div>`;
  assert.equal(parseInstagramEmbedKindFromHtml(carousel), "carousel");
  assert.equal(parseInstagramMediaTypeFromEmbedHtml(carousel), "image");
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

test("parseInstagramEmbedKindFromHtml: EmbeddedMediaImage / EmbedSidecar without typename", () => {
  assert.equal(
    parseInstagramEmbedKindFromHtml(
      `<div class="Embed"><img class="EmbeddedMediaImage" src="https://example.com/a.jpg" /></div>`
    ),
    "image"
  );
  assert.equal(
    parseInstagramEmbedKindFromHtml(`<div class="Embed EmbedSidecar"></div>`),
    "carousel"
  );
});
