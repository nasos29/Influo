import assert from "node:assert/strict";
import test from "node:test";
import {
  homepageShowcaseUploadSourceVideoId,
  featuredCollaborationUploadCuratedId,
} from "../lib/homepageShowcaseUpload.ts";

/** Documents the loadFeaturedCollaborations lookup key for curated upload slots (no DB). */
test("showcase upload curated id resolves to creator_media source_video_id key", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const curated = featuredCollaborationUploadCuratedId(id);
  const key = homepageShowcaseUploadSourceVideoId(curated.replace(/^upload:/, ""));
  assert.equal(key, "upload-11111111-2222-3333-4444-555555555555");
  assert.equal(key, homepageShowcaseUploadSourceVideoId(id));
});