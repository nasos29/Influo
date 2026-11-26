/**
 * Apply creator-submitted published post URL from a signed add-post token (service role).
 * Proposal: sets published_post_url + pending brand approval.
 * Campaign: sets deliverable_url and moves status to submitted so brand can approve.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSocialPostUrlResolved } from "@/lib/socialPostUrl";
import type { ShowcaseAddPostPayload } from "@/lib/showcaseAddPost";

export type ApplyAddPostResult =
  | { ok: true; url: string }
  | { ok: false; reason: "not_found" | "invalid_url" | "error"; message?: string };

export async function applyShowcaseAddPost(
  admin: SupabaseClient,
  payload: ShowcaseAddPostPayload,
  rawUrl: string
): Promise<ApplyAddPostResult> {
  const parsed = await parseSocialPostUrlResolved(rawUrl);
  if (!parsed.ok) {
    return { ok: false, reason: "invalid_url", message: parsed.error };
  }

  if (payload.source === "proposal") {
    const { data, error } = await admin
      .from("proposals")
      .update({
        published_post_url: parsed.url,
        published_post_pending_approval: true,
        showcase_post_url_updated_at: new Date().toISOString(),
        showcase_post_url_updated_by: "creator:add-post-token",
      })
      .eq("id", payload.id)
      .eq("status", "completed")
      .select("id")
      .maybeSingle();
    if (error) {
      // Soft-fail if pending column not migrated yet.
      if (/published_post_pending_approval|showcase_post_url_updated|PGRST204|42703/i.test(error.message || "")) {
        const soft = await admin
          .from("proposals")
          .update({ published_post_url: parsed.url })
          .eq("id", payload.id)
          .eq("status", "completed")
          .select("id")
          .maybeSingle();
        if (soft.error) return { ok: false, reason: "error", message: soft.error.message };
        if (!soft.data) return { ok: false, reason: "not_found" };
        return { ok: true, url: parsed.url };
      }
      return { ok: false, reason: "error", message: error.message };
    }
    if (!data) return { ok: false, reason: "not_found" };
    return { ok: true, url: parsed.url };
  }

  const { data: app, error: loadErr } = await admin
    .from("campaign_applications")
    .select("id, deliverable_status")
    .eq("id", payload.id)
    .maybeSingle();
  if (loadErr) return { ok: false, reason: "error", message: loadErr.message };
  if (!app) return { ok: false, reason: "not_found" };

  const status = String(app.deliverable_status || "");
  const update: Record<string, unknown> = {
    deliverable_url: parsed.url,
    deliverable_seen_at: null,
    showcase_post_url_updated_at: new Date().toISOString(),
    showcase_post_url_updated_by: "creator:add-post-token",
  };
  // Brand must (re)approve unless already in changes_requested (keep that status).
  if (status !== "changes_requested") {
    update.deliverable_status = "submitted";
    update.delivered_at = new Date().toISOString();
  }

  let { data, error } = await admin
    .from("campaign_applications")
    .update(update)
    .eq("id", payload.id)
    .select("id")
    .maybeSingle();
  if (error && /showcase_post_url_updated|deliverable_seen_at|PGRST204|42703/i.test(error.message || "")) {
    const soft = { ...update };
    delete soft.showcase_post_url_updated_at;
    delete soft.showcase_post_url_updated_by;
    delete soft.deliverable_seen_at;
    ({ data, error } = await admin
      .from("campaign_applications")
      .update(soft)
      .eq("id", payload.id)
      .select("id")
      .maybeSingle());
  }
  if (error) return { ok: false, reason: "error", message: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, url: parsed.url };
}
