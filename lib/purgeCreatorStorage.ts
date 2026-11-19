/**
 * Drain creator_storage_purge: delete every object under creators/<influencer_id>/
 * in the creator-videos bucket. Safe to call after admin/self-delete and from cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CREATOR_VIDEOS_BUCKET, influencerStoragePrefix } from "@/lib/creatorMedia";

const PAGE = 100;

export type PurgeResult = {
  processed: number;
  removed: number;
  errors: string[];
};

async function listAllUnderPrefix(
  supabase: SupabaseClient,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  const prefixes = [prefix.replace(/^\/+|\/+$/g, "")];
  const seen = new Set<string>();

  while (prefixes.length) {
    const current = prefixes.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(CREATOR_VIDEOS_BUCKET)
        .list(current, { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const entry of data) {
        const full = current ? `${current}/${entry.name}` : entry.name;
        // Folders have no id / metadata in Storage list responses
        const isFile = Boolean(entry.id) || Boolean(entry.metadata);
        if (isFile) paths.push(full);
        else prefixes.push(full);
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }
  return paths;
}

async function removePrefix(supabase: SupabaseClient, prefix: string): Promise<number> {
  const paths = await listAllUnderPrefix(supabase, prefix);
  if (!paths.length) return 0;
  let removed = 0;
  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const { error } = await supabase.storage.from(CREATOR_VIDEOS_BUCKET).remove(chunk);
    if (error) throw new Error(error.message);
    removed += chunk.length;
  }
  return removed;
}

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
      const removed = await removePrefix(supabase, prefix);
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
