/**
 * Diagnostic: influencer_follower_snapshots + 30-day growth readiness.
 * Run: node --env-file=.env.local scripts/check-follower-snapshots.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

async function main() {
  const { data: rows, error } = await supabase
    .from("influencer_follower_snapshots")
    .select("influencer_id, snapshot_at, total_followers")
    .order("snapshot_at", { ascending: true });

  if (error) {
    if (/relation|does not exist|42P01/i.test(error.message)) {
      console.log("TABLE: influencer_follower_snapshots — NOT FOUND or no access.");
      console.log("  Run docs/ADD_FOLLOWER_SNAPSHOTS.sql in Supabase SQL Editor.");
      process.exit(0);
    }
    console.error("Query error:", error.message);
    process.exit(1);
  }

  const list = rows ?? [];
  console.log("TABLE: influencer_follower_snapshots — OK");
  console.log("Total rows:", list.length);

  if (list.length === 0) {
    console.log("\nNo snapshots yet. Growth (30d) will be empty until social refresh creates rows.");
    process.exit(0);
  }

  const byInf = new Map();
  for (const r of list) {
    const id = r.influencer_id;
    if (!byInf.has(id)) byInf.set(id, []);
    byInf.get(id).push(r);
  }

  const oldest = list[0]?.snapshot_at;
  const newest = list[list.length - 1]?.snapshot_at;
  console.log("Oldest snapshot_at (global):", oldest ?? "—");
  console.log("Newest snapshot_at (global):", newest ?? "—");
  console.log("Influencers with ≥1 snapshot:", byInf.size);

  const thirtyIso = thirtyDaysAgo.toISOString();
  let readyForGrowth = 0;
  for (const [, snaps] of byInf) {
    const hasBaseline = snaps.some((s) => s.snapshot_at <= thirtyIso);
    if (hasBaseline) readyForGrowth++;
  }
  console.log(
    `\nBaseline for 30d growth: need snapshot with snapshot_at <= ${thirtyIso.slice(0, 10)}`
  );
  console.log("Influencers with such a baseline:", readyForGrowth);

  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  let blockedByOldBaseline = 0;
  for (const [, snaps] of byInf) {
    const candidates = snaps.filter((s) => s.snapshot_at <= thirtyIso);
    if (candidates.length === 0) continue;
    const baseline = candidates.reduce((a, b) =>
      new Date(a.snapshot_at) > new Date(b.snapshot_at) ? a : b
    );
    const ageMs = Date.now() - new Date(baseline.snapshot_at).getTime();
    if (ageMs > 45 * 24 * 60 * 60 * 1000) blockedByOldBaseline++;
  }
  if (blockedByOldBaseline > 0) {
    console.log(
      "(API may hide growth if ONLY baselines are >45 days old; needs snapshot in ~30–45d window.)"
    );
    console.log("Influencers possibly affected:", blockedByOldBaseline);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
