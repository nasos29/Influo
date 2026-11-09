// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/creator-card-media.test.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CREATOR_CARD_PHOTO_WIDTH,
  getCreatorCardPhotoUrl,
} from "../lib/imageProxy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("shared creator-card-media CSS fills any aspect without gaps or stretch", () => {
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(css, /\.creator-card-media\s*\{/);
  assert.match(css, /aspect-ratio:\s*4\s*\/\s*5/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /\.creator-card-media__img\s*\{/);
  assert.match(css, /object-fit:\s*cover/);
  assert.match(css, /object-position:\s*center\s+center/);
});

test("InfluencerCard uses shared media frame + width-only CDN URL", () => {
  const src = readFileSync(join(root, "components/InfluencerCard.tsx"), "utf8");
  assert.match(src, /getCreatorCardPhotoUrl/);
  assert.match(src, /creator-card-media/);
  assert.match(src, /creator-card-media__img/);
  assert.doesNotMatch(src, /getStorageCardUrl\(avatar,\s*480,\s*600\)/);
});

test("CDN helper leaves framing to CSS for portrait/landscape/square uploads", () => {
  const sample =
    "https://abcd.supabase.co/storage/v1/object/public/avatars/any-aspect.webp";
  const out = getCreatorCardPhotoUrl(sample)!;
  assert.ok(out.includes(`width=${CREATOR_CARD_PHOTO_WIDTH}`));
  assert.ok(!out.includes("height="), "no hard CDN crop — CSS object-fit handles tall/wide/square");
  assert.ok(
    out.includes("resize=contain"),
    "width-only must use contain; default cover returns a vertical strip (eye/wall zoom)"
  );
});
