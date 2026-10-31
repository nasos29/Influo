/**
 * POST /api/admin/push/broadcast-influencers
 * Auth: admin session, or Authorization: Bearer ${CRON_SECRET}.
 * Body: { emails: string[], title, body, url? }
 * Sends web push only to push_subscriptions with user_type=influencer
 * whose user_identifier matches one of the emails (case-insensitive).
 * Default url: /dashboard?tab=profile (creator profile editor).
 */

import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/apiAuth";
import { parseInfluencerPushBroadcast } from "@/lib/influencerPushBroadcast";
import { broadcastPushToInfluencerEmails } from "@/lib/push";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request, { allowCronSecret: true });
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseInfluencerPushBroadcast(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const result = await broadcastPushToInfluencerEmails(parsed.emails, {
      title: parsed.title,
      body: parsed.body,
      url: parsed.url,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[admin push broadcast-influencers]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
