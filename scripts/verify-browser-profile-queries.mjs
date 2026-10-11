import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  "lib/ownProfile.ts",
  "app/login/page.tsx",
  "app/dashboard/page.tsx",
  "app/dashboard/media-kit/page.tsx",
  "app/help-desk/page.tsx",
  "app/brand/dashboard/page.tsx",
  "app/logout/page.tsx",
  "app/campaigns/page.tsx",
  "components/DashboardContent.tsx",
  "components/BrandDashboardContent.tsx",
  "app/influencer/[id]/page.tsx",
];

const forbidden = [
  /from\(["']influencers["']\)[\s\S]{0,160}\.select\(\s*["']\*["']\s*\)/,
  /from\(["']brands["']\)[\s\S]{0,160}\.select\(\s*["']\*["']\s*\)/,
  /from\(["']influencers["']\)[\s\S]{0,240}\.(ilike|eq)\(\s*["']contact_email["']/,
  /from\(["']brands["']\)[\s\S]{0,240}\.(ilike|eq)\(\s*["']contact_email["']/,
];

let failed = false;
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`${file} matches ${pattern}`);
      failed = true;
    }
  }
}

const own = fs.readFileSync(path.join(root, "lib/ownProfile.ts"), "utf8");
if (own.includes(".from(")) {
  console.error("lib/ownProfile.ts still queries Supabase tables from the browser");
  failed = true;
}

if (failed) process.exit(1);
console.log("browser profile queries ok");
