/**
 * Single place for deal (agreement) cancellation after work has started.
 * Payment / fee settlement should hook into `onDealCancelled` when implemented.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";
import {
  canCancelDeal,
  canWithdrawPendingProposal,
  validateCancelReason,
  validateWithdrawReason,
  type CancelledBy,
  type DealCancelGate,
} from "@/lib/dealCancelEligibility";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { isDealCancelEmailsEnabled } from "@/lib/deliveryFlags";
import { brandHasAccount, influencerContact, type ProposalRow } from "@/lib/proposalAccess";
import { brandLink, mailDealCancelled } from "@/lib/proposalMail";
import { deferAfterResponse, conversationIdForParties, pushParty } from "@/lib/proposalNotify";

export {
  canCancelDeal,
  canWithdrawPendingProposal,
  validateCancelReason,
  validateWithdrawReason,
  CANCEL_REASON_MIN,
  CANCEL_REASON_MAX,
  type CancelledBy,
  type DealCancelGate,
} from "@/lib/dealCancelEligibility";

export type DealCancelledHookArgs = {
  proposal: ProposalRow & {
    cancelled_by: CancelledBy;
    cancel_reason: string;
    cancelled_at: string;
  };
  cancelledBy: CancelledBy;
  reason: string;
};

/**
 * Post-cancel hook for payments, fees, and ledger updates.
 * Called after the row is persisted and in-app notifications are queued.
 */
export async function onDealCancelled(_args: DealCancelledHookArgs): Promise<void> {
  // Future payment/fee settlement hooks here.
}

async function insertThreadNotice(args: {
  influencerId: string;
  brandEmail: string | null | undefined;
  cancelledBy: CancelledBy;
  reason: string;
  brandName: string;
}): Promise<void> {
  const conversationId = await conversationIdForParties(args.influencerId, args.brandEmail);
  if (!conversationId) return;

  const email = (args.brandEmail || "").trim().toLowerCase();
  if (!email.includes("@")) return;

  const byLabel =
    args.cancelledBy === "brand"
      ? `Η επιχείρηση ${args.brandName} ακύρωσε τη συμφωνία.`
      : args.cancelledBy === "influencer"
        ? "Ο δημιουργός ακύρωσε τη συμφωνία."
        : "Η ομάδα Influo ακύρωσε τη συμφωνία.";
  const content = `${byLabel} Λόγος: ${args.reason}`.slice(0, 5000);

  const senderType = args.cancelledBy === "influencer" ? "influencer" : "brand";
  const senderId = senderType === "brand" ? email : args.influencerId;
  const now = new Date().toISOString();
  const admin = supabaseService();

  const payload: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    sender_type: senderType,
    content,
    read: false,
    sent_via_email: false,
    email_sent: true,
    admin_notified: true,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await admin.from("messages").insert([payload]);
    if (!result.error) {
      const activity =
        senderType === "brand"
          ? { last_message_at: now, last_activity_brand: now }
          : { last_message_at: now, last_activity_influencer: now };
      await admin.from("conversations").update(activity).eq("id", conversationId);
      return;
    }
    const message = result.error.message || "";
    if (/attachments/i.test(message) && "attachments" in payload) {
      delete payload.attachments;
      continue;
    }
    if (/email_sent/i.test(message) && "email_sent" in payload) {
      delete payload.email_sent;
      continue;
    }
    if (/admin_notified/i.test(message) && "admin_notified" in payload) {
      delete payload.admin_notified;
      continue;
    }
    if (/sent_via_email/i.test(message) && "sent_via_email" in payload) {
      delete payload.sent_via_email;
      continue;
    }
    console.error("[deal-cancel thread]", message);
    return;
  }
}

