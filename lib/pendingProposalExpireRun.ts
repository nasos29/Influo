/**
 * Cron (PENDING_PROPOSAL_EXPIRE_ENABLED): cancel stale pending proposals.
 * In-app notify only — never email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPendingProposalExpireEnabled,
  PENDING_EXPIRED_CANCEL_REASON,
  pendingProposalExpireDays,
} from "@/lib/deliveryFlags";
import { influencerContact } from "@/lib/proposalAccess";
import { pushParty } from "@/lib/proposalNotify";

type Row = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
};

export async function runPendingProposalExpire(
  admin: SupabaseClient,
  opts?: { nowMs?: number; limit?: number }
): Promise<{ expired: number; skipped: number; errors: string[]; enabled: boolean }> {
  const enabled = isPendingProposalExpireEnabled();
  if (!enabled) {
    return { expired: 0, skipped: 0, errors: [], enabled: false };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const days = pendingProposalExpireDays();
  const cutoff = new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
  const errors: string[] = [];
  let expired = 0;
  let skipped = 0;

  const { data, error } = await admin
    .from("proposals")
    .select("id, influencer_id, brand_name, brand_email")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return { expired: 0, skipped: 0, errors: [error.message], enabled: true };
  }

  const cancelledAt = new Date(nowMs).toISOString();

  for (const row of (data || []) as Row[]) {
    if (expired >= limit) break;

    const { data: claimed, error: claimErr } = await admin
      .from("proposals")
      .update({
        status: "cancelled",
        cancelled_at: cancelledAt,
        cancel_reason: PENDING_EXPIRED_CANCEL_REASON,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed?.id) {
      skipped += 1;
      continue;
    }

    expired += 1;

    try {
      const influencer = await influencerContact(row.influencer_id);
      const brandName = row.brand_name || "Επιχείρηση";
      const email = row.brand_email;
      await Promise.all([
        pushParty({
          type: "proposal_expired",
          side: "influencer",
          influencerId: row.influencer_id,
          brandEmail: email,
          payload: {
            title: "Λήξη πρότασης",
            body: `Η πρόταση από ${brandName} έληξε χωρίς απάντηση.`,
            url: "/dashboard?tab=proposals",
            tag: `proposal-expired-${row.id}`,
          },
        }),
        pushParty({
          type: "proposal_expired",
          side: "brand",
          influencerId: row.influencer_id,
          brandEmail: email,
          payload: {
            title: "Λήξη πρότασης",
            body: `Η πρόταση προς ${influencer.name} έληξε χωρίς απάντηση.`,
            url: "/brand/dashboard?tab=proposals",
            tag: `proposal-expired-brand-${row.id}`,
          },
        }),
      ]);
    } catch (err) {
      errors.push(`notify ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
    }
  }

  return { expired, skipped, errors, enabled: true };
}