import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("related creators strip uses max-w-profile; main profile shell stays max-w-6xl", () => {
  const css = fs.readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
  assert.match(css, /\.max-w-profile\s*\{/);
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*max-width:\s*var\(--profile-page-max-w,\s*1440px\)/);

  const profile = fs.readFileSync(
    path.join(ROOT, "components", "InfluencerProfileClient.tsx"),
    "utf8"
  );
  assert.match(
    profile,
    /className="max-w-6xl mx-auto px-4 sm:px-6 relative -mt-24/,
    "main profile shell must stay on fixed max-w-6xl"
  );
  assert.doesNotMatch(profile, /max-w-profile/);

  const similar = fs.readFileSync(
    path.join(ROOT, "components", "SimilarInfluencers.tsx"),
    "utf8"
  );
  assert.match(similar, /max-w-profile/);
  assert.doesNotMatch(
    similar,
    /className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 mb-6"/,
    "related creators strip must use the wider max-w-profile shell"
  );

  const packages = fs.readFileSync(
    path.join(ROOT, "components", "ProfileOffersPanel.tsx"),
    "utf8"
  );
  assert.match(packages, /className="space-y-3" role="radiogroup"/);
  assert.doesNotMatch(packages, /min-\[1440px\]:grid-cols-2/);

  const settings = fs.readFileSync(path.join(ROOT, "lib", "siteSettings.ts"), "utf8");
  assert.match(settings, /profile_page_max_width_px/);
  assert.match(settings, /--profile-page-max-w:/);
});
