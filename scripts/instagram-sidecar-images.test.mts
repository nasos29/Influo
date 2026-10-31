// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/instagram-sidecar-images.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeIgEscapedUrl,
  extractPosterFromEmbedHtml,
  extractSidecarImagesFromEmbedHtml,
  normalizeIgMediaUrl,
} from "../lib/instagramEmbedVideo.ts";

test("extractSidecarImagesFromEmbedHtml: GraphSidecar children display_url (max 10)", () => {
  const kids = Array.from({ length: 12 }, (_, i) => ({
    node: {
      __typename: i % 3 === 0 ? "GraphVideo" : "GraphImage",
      is_video: i % 3 === 0,
      display_url: `https://scontent.cdninstagram.com/v/t51.${i}.jpg`,
    },
  }));
  const html = JSON.stringify({
    __typename: "GraphSidecar",
    display_url: "https://scontent.cdninstagram.com/v/t51.parent.jpg",
    edge_sidecar_to_children: { edges: kids },
  });
  const images = extractSidecarImagesFromEmbedHtml(html);
  assert.equal(images.length, 10);
  assert.equal(images[0], "https://scontent.cdninstagram.com/v/t51.0.jpg");
  assert.ok(!images.includes("https://scontent.cdninstagram.com/v/t51.parent.jpg"));
});

test("extractSidecarImagesFromEmbedHtml: escaped crawler JSON", () => {
  const html = `\\"edge_sidecar_to_children\\":{\\"edges\\":[{\\"node\\":{\\"display_url\\":\\"https:\\/\\/fbcdn.net\\/a.jpg\\"}},{\\"node\\":{\\"display_url\\":\\"https:\\/\\/fbcdn.net\\/b.jpg\\"}}]}`;
  const images = extractSidecarImagesFromEmbedHtml(html);
  assert.deepEqual(images, ["https://fbcdn.net/a.jpg", "https://fbcdn.net/b.jpg"]);
});

test("extractPosterFromEmbedHtml: EmbeddedMediaImage + og:image fallback", () => {
  const emb = `<img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/photo.jpg?oh=1" />`;
  assert.equal(
    extractPosterFromEmbedHtml(emb),
    "https://scontent.cdninstagram.com/v/photo.jpg?oh=1"
  );

  const og = `<meta property="og:image" content="https://scontent.cdninstagram.com/v/og.jpg" />`;
  assert.equal(
    extractPosterFromEmbedHtml(og),
    "https://scontent.cdninstagram.com/v/og.jpg"
  );
});

test("normalizeIgMediaUrl / decodeIgEscapedUrl: strip literal \\%3D escapes", () => {
  const dirty =
    "https://scontent.cdninstagram.com/v/t51.jpg?ig_cache_key=Mzcw\\%3D\\%3D.3-ccb7-5&_nc_cat=103";
  const clean = normalizeIgMediaUrl(dirty);
  assert.ok(clean);
  assert.equal(clean.includes("\\"), false);
  assert.ok(clean!.includes("ig_cache_key=Mzcw%3D%3D.3-ccb7-5"));
  assert.equal(
    decodeIgEscapedUrl("https://x.com/a?k=NQ\\\\%3D\\\\%3D.end"),
    "https://x.com/a?k=NQ%3D%3D.end"
  );
});

test("extractSidecarImagesFromEmbedHtml: DOM <img> fallback when no GraphQL edges", () => {
  const html = `
    <div class="Embed EmbedSidecar">
      <img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/a.jpg?oh=1" />
      <img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/b.jpg?oh=2" />
      <img src="https://static.cdninstagram.com/rsrc.php/v4/logo.png" />
    </div>`;
  const images = extractSidecarImagesFromEmbedHtml(html);
  assert.deepEqual(images, [
    "https://scontent.cdninstagram.com/v/a.jpg?oh=1",
    "https://scontent.cdninstagram.com/v/b.jpg?oh=2",
  ]);
});
