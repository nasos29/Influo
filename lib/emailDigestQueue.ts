/**
 * DB-backed email digest queue (email_digest_queue). Service-role only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DigestType =
  | "brand_campaign_applications"
  | "admin_daily"
  | "admin_campaign_application"
  | "admin_signup_creator"
  | "admin_signup_brand"
  | "admin_profile_edit"
  | "admin_alert_unapproved"
  | "admin_proposal";

export type DigestRecipientKind = "brand" | "admin";

export type DigestQueueRow = {
  id: string;
  digest_type: string;
  recipient_kind: string;
  recipient_id: string | null;
  recipient_email: string | null;
  group_key: string;
  payload: Record<string, unknown>;
  created_at: string;
  flushed_at: string | null;
};

export async function enqueueDigestItem(
  admin: SupabaseClient,
  input: {
    digestType: DigestType;
    recipientKind: DigestRecipientKind;
    recipientId?: string | null;
    recipientEmail?: string | null;
    groupKey: string;
    payload: Record<string, unknown>;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from("email_digest_queue").insert({
    digest_type: input.digestType,
    recipient_kind: input.recipientKind,
    recipient_id: input.recipientId || null,
    recipient_email: (input.recipientEmail || "").trim().toLowerCase() || null,
    group_key: input.groupKey,
    payload: input.payload,
  });
  if (error) {
    console.error("[email_digest_queue] enqueue", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function listPendingDigestItems(
  admin: SupabaseClient,
  opts: { digestType?: DigestType; groupKey?: string; limit?: number } = {}
): Promise<DigestQueueRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  let q = admin
    .from("email_digest_queue")
    .select(
      "id, digest_type, recipient_kind, recipient_id, recipient_email, group_key, payload, created_at, flushed_at"
    )
    .is("flushed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (opts.digestType) q = q.eq("digest_type", opts.digestType);
  if (opts.groupKey) q = q.eq("group_key", opts.groupKey);
  const { data, error } = await q;
  if (error) {
    console.error("[email_digest_queue] list", error.message);
    return [];
  }
  return (data || []) as DigestQueueRow[];
}

export async function markDigestItemsFlushed(
  admin: SupabaseClient,
  ids: string[],
  flushedAt = new Date().toISOString()
): Promise<void> {
  if (!ids.length) return;
  const { error } = await admin
    .from("email_digest_queue")
    .update({ flushed_at: flushedAt })
    .in("id", ids);
  if (error) console.error("[email_digest_queue] flush mark", error.message);
}

/** Oldest unflushed created_at for a group, or null. */
export async function oldestPendingCreatedAt(
  admin: SupabaseClient,
  digestType: DigestType,
  groupKey: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("email_digest_queue")
    .select("created_at")
    .eq("digest_type", digestType)
    .eq("group_key", groupKey)
    .is("flushed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[email_digest_queue] oldest", error.message);
    return null;
  }
  return typeof data?.created_at === "string" ? data.created_at : null;
}

/** Count pending items for a group. */
export async function countPendingForGroup(
  admin: SupabaseClient,
  digestType: DigestType,
  groupKey: string
): Promise<number> {
  const { count, error } = await admin
    .from("email_digest_queue")
    .select("id", { count: "exact", head: true })
    .eq("digest_type", digestType)
    .eq("group_key", groupKey)
    .is("flushed_at", null);
  if (error) {
    console.error("[email_digest_queue] count", error.message);
    return 0;
  }
  return count ?? 0;
}
