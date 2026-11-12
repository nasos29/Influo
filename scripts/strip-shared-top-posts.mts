/**
 * One-shot: remove top_posts URLs that appear on many influencers
 * (shared/foreign viral pollution from scraper feed mix-ups).
 *
 * Usage (from influo/):
 *   node --experimental-strip-types --env-file=.env.local scripts/strip-shared-top-posts.mts          # dry run
 *   APPLY=1 node --experimental-strip-types --env-file=.env.local scripts/strip-shared-top-posts.mts # writes
 *   # or on server with .env.production
 */
import { createClient } from "@supabase/supabase-js";

const MIN_SHARED = Number(process.env.TOP_POSTS_SHARED_MIN || 3);
// Safe by default: only writes when APPLY=1 (DRY_RUN=1 kept for compatibility).
const DRY = process.env.APPLY !== "1" || process.env.DRY_RUN === "1";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type Acc = { platform?: string; top_posts?: { url?: string }[]; [k: string]: unknown };

function postUrls(accounts: Acc[]): string[] {
  const out: string[] = [];
  for (const a of accounts) {
    for (const p of a.top_posts || []) {
      const u = typeof p?.url === "string" ? p.url.trim() : "";
      if (u) out.push(u);
    }
  }
  return out;
}

async function main() {
  const { data, error } = await admin
    .from("influencers")
    .select("id, accounts")
    .not("accounts", "is", null);
  if (error) throw error;
  const rows = data || [];
  const freq = new Map<string, number>();
  for (const row of rows) {
    const accounts = Array.isArray(row.accounts) ? (row.accounts as Acc[]) : [];
    for (const u of new Set(postUrls(accounts))) {
      freq.set(u, (freq.get(u) || 0) + 1);
    }
  }
  const shared = new Set([...freq.entries()].filter(([, n]) => n >= MIN_SHARED).map(([u]) => u));
  console.log(`influencers=${rows.length} unique_urls=${freq.size} shared>=${MIN_SHARED}=${shared.size}`);
  if (!shared.size) return;

  let touched = 0;
  let removed = 0;
  for (const row of rows) {
    const accounts = Array.isArray(row.accounts) ? (row.accounts as Acc[]) : [];
    let changed = false;
    const next = accounts.map((acc) => {
      const posts = Array.isArray(acc.top_posts) ? acc.top_posts : null;
      if (!posts?.length) return acc;
      const kept = posts.filter((p) => {
        const u = typeof p?.url === "string" ? p.url.trim() : "";
        if (u && shared.has(u)) {
          removed += 1;
          changed = true;
          return false;
        }
        return true;
      });
      return kept.length === posts.length ? acc : { ...acc, top_posts: kept };
    });
    if (!changed) continue;
    touched += 1;
    if (DRY) continue;
    const { error: upErr } = await admin.from("influencers").update({ accounts: next }).eq("id", row.id);
    if (upErr) console.error("update failed", row.id, upErr.message);
  }
  console.log(`${DRY ? "DRY " : ""}touched=${touched} removed_post_slots=${removed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
