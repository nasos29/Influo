import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("profile mobile tabs scroll horizontally without scrollIntoView (page jump to About)", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "components", "InfluencerProfileClient.tsx"),
    "utf8"
  );

  const mobileTabsEffect = src.match(
    /\/\/ Mobile tabs:[\s\S]*?\}, \[activeTab\]\);/
  );
  assert.ok(mobileTabsEffect, "expected mobile tabs useEffect");
  const effect = mobileTabsEffect[0];

  const body = effect.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(
    body,
    /scrollIntoView\s*\(/,
    "scrollIntoView scrolls the page on mobile and lands on Σχετικά"
  );
  assert.match(body, /nav\.scrollTo\(/);
  assert.match(body, /scrollWidth\s*<=\s*nav\.clientWidth/);
  assert.match(body, /data-profile-tab/);
});
