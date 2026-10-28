// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/platform-mix.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { buildPlatformMix } from "../lib/platformMix.ts";

test("buildPlatformMix includes avg views only when > 0", () => {
  const rows = buildPlatformMix(
    { tiktok: 5000, instagram: 1000 },
    { tiktok: "9%", instagram: "3%" },
    { tiktok: "30", instagram: "10" },
    [
      { platform: "tiktok", avg_views: "12k" },
      { platform: "instagram", avg_views: 0 },
    ]
  );
  const tt = rows.find((r) => r.key === "tiktok");
  const ig = rows.find((r) => r.key === "instagram");
  assert.equal(tt?.avgViews, 12000);
  assert.equal(ig?.avgViews, null);
});
