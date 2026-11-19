/**
 * Brand campaign-application digest: first app per campaign stays instant;
 * subsequent ones queue and flush ~every BRAND_APPLICATION_DIGEST_HOURS.
 * In-app + push stay instant regardless of flag.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BRAND_APPLICATION_DIGEST_HOURS,
  isBrandApplicationDigestEnabled,
} from "@/lib/emailDigestFlags";
import {
  listPendingDigestItems,
  markDigestItemsFlushed,
  oldestPendingCreatedAt,
} from "@/lib/emailDigestQueue";
import { applicationToBrand } from "@/lib/campaignMail";
import { emailNextSteps } from "@/lib/emailNextSteps";
import { sendChecked, shell, siteUrl } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";

export function brandCampaignGroupKey(campaignId: string): string {
  return `campaign:${campaignId}`;
}

export type BrandAppDigestPayload = {
  applicationId: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  influencerName: string;
  message?: string | null;
  proposedPrice?: number | null;
  workLinks?: string | null;
  at: string;
};

/**
 * Decide whether to send brand application email instantly or queue.
 * Returns "instant" | "queued" | "skipped".
 * First pending+new for a campaign → instant; if any already pending or prior
 * applications existed this session we queue. Caller should pass hasPriorApps.
 */
export async function enqueueOrSendBrandApplicationEmail(
  admin: SupabaseClient,
  input: {
    brandEmail: string;
    brandId?: string | null;
    payload: Omit<BrandAppDigestPayload, "at">;
    brandHasAccount?: boolean;
    /** True when this campaign already had ≥1 application before this one. */
    hasPriorApplications: boolean;
  }
): Promise<"instant" | "queued" | "skipped"> {
  // Product rule: brand application emails are always immediate (never batched).
  void admin;
  void input.hasPriorApplications;
  const email = input.brandEmail.trim().toLowerCase();
  if (!email) return "skipped";
  return "instant";
}

function buildBrandDigestHtml(input: {
  brandName: string;
  campaignTitle: string;
  entries: BrandAppDigestPayload[];
}): { subject: string; html: string } {
  const n = input.entries.length;
  const rows = input.entries
    .map((e) => {
      const price =
        e.proposedPrice != null && Number.isFinite(Number(e.proposedPrice))
          ? ` · ${Math.round(Number(e.proposedPrice))} €`
          : "";
      return `<li><strong>${escapeHtml(e.influencerName)}</strong>${escapeHtml(price)}${
        e.message
          ? `<br/><span style="color:#64748b;font-size:13px;">${escapeHtml(String(e.message).slice(0, 200))}</span>`
          : ""
      }</li>`;
    })
    .join("");
  const subject =
    n === 1
      ? `Νέα αίτηση στην καμπάνια «${input.campaignTitle}»`
      : `${n} νέες αιτήσεις στην καμπάνια «${input.campaignTitle}»`;
  const html = shell(
    subject,
    `<p>Γεια σου ${escapeHtml(input.brandName)},</p>
     <p>${n === 1 ? "Υπάρχει 1 νέα αίτηση" : `Υπάρχουν ${n} νέες αιτήσεις`} στην καμπάνια <strong>${escapeHtml(input.campaignTitle)}</strong>:</p>
     <ul>${rows}</ul>
     <p><a href="${siteUrl()}/brand/dashboard?tab=campaigns">Άνοιξε τις καμπάνιες</a></p>
     ${emailNextSteps("campaign_application_brand")}`
  );
  return { subject, html };
}

export type BrandDigestFlushResult = {
  groups: number;
  sent: number;
  skipped: number;
  errors: string[];
};

/** Flush brand application digests whose oldest item is ≥ N hours old. */
export async function flushBrandApplicationDigests(
  admin: SupabaseClient,
  opts?: { nowMs?: number; dryRun?: boolean; forceHours?: number }
): Promise<BrandDigestFlushResult> {
  if (!isBrandApplicationDigestEnabled()) {
    return { groups: 0, sent: 0, skipped: 0, errors: [] };
  }
  const nowMs = opts?.nowMs ?? Date.now();
  const hours = opts?.forceHours ?? BRAND_APPLICATION_DIGEST_HOURS;
  const minAgeMs = hours * 60 * 60 * 1000;
  const rows = await listPendingDigestItems(admin, {
    digestType: "brand_campaign_applications",
    limit: 400,
  });

  const byGroup = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byGroup.get(row.group_key) || [];
    list.push(row);
    byGroup.set(row.group_key, list);
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [groupKey, items] of byGroup) {
    const oldest = items[0]?.created_at;
    const oldestMs = oldest ? Date.parse(oldest) : NaN;
    if (!Number.isFinite(oldestMs) || nowMs - oldestMs < minAgeMs) {
      skipped += 1;
      continue;
    }
    const email = (items[0]?.recipient_email || "").trim().toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }
    const payloads = items.map((i) => i.payload as unknown as BrandAppDigestPayload);
    const campaignTitle = payloads[0]?.campaignTitle || "Καμπάνια";
    const brandName = payloads[0]?.brandName || "Επιχείρηση";
    const mail = buildBrandDigestHtml({ brandName, campaignTitle, entries: payloads });

    if (opts?.dryRun) {
      skipped += 1;
      continue;
    }
    try {
      let outcome: "ok" | "quota" | "error";
      // Single-item flush can reuse the normal template for nicer UX.
      if (payloads.length === 1) {
        const p = payloads[0];
        const one = applicationToBrand({
          brandEmail: email,
          brandName,
          campaignTitle,
          influencerName: p.influencerName,
          message: p.message ?? null,
          proposedPrice: p.proposedPrice ?? null,
          workLinks: p.workLinks ?? null,
          brandHasAccount: true,
        });
        outcome = await sendChecked("campaign_application_brand_digest", email, one.subject, one.html);
      } else {
        outcome = await sendChecked("campaign_application_brand_digest", email, mail.subject, mail.html);
      }
      if (outcome !== "ok") {
        errors.push(`${groupKey}: send_${outcome}`);
        continue;
      }
      await markDigestItemsFlushed(
        admin,
        items.map((i) => i.id)
      );
      sent += 1;
    } catch (err) {
      errors.push(`${groupKey}: ${err instanceof Error ? err.message : "send failed"}`);
    }
  }

  return { groups: byGroup.size, sent, skipped, errors };
}

export async function peekBrandDigestAgeHours(
  admin: SupabaseClient,
  campaignId: string
): Promise<number | null> {
  const at = await oldestPendingCreatedAt(
    admin,
    "brand_campaign_applications",
    brandCampaignGroupKey(campaignId)
  );
  if (!at) return null;
  return (Date.now() - Date.parse(at)) / (60 * 60 * 1000);
}
