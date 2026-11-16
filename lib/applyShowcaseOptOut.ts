/**
 * Apply one-click showcase opt-out for a signed token payload (service role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  consentColumnForParty,
  optedOutColumnForParty,
  type ShowcaseOptOutPayload,
} from "@/lib/showcaseOptOut";

export type ApplyShowcaseOptOutResult =
  | { ok: true; source: ShowcaseOptOutPayload["source"]; id: string; party: ShowcaseOptOutPayload["party"] }
  | { ok: false; reason: "not_found" | "db_error"; message?: string };

export async function applyShowcaseOptOut(
  admin: SupabaseClient,
  payload: ShowcaseOptOutPayload
): Promise<ApplyShowcaseOptOutResult> {
  const table = payload.source === "proposal" ? "proposals" : "campaign_applications";
  const consentCol = consentColumnForParty(payload.party);
  const optedOutCol = optedOutColumnForParty(payload.party);
  const update: Record<string, unknown> = {
    [consentCol]: false,
    [optedOutCol]: true,
  };

  const { data, error } = await admin
    .from(table)
    .update(update)
    .eq("id", payload.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (/showcase_opted_out|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
      // Migration not applied yet — still clear consent if possible.
      const { data: fallback, error: fallbackErr } = await admin
        .from(table)
        .update({ [consentCol]: false })
        .eq("id", payload.id)
        .select("id")
        .maybeSingle();
      if (fallbackErr) {
        return { ok: false, reason: "db_error", message: fallbackErr.message };
      }
      if (!fallback) return { ok: false, reason: "not_found" };
      return { ok: true, source: payload.source, id: payload.id, party: payload.party };
    }
    return { ok: false, reason: "db_error", message: error.message };
  }
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true, source: payload.source, id: payload.id, party: payload.party };
}
