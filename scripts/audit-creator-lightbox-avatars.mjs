/**
 * Request every approved creator's full-size (lightbox) avatar CDN URL and
 * report any non-200 responses.
 *
 * Usage:
 *   node --env-file=.env.local scripts/audit-creator-lightbox-avatars.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = SERVICE_ROLE || ANON;

if (!SUPABASE_URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key");
  process.exit(1);
}

const FULLSIZE_WIDTH = 1600;

function toFullSizeUrl(avatarUrl) {
  const trimmed = String(avatarUrl || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("/storage/v1/render/image/public/")) return trimmed;
  const marker = "/storage/v1/object/public/";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;
  if (!trimmed.includes("supabase.co") && !trimmed.includes("supabase.in")) {
    return trimmed;
  }
  const originAndPath = trimmed.slice(0, idx);
  const objectPath = trimmed.slice(idx + marker.length).split("?")[0];
  if (!objectPath) return trimmed;
  const params = new URLSearchParams({
    width: String(FULLSIZE_WIDTH),
    quality: "80",
    resize: "contain",
  });
  return `${originAndPath}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}

function isBrowserRiskyOriginal(url) {
  return /\.(heic|heif|tif|tiff)(\?|$)/i.test(url);
}

async function headOrGet(url) {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.status !== 405 && head.status !== 501) {
      return {
        status: head.status,
        contentType: head.headers.get("content-type") || "",
      };
    }
  } catch {
    // fall through to GET
  }
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { Range: "bytes=0-0" },
  });
  return {
    status: res.status,
    contentType: res.headers.get("content-type") || "",
  };
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from("influencers")
  .select("id, display_name, profile_slug, avatar_url")
  .eq("approved", true)
  .not("avatar_url", "is", null)
  .order("display_name", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

const rows = (data || []).filter((r) => String(r.avatar_url || "").trim());
console.log(`Checking ${rows.length} approved creators with avatar_url…`);

const broken = [];
const riskyOriginals = [];
let ok = 0;

const concurrency = 12;
let i = 0;

async function worker() {
  while (i < rows.length) {
    const idx = i++;
    const row = rows[idx];
    const original = String(row.avatar_url).trim();
    const full = toFullSizeUrl(original);
    if (!full) {
      broken.push({ ...row, reason: "empty-url", url: original });
      continue;
    }
    if (isBrowserRiskyOriginal(original)) {
      riskyOriginals.push({
        name: row.display_name,
        slug: row.profile_slug,
        original,
      });
    }
    try {
      const { status, contentType } = await headOrGet(full);
      const okType = /^image\//i.test(contentType) && !/heic|heif/i.test(contentType);
      if (status !== 200 || !okType) {
        broken.push({
          name: row.display_name,
          slug: row.profile_slug,
          status,
          contentType,
          url: full,
          original,
        });
      } else {
        ok += 1;
      }
    } catch (e) {
      broken.push({
        name: row.display_name,
        slug: row.profile_slug,
        status: "fetch-error",
        contentType: "",
        url: full,
        original,
        error: e?.message || String(e),
      });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log(`OK: ${ok}`);
console.log(`Broken / non-browser-safe full-size: ${broken.length}`);
console.log(`Risky originals (HEIC/HEIF/TIFF) that need CDN transform: ${riskyOriginals.length}`);

if (riskyOriginals.length) {
  console.log("\nRisky originals:");
  for (const r of riskyOriginals) {
    console.log(`  - ${r.name} (${r.slug}): ${r.original}`);
  }
}

if (broken.length) {
  console.log("\nBroken:");
  for (const b of broken) {
    console.log(
      `  - ${b.name || b.id} (${b.slug || "?"}) status=${b.status} ct=${b.contentType} url=${b.url}`
    );
  }
  process.exit(2);
}

console.log("\nAll approved creator full-size lightbox URLs returned 200 image/*.");
