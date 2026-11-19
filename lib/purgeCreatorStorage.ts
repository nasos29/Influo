/**
 * Drain creator_storage_purge: delete every object under creators/<influencer_id>/
 * in the creator-videos bucket. Safe to call after admin/self-delete and from cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { influencerStoragePrefix } from "@/lib/creatorMedia";
import { createMediaObjectStore, removePrefix } from "@/lib/mediaObjectStore";

export type PurgeResult = {
  processed: number;
  removed: number;
  errors: string[];
};

export async function processCreatorStoragePurge(
  supabase: SupabaseClient,
  opts?: { limit?: number }
): Promise<PurgeResult> {
  const limit = opts?.limit ?? 50;
  const { data: jobs, error } = await supabase
    .from("creator_storage_purge")
    .select("id, influencer_id, prefix")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  const result: PurgeResult = { processed: 0, removed: 0, errors: [] };
  for (const job of jobs || []) {
    const prefix =
      String(job.prefix || "").trim() || influencerStoragePrefix(String(job.influencer_id));
    try {
      const removed = await removePrefix(createMediaObjectStore(supabase), prefix);
      const { error: updErr } = await supabase
        .from("creator_storage_purge")
        .update({ processed_at: new Date().toISOString(), error: null })
        .eq("id", job.id);
      if (updErr) throw new Error(updErr.message);
      result.processed += 1;
      result.removed += removed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`${job.id}: ${message}`);
      await supabase
        .from("creator_storage_purge")
        .update({ error: message.slice(0, 500) })
        .eq("id", job.id);
    }
  }
  return result;
}
