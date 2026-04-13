/**
 * Optimize existing avatar/logo images in Supabase bucket "avatars".
 *
 * Usage:
 *   node --env-file=.env.local scripts/optimize-existing-avatars.mjs
 *   node --env-file=.env.local scripts/optimize-existing-avatars.mjs --apply
 *   node --env-file=.env.local scripts/optimize-existing-avatars.mjs --apply --limit=50 --max-side=800
 *
 * Notes:
 * - Dry-run (default): downloads + estimates optimization, no uploads.
 * - Apply mode: overwrites same object path (upsert=true) with optimized bytes.
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "avatars";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL_BUCKET = args.includes("--all-bucket");
const limitArg = args.find((a) => a.startsWith("--limit="));
const maxSideArg = args.find((a) => a.startsWith("--max-side="));
const LIMIT = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : null;
const MAX_SIDE = maxSideArg ? Math.max(256, Number(maxSideArg.split("=")[1])) : 800;

function bytesToMb(n) {
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function parseAvatarPathFromPublicUrl(url) {
  try {
    const u = new URL(String(url));
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function getContentType(format, fallback) {
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return fallback || "application/octet-stream";
}

async function fetchReferencedPaths() {
  const paths = new Set();

  const { data: influencers, error: infErr } = await supabase
    .from("influencers")
    .select("avatar_url")
    .not("avatar_url", "is", null);
  if (infErr) throw new Error(`influencers query failed: ${infErr.message}`);

  for (const r of influencers || []) {
    const p = parseAvatarPathFromPublicUrl(r.avatar_url);
    if (p) paths.add(p);
  }

  const { data: brands, error: brErr } = await supabase
    .from("brands")
    .select("logo_url")
    .not("logo_url", "is", null);
  if (brErr) throw new Error(`brands query failed: ${brErr.message}`);

  for (const r of brands || []) {
    const p = parseAvatarPathFromPublicUrl(r.logo_url);
    if (p) paths.add(p);
  }

  return Array.from(paths);
}

async function fetchAllBucketPaths() {
  const out = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`bucket list failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const f of data) {
      // Skip folders
      if (!f.id?.endsWith("/") && f.name) out.push(f.name);
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function optimizeBuffer(inputBuffer) {
  const img = sharp(inputBuffer, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const format = meta.format;

  if (!format || format === "svg" || format === "gif") {
    return {
      skip: true,
      reason: `unsupported format: ${format || "unknown"}`,
      originalBytes: inputBuffer.byteLength,
      optimizedBytes: inputBuffer.byteLength,
      buffer: Buffer.from(inputBuffer),
      outputFormat: format || "unknown",
    };
  }

  let pipeline = img.resize({
    width: MAX_SIDE,
    height: MAX_SIDE,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (format === "jpeg" || format === "jpg") {
    pipeline = pipeline.jpeg({ quality: 78, mozjpeg: true });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, quality: 80 });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality: 75 });
  }

  const out = await pipeline.toBuffer();
  return {
    skip: false,
    reason: "",
    originalBytes: inputBuffer.byteLength,
    optimizedBytes: out.byteLength,
    buffer: out,
    outputFormat: format,
  };
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (write)" : "DRY-RUN (read-only)"}`);
  console.log(`Max side: ${MAX_SIDE}px`);
  console.log(`Scope: ${ALL_BUCKET ? "ALL BUCKET FILES" : "REFERENCED IN DB"}`);

  let paths = ALL_BUCKET ? await fetchAllBucketPaths() : await fetchReferencedPaths();
  if (LIMIT) paths = paths.slice(0, LIMIT);

  console.log(`Referenced files to inspect: ${paths.length}`);
  if (paths.length === 0) {
    console.log("No avatar/logo paths found.");
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const path of paths) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) {
        failed++;
        console.warn(`✖ download failed: ${path} (${error?.message || "no data"})`);
        continue;
      }

      const input = Buffer.from(await data.arrayBuffer());
      const result = await optimizeBuffer(input);

      totalOriginal += result.originalBytes;
      totalOptimized += result.optimizedBytes;

      if (result.skip) {
        skipped++;
        console.log(`- skip ${path} (${result.reason})`);
        continue;
      }

      const saved = result.originalBytes - result.optimizedBytes;
      const pct = result.originalBytes
        ? ((saved / result.originalBytes) * 100).toFixed(1)
        : "0.0";

      if (APPLY) {
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, result.buffer, {
          upsert: true,
          contentType: getContentType(result.outputFormat),
          cacheControl: "31536000",
        });
        if (upErr) {
          failed++;
          console.warn(`✖ upload failed: ${path} (${upErr.message})`);
          continue;
        }
      }

      processed++;
      console.log(
        `✓ ${APPLY ? "optimized" : "would optimize"} ${path} | ${bytesToMb(
          result.originalBytes
        )} -> ${bytesToMb(result.optimizedBytes)} (${pct}% smaller)`
      );
    } catch (e) {
      failed++;
      console.warn(`✖ error on ${path}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalSaved = totalOriginal - totalOptimized;
  const totalPct = totalOriginal ? ((totalSaved / totalOriginal) * 100).toFixed(1) : "0.0";

  console.log("\n=== Summary ===");
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Original:  ${bytesToMb(totalOriginal)}`);
  console.log(`Optimized: ${bytesToMb(totalOptimized)}`);
  console.log(`Saved:     ${bytesToMb(totalSaved)} (${totalPct}%)`);
  console.log(`Mode:      ${APPLY ? "APPLY" : "DRY-RUN"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

