import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";
import {
  applicationMeta,
  type CampaignApplicationRow,
} from "@/lib/campaignApplicationAccess";
import {
  canCancelCampaignDeal,
  validateCancelReason,
  type CancelledBy,
} from "@/lib/campaignDealCancelEligibility";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { isCampaignDealCancelEmailsEnabled } from "@/lib/deliveryFlags";
import { onDealCancelled } from "@/lib/dealCancel";
import { brandHasAccount, influencerContact } from "@/lib/proposalAccess";
import { brandLink, mailDealCancelled } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";

export {
  canCancelCampaignDeal,
  validateCancelReason,
  CANCEL_REASON_MIN,
  type CancelledBy,
} from "@/lib/campaignDealCancelEligibility";

async function notifyParties(
  application: CampaignApplicationRow,
  cancelledBy: CancelledBy,
  reason: string
): Promise<void> {
  const meta = applicationMeta(application);
  const influencer = await influencerContact(application.influencer_id);
  const snippet = reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;
  const pushes: Promise<void>[] = [];

  if (cancelledBy === "brand") {
    pushes.push(
      pushParty({
        type: "campaign_deal_cancelled",
        side: "influencer",
        influencerId: application.influencer_id,
        brandEmail: meta.brandEmail,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `${meta.brandName} ακύρωσε τη συμφωνία καμπάνιας. ${snippet}`,
          url: "/dashboard?tab=campaigns",
          tag: "campaign-deal-cancelled",
        },
      })
    );
  } else if (cancelledBy === "influencer") {
    pushes.push(
      pushParty({
        type: "campaign_deal_cancelled",
        side: "brand",
        influencerId: application.influencer_id,
        brandEmail: meta.brandEmail,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `${influencer.name} ακύρωσε τη συμφωνία καμπάνιας. ${snippet}`,
          url: "/brand/dashboard?tab=campaigns",
          tag: "campaign-deal-cancelled",
        },
      })
    );
  } else {
    pushes.push(
      pushParty({
        type: "campaign_deal_cancelled",
        side: "influencer",
        influencerId: application.influencer_id,
        brandEmail: meta.brandEmail,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `Η ομάδα Influo ακύρωσε τη συμφωνία καμπάνιας. ${snippet}`,
          url: "/dashboard?tab=campaigns",
          tag: "campaign-deal-cancelled",
        },
      }),
      pushParty({
        type: "campaign_deal_cancelled",
        side: "brand",
        influencerId: application.influencer_id,
        brandEmail: meta.brandEmail,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `Η ομάδα Influo ακύρωσε τη συμφωνία καμπάνιας. ${snippet}`,
          url: "/brand/dashboard?tab=campaigns",
          tag: "campaign-deal-cancelled",
        },
      })
    );
  }

  await Promise.all(pushes);
}

async function emailParties(
  application: CampaignApplicationRow,
  cancelledBy: CancelledBy,
  reason: string
): Promise<void> {
  if (!isCampaignDealCancelEmailsEnabled()) return;

  const meta = applicationMeta(application);
  const influencer = await influencerContact(application.influencer_id);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  const amount =
    application.proposed_price != null ? String(application.proposed_price) : "";
  const common = {
    proposalId: application.id,
    service: meta.campaignTitle,
    budget: amount,
    publishDeadline: meta.deadline,
    reason,
    cancelledBy,
    brandName: meta.brandName,
    creatorName: influencer.name,
  };

  const tasks: Promise<void>[] = [];

  if (cancelledBy === "brand" && !isCollabEmailExcludedInfluencer(application.influencer_id)) {
    tasks.push(
      mailDealCancelled({
        ...common,
        to: influencer.email,
        toBrand: false,
        recipientName: influencer.name,
        ctaUrl: `${site}/dashboard?tab=campaigns`,
      })
    );
  } else if (cancelledBy === "influencer" && meta.brandEmail) {
    tasks.push(
      mailDealCancelled({
        ...common,
        to: meta.brandEmail,
        toBrand: true,
        recipientName: meta.brandName,
        ctaUrl: brandLink(meta.brandEmail, await brandHasAccount(meta.brandEmail)),
      })
    );
  } else if (cancelledBy === "admin") {
    if (!isCollabEmailExcludedInfluencer(application.influencer_id)) {
      tasks.push(
        mailDealCancelled({
          ...common,
          to: influencer.email,
          toBrand: false,
          recipientName: influencer.name,
          ctaUrl: `${site}/dashboard?tab=campaigns`,
        })
      );
    }
    if (meta.brandEmail) {
      tasks.push(
        mailDealCancelled({
          ...common,
          to: meta.brandEmail,
          toBrand: true,
          recipientName: meta.brandName,
          ctaUrl: brandLink(meta.brandEmail, await brandHasAccount(meta.brandEmail)),
        })
      );
    }
  }

  await Promise.all(tasks.map((p) => p.catch((e) => console.error("[campaign-deal-cancel mail]", e))));
}

export async function cancelCampaignDeal(args: {
  admin?: SupabaseClient;
  application: CampaignApplicationRow;
  cancelledBy: CancelledBy;
  reason: unknown;
}): Promise<{ ok: true; cancelledAt: string } | { ok: false; status: number; error: string }> {
  const validated = validateCancelReason(args.reason);
  if (!validated.ok) {
    return { ok: false, status: 400, error: validated.error };
  }
  if (!canCancelCampaignDeal(args.application)) {
    return { ok: false, status: 409, error: "deal_not_cancellable" };
  }

  const cancelledAt = new Date().toISOString();
  const db = args.admin ?? supabaseService();
  const { data, error } = await db
    .from("campaign_applications")
    .update({
      status: "cancelled",
      cancelled_by: args.cancelledBy,
      cancel_reason: validated.reason,
      cancelled_at: cancelledAt,
    })
    .eq("id", args.application.id)
    .eq("status", "accepted")
    .select("id")
    .maybeSingle();

  if (error) {
    if (/cancelled_|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
      return { ok: false, status: 503, error: "migration_pending" };
    }
    return { ok: false, status: 500, error: error.message };
  }
  if (!data?.id) {
    return { ok: false, status: 409, error: "deal_not_cancellable" };
  }

  const updated = {
    ...args.application,
    status: "cancelled",
    cancelled_by: args.cancelledBy,
    cancel_reason: validated.reason,
    cancelled_at: cancelledAt,
  };

  deferAfterResponse(async () => {
    await notifyParties(args.application, args.cancelledBy, validated.reason);
    await emailParties(args.application, args.cancelledBy, validated.reason);
    await onDealCancelled({
      source: "campaign",
      application: updated,
      cancelledBy: args.cancelledBy,
      reason: validated.reason,
    });
  });

  return { ok: true, cancelledAt };
}