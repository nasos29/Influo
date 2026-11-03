import type { SupabaseClient } from "@supabase/supabase-js";

export type SlotInfo = { slots: number | null; filled: number; participants: number };

/**
 * Slots per campaign: `slots` (null = no limit), `filled` = accepted applications,
 * `participants` = accepted + shortlisted + pending (shown when there is no limit).
 * Works before the slots column exists (then every campaign is unlimited).
 */
export async function campaignSlotInfo(admin: SupabaseClient, ids: string[]): Promise<Record<string, SlotInfo>> {
  const out: Record<string, SlotInfo> = {};
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return out;
  for (const id of unique) out[id] = { slots: null, filled: 0, participants: 0 };
  const { data: rows, error } = await admin.from("brand_campaigns").select("id, slots").in("id", unique);
  if (!error) for (const r of rows || []) out[String(r.id)].slots = typeof r.slots === "number" && r.slots > 0 ? r.slots : null;
  const { data: apps } = await admin
    .from("campaign_applications")
    .select("campaign_id, status")
    .in("campaign_id", unique)
    .in("status", ["accepted", "shortlisted", "pending"]);
  for (const a of apps || []) {
    const info = out[String(a.campaign_id)];
    if (!info) continue;
    info.participants += 1;
    if (a.status === "accepted") info.filled += 1;
  }
  return out;
}

export function slotsFull(info: SlotInfo | undefined): boolean {
  return !!info && info.slots != null && info.filled >= info.slots;
}

/** Card label: «2/5 θέσεις», «Οι θέσεις συμπληρώθηκαν», or «N creators συμμετέχουν». */
export function slotLabel(info: SlotInfo | undefined, lang: "el" | "en" = "el"): string | null {
  if (!info) return null;
  if (info.slots != null) {
    if (info.filled >= info.slots) return lang === "el" ? "Οι θέσεις συμπληρώθηκαν" : "All spots are filled";
    return lang === "el" ? `${info.filled}/${info.slots} θέσεις` : `${info.filled}/${info.slots} spots`;
  }
  if (info.participants > 0) return lang === "el" ? `${info.participants} creators συμμετέχουν` : `${info.participants} creators taking part`;
  return null;
}
