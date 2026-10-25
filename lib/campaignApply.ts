import { supabase } from "@/lib/supabaseClient";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";

export type ApplyInput = {
  campaignId: string;
  influencerId: string;
  message: string;
  proposedPrice?: string;
  workLinks?: string;
};

export async function submitCampaignApplication(
  input: ApplyInput
): Promise<{
  id?: string;
  error?: string;
  duplicate?: boolean;
  migration?: boolean;
  contactField?: string;
  rejectedLinks?: string[];
}> {
  const contactHit = findContactInfo(input.message || "");
  if (contactHit) {
    return { error: "contact_info_not_allowed", contactField: "message" };
  }
  const filtered = filterWorkLinks(input.workLinks || "");
  if (filtered.rejected.length > 0) {
    return { error: "work_link_not_allowed", rejectedLinks: filtered.rejected };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: "Unauthorized" };

  const res = await fetch("/api/campaigns/application", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      message: input.message,
      proposedPrice: input.proposedPrice,
      workLinks: filtered.ok.length ? filtered.ok.join("\n") : "",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
    duplicate?: boolean;
    migration?: boolean;
    field?: string;
    rejected?: string[];
  };

  if (res.status === 409 || body.duplicate) {
    return { duplicate: true, error: body.error || "duplicate" };
  }
  if (!res.ok) {
    if (body.error === "contact_info_not_allowed") {
      return { error: "contact_info_not_allowed", contactField: body.field || "message" };
    }
    if (body.error === "work_link_not_allowed") {
      return { error: "work_link_not_allowed", rejectedLinks: body.rejected || [] };
    }
    return { error: body.error || "Error" };
  }
  return { id: body.id, migration: body.migration };
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