async function notifyParties(proposal: ProposalRow, cancelledBy: CancelledBy, reason: string): Promise<void> {
  const influencer = await influencerContact(proposal.influencer_id);
  const brandName = proposal.brand_name || "Επιχείρηση";
  const email = proposal.brand_email;
  const snippet = reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;

  const pushes: Promise<void>[] = [];

  if (cancelledBy === "brand") {
    pushes.push(
      pushParty({
        type: "deal_cancelled",
        side: "influencer",
        influencerId: proposal.influencer_id,
        brandEmail: email,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `${brandName} ακύρωσε τη συμφωνία. ${snippet}`,
          url: "/dashboard?tab=proposals",
          tag: "deal-cancelled",
        },
      })
    );
  } else if (cancelledBy === "influencer") {
    pushes.push(
      pushParty({
        type: "deal_cancelled",
        side: "brand",
        influencerId: proposal.influencer_id,
        brandEmail: email,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `${influencer.name} ακύρωσε τη συμφωνία. ${snippet}`,
          url: "/brand/dashboard?tab=proposals",
          tag: "deal-cancelled",
        },
      })
    );
  } else {
    pushes.push(
      pushParty({
        type: "deal_cancelled",
        side: "influencer",
        influencerId: proposal.influencer_id,
        brandEmail: email,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `Η ομάδα Influo ακύρωσε τη συμφωνία. ${snippet}`,
          url: "/dashboard?tab=proposals",
          tag: "deal-cancelled",
        },
      }),
      pushParty({
        type: "deal_cancelled",
        side: "brand",
        influencerId: proposal.influencer_id,
        brandEmail: email,
        payload: {
          title: "Ακύρωση συμφωνίας",
          body: `Η ομάδα Influo ακύρωσε τη συμφωνία. ${snippet}`,
          url: "/brand/dashboard?tab=proposals",
          tag: "deal-cancelled",
        },
      })
    );
  }

  await Promise.all([
    ...pushes,
    insertThreadNotice({
      influencerId: proposal.influencer_id,
      brandEmail: email,
      cancelledBy,
      reason,
      brandName,
    }),
  ]);
}

