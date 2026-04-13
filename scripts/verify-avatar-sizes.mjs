/**
 * Verify current object sizes in Supabase bucket "avatars".
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-avatar-sizes.mjs
 */
import { createClient } from "@supabase/supabase-js";

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

function fmtKb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function listAll(prefix = "") {
  let offset = 0;
  const limit = 100;
  const out = [];
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list failed: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  const files = await listAll("");
  const onlyFiles = files.filter((f) => !!f.metadata?.size && !f.id?.endsWith("/"));
  const enriched = onlyFiles
    .map((f) => ({ name: f.name, size: Number(f.metadata?.size || 0) }))
    .sort((a, b) => b.size - a.size);

  const total = enriched.reduce((s, f) => s + f.size, 0);
  const over100kb = enriched.filter((f) => f.size > 100 * 1024).length;
  const over300kb = enriched.filter((f) => f.size > 300 * 1024).length;
  const over1mb = enriched.filter((f) => f.size > 1024 * 1024).length;

  console.log(`Files in ${BUCKET}: ${enriched.length}`);
  console.log(`Total size: ${(total / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`>100KB: ${over100kb}, >300KB: ${over300kb}, >1MB: ${over1mb}`);
  console.log("\nTop 10 largest:");
  for (const f of enriched.slice(0, 10)) {
    console.log(`- ${f.name} | ${fmtKb(f.size)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

