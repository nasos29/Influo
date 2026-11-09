/**
 * Audit full-size lightbox URLs from a JSON array of
 * { display_name, profile_slug, avatar_url }.
 *
 *   node scripts/run-lightbox-audit-from-json.mjs path/to/avatars.json
 */
import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-lightbox-audit-from-json.mjs <avatars.json>");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(file, "utf8"));
const FULLSIZE_WIDTH = 1600;

function toFullSizeUrl(avatarUrl) {
  const trimmed = String(avatarUrl || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("/storage/v1/render/image/public/")) return trimmed;
  const marker = "/storage/v1/object/public/";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;
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

async function check(url) {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.status !== 405 && head.status !== 501) {
      return {
        status: head.status,
        contentType: head.headers.get("content-type") || "",
      };
    }
  } catch {
    // fall through
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

const broken = [];
let ok = 0;
let i = 0;
const concurrency = 16;

async function worker() {
  while (i < rows.length) {
    const idx = i++;
    const row = rows[idx];
    const full = toFullSizeUrl(row.avatar_url);
    try {
      const { status, contentType } = await check(full);
      const okType =
        /^image\//i.test(contentType) && !/heic|heif/i.test(contentType);
      if (status !== 200 || !okType) {
        broken.push({
          name: row.display_name,
          slug: row.profile_slug,
          status,
          contentType,
          url: full,
        });
      } else {
        ok += 1;
      }
    } catch (e) {
      broken.push({
        name: row.display_name,
        slug: row.profile_slug,
        status: "fetch-error",
        error: e?.message || String(e),
        url: full,
      });
    }
  }
}

console.log(`Checking ${rows.length} full-size lightbox URLs…`);
await Promise.all(Array.from({ length: concurrency }, () => worker()));
console.log(`OK: ${ok}`);
console.log(`Broken: ${broken.length}`);
if (broken.length) {
  for (const b of broken) {
    console.log(
      `  - ${b.name} (${b.slug}) status=${b.status} ct=${b.contentType || ""} url=${b.url}`
    );
  }
  process.exit(2);
}
console.log("All approved creator full-size lightbox URLs returned 200 image/*.");
