import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("public profile shell uses max-w-profile driven by site setting CSS var", () => {
  const css = fs.readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
  assert.match(css, /\.max-w-profile\s*\{/);
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*max-width:\s*var\(--profile-page-max-w,\s*1440px\)/);

  const profile = fs.readFileSync(
    path.join(ROOT, "components", "InfluencerProfileClient.tsx"),
    "utf8"
  );
  assert.match(profile, /max-w-profile/);
  assert.doesNotMatch(
    profile,
    /className="max-w-6xl mx-auto px-4 sm:px-6 relative -mt-24/,
    "main profile shell must not stay on fixed max-w-6xl"
  );

  const settings = fs.readFileSync(path.join(ROOT, "lib", "siteSettings.ts"), "utf8");
  assert.match(settings, /profile_page_max_width_px/);
  assert.match(settings, /--profile-page-max-w:/);
});
