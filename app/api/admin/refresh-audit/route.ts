/**
 * Admin: refresh Gemini audit for one influencer from their current data (no scraping).
 * Called after saving profile edits (followers, engagement_rate, avg_likes) so the audit reflects current data.
 * Uses Gemini API directly (same prompt as Auditpr) – no need for Auditpr to be reachable (e.g. localhost).
 * POST body: { influencerId: string }. Requires GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in env.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAuditGemini, type AuditMetrics } from '@/lib/auditGemini';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type AccountRow = {
  platform?: string;
  username?: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
};

type AuditprAudit = { scoreBreakdown: string[]; brandSafe: boolean; niche?: string };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = (body?.influencerId ?? '').trim();
    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId required' },
        { status: 400 }
      );
    }

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ''
    ).trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set. Set it in env (same key as Auditpr) so the audit runs via Gemini API.',
        },
        { status: 503 }
      );
    }

    const { data: influencer, error: fetchError } = await supabaseAdmin
      .from('influencers')
      .select('id, bio, category, accounts')
      .eq('id', influencerId)
      .single();

    if (fetchError || !influencer) {
      return NextResponse.json(
        { error: fetchError?.message ?? 'Influencer not found' },
        { status: 404 }
      );
    }

    const accounts = (influencer.accounts as AccountRow[] | null) ?? [];
    const firstIg = accounts.find(
      (a) => (a?.platform || '').toLowerCase() === 'instagram' && (a?.username || '').trim()
    );
    const firstTt = accounts.find(
      (a) => (a?.platform || '').toLowerCase() === 'tiktok' && (a?.username || '').trim()
    );
    const acc = firstIg ?? firstTt;
    if (!acc) {
      return NextResponse.json(
        { error: 'No Instagram or TikTok account with username found for this influencer.' },
        { status: 400 }
      );
    }

    const platform = (acc.platform || '').toLowerCase();
    const username = (acc.username || '').trim().replace(/^@+/, '');
    const bio = (influencer.bio as string) ?? '';
    const category = (influencer.category as string) ?? '';

    const metrics: AuditMetrics = {
      followers: acc.followers ?? undefined,
      engagement_rate: acc.engagement_rate ?? undefined,
      avg_likes: acc.avg_likes ?? undefined,
      biography: bio || undefined,
      category_name: category || undefined,
    };

    const auditResult = await runAuditGemini(platform, username, metrics);

    const auditpr_audit: AuditprAudit = {
      scoreBreakdown: auditResult.scoreBreakdown,
      brandSafe: auditResult.brandSafe,
      niche: auditResult.niche,
    };

    const { error: updateError } = await supabaseAdmin
      .from('influencers')
      .update({ auditpr_audit })
      .eq('id', influencerId);

    if (updateError) {
      if (/column.*auditpr_audit/i.test(updateError.message)) {
        return NextResponse.json(
          { error: 'Column auditpr_audit not found. Add it to influencers table (jsonb).' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, auditpr_audit });
  } catch (err: unknown) {
    console.error('[admin refresh-audit]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
