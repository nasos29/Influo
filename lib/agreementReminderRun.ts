import type { SupabaseClient } from "@supabase/supabase-js";
import { agreementReminderTarget, type AgreementReminderRow } from "@/lib/agreementReminder";
import { brandHasAccount, influencerContact } from "@/lib/proposalAccess";
import { mailAgreementReminder } from "@/lib/proposalMail";

type Row = AgreementReminderRow & {
  id: string | number;
  brand_name: string | null;
  brand_email: string | null;
  influencer_id: string;
  service_type: string | null;
  budget: string | null;
  counter_proposal_budget: string | null;
  counter_proposal_status: string | null;
  selected_extras: unknown;
  publish_deadline: string | null;
};

const SELECT_COLS =
  "id, status, brand_name, brand_email, influencer_id, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, influencer_agreement_accepted, brand_agreement_accepted, influencer_agreement_accepted_at, brand_agreement_accepted_at, agreement_reminder_sent_at";

function dealAmount(row: Row): string {
  if (row.counter_proposal_status === "accepted" && row.counter_proposal_budget) {
    return String(row.counter_proposal_budget);
  }
  return String(row.budget || "");
}

/** Atomically claim one proposal (true only for the caller that set the stamp). */
export async function claimAgreementReminder(
  admin: SupabaseClient,
  proposalId: string | number,
  sentAt = new Date().toISOString()
): Promise<boolean> {
  const { data, error } = await admin
    .from("proposals")
    .update({ agreement_reminder_sent_at: sentAt })
    .eq("id", proposalId)
    .is("agreement_reminder_sent_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[agreement-reminders] claim failed", proposalId, error.message);
    return false;
  }
  return !!data?.id;
}

async function releaseClaim(admin: SupabaseClient, proposalId: string | number): Promise<void> {
  const { error } = await admin.from("proposals").update({ agreement_reminder_sent_at: null }).eq("id", proposalId);
  if (error) console.error("[agreement-reminders] release failed", proposalId, error.message);
}

/** Daily: remind the side that has not accepted the agreement yet (48–96h window, once per deal). */
export async function runAgreementReminders(
  admin: SupabaseClient,
  opts?: { nowMs?: number; limit?: number }
): Promise<{ checked: number; due: number; sent: number; errors: string[] }> {
  const nowMs = opts?.nowMs ?? Date.now();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const errors: string[] = [];

  const { data, error } = await admin
    .from("proposals")
    .select(SELECT_COLS)
    .in("status", ["accepted", "completed"])
    .is("agreement_reminder_sent_at", null)
    .or(
      "and(influencer_agreement_accepted.eq.true,brand_agreement_accepted.eq.false),and(influencer_agreement_accepted.eq.false,brand_agreement_accepted.eq.true)"
    )
    .limit(200);
  if (error) return { checked: 0, due: 0, sent: 0, errors: [error.message] };

  const rows = (data || []) as Row[];
  let due = 0;
  let sent = 0;

  for (const row of rows) {
    if (sent >= limit) break;
    const target = agreementReminderTarget(row, nowMs);
    if (!target) continue;
    due += 1;
    if (!(await claimAgreementReminder(admin, row.id))) continue;

    const brandName = row.brand_name || "Επιχείρηση";
    const common = {
      service: row.service_type || "",
      budget: dealAmount(row),
      proposalId: row.id,
      extras: row.selected_extras,
      publishDeadline: row.publish_deadline,
    };
    try {
      const influencer = await influencerContact(row.influencer_id);
      const brandEmail = (row.brand_email || "").trim();
      const result =
        target === "brand"
          ? await mailAgreementReminder({
              ...common,
              to: brandEmail || null,
              recipientName: brandName,
              otherName: influencer.name,
              toBrand: true,
              brandHasAccount: brandEmail ? await brandHasAccount(brandEmail) : false,
            })
          : await mailAgreementReminder({
              ...common,
              to: influencer.email,
              recipientName: influencer.name,
              otherName: brandName,
              toBrand: false,
              brandHasAccount: false,
            });
      if (result === "ok") {
        sent += 1;
      } else {
        await releaseClaim(admin, row.id);
        errors.push(`#${row.id}: send ${result}`);
      }
    } catch (err) {
      await releaseClaim(admin, row.id);
      const message = err instanceof Error ? err.message : "send failed";
      errors.push(`#${row.id}: ${message}`);
      console.error("[agreement-reminders]", row.id, message);
    }
  }

  return { checked: rows.length, due, sent, errors };
}
