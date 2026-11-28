import type { SupabaseClient } from "@supabase/supabase-js";
import { campaignRequiresUgcDraft, proposalRequiresUgcDraft } from "@/lib/collaborationUgc";

export async function maySubmitPublishedPostLink(
  admin: SupabaseClient,
  source: "proposal" | "campaign",
  id: string
): Promise<{ ok: true } | { ok: false; code: "draft_required" | "draft_not_approved" }> {
  if (source === "proposal") {
    const { data } = await admin
      .from("proposals")
      .select(
        "service_type, selected_extras, message, deliverable_draft_status"
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return { ok: true };
    if (!proposalRequiresUgcDraft(data)) return { ok: true };
    const st = String(data.deliverable_draft_status || "").toLowerCase();
    if (!st) return { ok: false, code: "draft_required" };
    if (st !== "approved") return { ok: false, code: "draft_not_approved" };
    return { ok: true };
  }
  const { data } = await admin
    .from("campaign_applications")
    .select(
      "deliverable_draft_status, brand_campaigns ( deliverables, deliverables_en, platforms )"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: true };
  const raw = data.brand_campaigns as unknown;
  const campaign = (Array.isArray(raw) ? raw[0] : raw) as {
    deliverables?: string;
    deliverables_en?: string;
    platforms?: string[];
  } | null;
  if (!campaign || !campaignRequiresUgcDraft(campaign)) return { ok: true };
  const st = String(data.deliverable_draft_status || "").toLowerCase();
  if (!st) return { ok: false, code: "draft_required" };
  if (st !== "approved") return { ok: false, code: "draft_not_approved" };
  return { ok: true };
}