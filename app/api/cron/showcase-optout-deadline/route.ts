/**
 * After showcase_optout_deadline: set consent=true for parties that did not opt out.
 * Auth: CRON_SECRET / Vercel cron. No emails.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";

export const runtime = "nodejs";
export const maxDuration = 120;

async function applyDeadline(
  table: "proposals" | "campaign_applications",
  nowIso: string
): Promise<{ brand: number; influencer: number; errors: string[] }> {
  const admin = cronSupabaseAdmin();
  const errors: string[] = [];
  let brand = 0;
  let influencer = 0;

  const { data: rows, error } = await admin
    .from(table)
    .select(
      "id, brand_showcase_consent, influencer_showcase_consent, brand_showcase_opted_out, influencer_showcase_opted_out, showcase_optout_deadline, showcase_notice_sent_at"
    )
    .not("showcase_notice_sent_at", "is", null)
    .lte("showcase_optout_deadline", nowIso)
    .limit(200);

  if (error) {
    if (/showcase_optout_deadline|showcase_notice_sent_at|opted_out|schema cache|42703|PGRST204/i.test(
      error.message || ""
    )) {
      return { brand: 0, influencer: 0, errors: [`schema_pending:${table}`] };
    }
    return { brand: 0, influencer: 0, errors: [error.message] };
  }

  for (const row of rows || []) {
    const update: Record<string, unknown> = {};
    if (!row.brand_showcase_opted_out && !row.brand_showcase_consent) {
      update.brand_showcase_consent = true;
    }
    if (!row.influencer_showcase_opted_out && !row.influencer_showcase_consent) {
      update.influencer_showcase_consent = true;
    }
    if (Object.keys(update).length === 0) continue;
    const { error: updErr } = await admin.from(table).update(update).eq("id", row.id);
    if (updErr) {
      errors.push(`${table}:${row.id}:${updErr.message}`);
      continue;
    }
    if (update.brand_showcase_consent) brand += 1;
    if (update.influencer_showcase_consent) influencer += 1;
  }

  return { brand, influencer, errors };
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const nowIso = new Date().toISOString();
  const proposals = await applyDeadline("proposals", nowIso);
  const campaigns = await applyDeadline("campaign_applications", nowIso);

  return NextResponse.json({
    ok: true,
    at: nowIso,
    proposals,
    campaigns,
  });
}
