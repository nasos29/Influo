import { supabase } from "@/lib/supabaseClient";

export type ApplyInput = {
  campaignId: string;
  influencerId: string;
  message: string;
  proposedPrice?: string;
  workLinks?: string;
};

export async function submitCampaignApplication(
  input: ApplyInput
): Promise<{ id?: string; error?: string; duplicate?: boolean; migration?: boolean }> {
  const price = input.proposedPrice?.trim() ? Number(input.proposedPrice.replace(",", ".")) : null;
  const links = input.workLinks?.trim() || null;
  const base = {
    campaign_id: input.campaignId,
    influencer_id: input.influencerId,
    message: input.message.trim() || null,
    status: "pending" as const,
  };
  const full: Record<string, unknown> = { ...base };
  if (price != null && Number.isFinite(price) && price >= 0) full.proposed_price = price;
  if (links) full.work_links = links;

  let result = await supabase.from("campaign_applications").insert(full).select("id").single();
  if (result.error && /proposed_price|work_links|schema cache|column/i.test(result.error.message)) {
    result = await supabase.from("campaign_applications").insert(base).select("id").single();
    if (!result.error) return { id: result.data?.id, migration: true };
  }
  if (result.error) {
    if (result.error.code === "23505") return { duplicate: true, error: result.error.message };
    return { error: result.error.message };
  }
  return { id: result.data?.id };
}

export async function notifyBrandOfApplication(applicationId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/campaign-application", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ applicationId }),
  }).catch(() => undefined);
}