async function emailParties(proposal: ProposalRow, cancelledBy: CancelledBy, reason: string): Promise<void> {
  if (!isDealCancelEmailsEnabled()) return;

  const influencer = await influencerContact(proposal.influencer_id);
  const brandName = proposal.brand_name || "Επιχείρηση";
  const email = proposal.brand_email;
  const amount =
    proposal.counter_proposal_status === "accepted" && proposal.counter_proposal_budget
      ? String(proposal.counter_proposal_budget)
      : String(proposal.budget || "");
  const common = {
    proposalId: proposal.id,
    service: proposal.service_type || "",
    budget: amount,
    extras: proposal.selected_extras,
    publishDeadline: proposal.publish_deadline,
    reason,
    cancelledBy,
    brandName,
    creatorName: influencer.name,
  };

  const tasks: Promise<void>[] = [];

  if (cancelledBy === "brand" && !isCollabEmailExcludedInfluencer(proposal.influencer_id)) {
    tasks.push(
      mailDealCancelled({
        ...common,
        to: influencer.email,
        toBrand: false,
        recipientName: influencer.name,
        ctaUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "")}/dashboard?tab=proposals`,
      })
    );
  } else if (cancelledBy === "influencer" && email) {
    tasks.push(
      mailDealCancelled({
        ...common,
        to: email,
        toBrand: true,
        recipientName: brandName,
        ctaUrl: brandLink(email, await brandHasAccount(email)),
      })
    );
  } else if (cancelledBy === "admin") {
    if (!isCollabEmailExcludedInfluencer(proposal.influencer_id)) {
      tasks.push(
        mailDealCancelled({
          ...common,
          to: influencer.email,
          toBrand: false,
          recipientName: influencer.name,
          ctaUrl: `${(process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "")}/dashboard?tab=proposals`,
        })
      );
    }
    if (email) {
      tasks.push(
        mailDealCancelled({
          ...common,
          to: email,
          toBrand: true,
          recipientName: brandName,
          ctaUrl: brandLink(email, await brandHasAccount(email)),
        })
      );
    }
  }

  await Promise.all(tasks.map((p) => p.catch((e) => console.error("[deal-cancel mail]", e))));
}

async function notifyWithdrawInApp(proposal: ProposalRow, reason: string | null): Promise<void> {
  const influencer = await influencerContact(proposal.influencer_id);
  const brandName = proposal.brand_name || "Επιχείρηση";
  const email = proposal.brand_email;
  const snippet = reason ? (reason.length > 120 ? `${reason.slice(0, 117)}…` : reason) : "";

  await pushParty({
    type: "proposal_withdrawn",
    side: "influencer",
    influencerId: proposal.influencer_id,
    brandEmail: email,
    payload: {
      title: "Απόσυρση πρότασης",
      body: snippet
        ? `${brandName} απέσυρε την πρόταση. ${snippet}`
        : `${brandName} απέσυρε την πρόταση.`,
      url: "/dashboard?tab=proposals",
      tag: `proposal-withdrawn-${proposal.id}`,
    },
  });
}

export async function withdrawPendingDeal(args: {
  admin?: SupabaseClient;
  proposal: ProposalRow;
  reason?: unknown;
}): Promise<{ ok: true; cancelledAt: string } | { ok: false; status: number; error: string }> {
  const validated = validateWithdrawReason(args.reason);
  if (!validated.ok) {
    return { ok: false, status: 400, error: validated.error };
  }
  if (!canWithdrawPendingProposal(args.proposal)) {
    return { ok: false, status: 409, error: "proposal_not_withdrawable" };
  }

  const cancelledAt = new Date().toISOString();
  const db = args.admin ?? supabaseService();
  const cancelReason = validated.reason;
  const { data, error } = await db
    .from("proposals")
    .update({
      status: "cancelled",
      cancelled_by: "brand",
      cancel_reason: cancelReason,
      cancelled_at: cancelledAt,
    })
    .eq("id", args.proposal.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data?.id) {
    return { ok: false, status: 409, error: "proposal_not_withdrawable" };
  }

  deferAfterResponse(async () => {
    await notifyWithdrawInApp(args.proposal, cancelReason);
  });

  return { ok: true, cancelledAt };
}

export async function cancelDeal(args: {
  admin?: SupabaseClient;
  proposal: ProposalRow;
  cancelledBy: CancelledBy;
  reason: unknown;
}): Promise<{ ok: true; cancelledAt: string } | { ok: false; status: number; error: string }> {
  const validated = validateCancelReason(args.reason);
  if (!validated.ok) {
    return { ok: false, status: 400, error: validated.error };
  }
  if (!canCancelDeal(args.proposal)) {
    return { ok: false, status: 409, error: "deal_not_cancellable" };
  }

  const cancelledAt = new Date().toISOString();
  const db = args.admin ?? supabaseService();
  const { data, error } = await db
    .from("proposals")
    .update({
      status: "cancelled",
      cancelled_by: args.cancelledBy,
      cancel_reason: validated.reason,
      cancelled_at: cancelledAt,
    })
    .eq("id", args.proposal.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data?.id) {
    return { ok: false, status: 409, error: "deal_not_cancellable" };
  }

  const updated = {
    ...args.proposal,
    status: "cancelled",
    cancelled_by: args.cancelledBy,
    cancel_reason: validated.reason,
    cancelled_at: cancelledAt,
  };

  deferAfterResponse(async () => {
    await notifyParties(args.proposal, args.cancelledBy, validated.reason);
    await emailParties(args.proposal, args.cancelledBy, validated.reason);
    await onDealCancelled({
      proposal: updated as DealCancelledHookArgs["proposal"],
      cancelledBy: args.cancelledBy,
      reason: validated.reason,
    });
  });

  return { ok: true, cancelledAt };
}