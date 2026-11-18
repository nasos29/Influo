/**
 * Permanently stop review + post-link prompts for one party on one collaboration.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewDeclinePayload, ReviewParty } from "@/lib/reviewInvite";

export type ApplyReviewDeclineResult =
  | { ok: true; source: ReviewDeclinePayload["source"]; id: string; party: ReviewParty }
  | { ok: false; reason: "not_found" | "db_error"; message?: string };

function declineColumn(party: ReviewParty): string {
  return party === "brand"
    ? "brand_review_prompts_declined_at"
    : "influencer_review_prompts_declined_at";
}

export async function applyReviewDecline(
  admin: SupabaseClient,
  payload: ReviewDeclinePayload,
  declinedAt = new Date().toISOString()
): Promise<ApplyReviewDeclineResult> {
  const table = payload.source === "campaign" ? "campaign_applications" : "proposals";
  const col = declineColumn(payload.party);
  const { data, error } = await admin
    .from(table)
    .update({ [col]: declinedAt })
    .eq("id", payload.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (/review_prompts_declined|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
      return { ok: false, reason: "db_error", message: error.message };
    }
    return { ok: false, reason: "db_error", message: error.message };
  }
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, source: payload.source, id: payload.id, party: payload.party };
}
