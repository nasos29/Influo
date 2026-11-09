// Campaign covers must render only through components/CampaignCover.tsx (full image: object-contain + blurred fill).
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

test("no campaign cover image rendered outside CampaignCover", () => {
  const offenders: string[] = [];
  for (const file of [...tsxFiles(path.join(ROOT, "components")), ...tsxFiles(path.join(ROOT, "app"))]) {
    if (file.endsWith(`${path.sep}CampaignCover.tsx`)) continue;
    const src = fs.readFileSync(file, "utf8");
    // An <img>/<Image>/<FastImage> whose src is a campaign cover (cover_url / coverUrl).
    const re = /<(img|Image|FastImage)\b[^>]*\bsrc=\{[^}]*\b(cover_url|coverUrl)\b[^}]*\}/gs;
    for (const m of src.matchAll(re)) offenders.push(`${path.relative(ROOT, file)}: ${m[0].slice(0, 80)}`);
  }
  assert.deepEqual(offenders, [], "Render campaign covers with <CampaignCover />");
});

test("CampaignCover shows the full cover over a blurred fill of the same image", () => {
  const src = fs.readFileSync(path.join(ROOT, "components", "CampaignCover.tsx"), "utf8");
  const main = src.match(/<FastImage[^>]*alt=\{title\}[^>]*>/s)?.[0] || "";
  assert.match(main, /object-contain/, "main cover must be object-contain by default");
  // Detail pages may add lg:object-cover when desktopMaxHeightPx caps height; cards stay contain-only.
  assert.match(src, /\[filter:blur\(18px\)\]/, "blurred background fill expected");
  assert.match(src, /desktopMaxHeightPx/, "detail pages can opt into a desktop max-height cap");
  assert.match(src, /lg:object-cover lg:object-center/, "desktop detail cap uses object-cover + center");
});

test("FastImage inline object-fit honours object-contain", () => {
  const src = fs.readFileSync(path.join(ROOT, "components", "FastImage.tsx"), "utf8");
  assert.doesNotMatch(src, /objectFit:\s*"cover"\s*}/, "inline objectFit must not be hard-coded to cover");
  assert.match(src, /object-contain/);
});
