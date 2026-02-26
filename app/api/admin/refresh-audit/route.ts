/**
 * Admin: refresh Gemini audit for one influencer from their current data (no scraping).
 * Called after saving profile edits (followers, engagement_rate, avg_likes) so the audit reflects current data.
 * Uses Gemini API directly (same prompt as Auditpr) – no need for Auditpr to be reachable (e.g. localhost).
 * POST body: { influencerId: string }. Requires GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in env.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAuditGemini, type AuditAccount, type AuditShared } from '@/lib/auditGemini';

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

type AuditprAudit = {
  scoreBreakdown: string[];
  scoreBreakdown_en?: string[];
  whyWorkWithThem?: string;
  whyWorkWithThem_en?: string;
  positives?: string[];
  positives_en?: string[];
  negatives?: string[];
  negatives_en?: string[];
  brandSafe: boolean;
  niche?: string;
  niche_en?: string;
};

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
      .select('id, display_name, gender, bio, category, accounts')
      .eq('id', influencerId)
      .single();

    if (fetchError || !influencer) {
      return NextResponse.json(
        { error: fetchError?.message ?? 'Influencer not found' },
        { status: 404 }
      );
    }

    const accounts = (influencer.accounts as AccountRow[] | null) ?? [];
    const igTtAccounts: AuditAccount[] = accounts
      .filter(
        (a) =>
          (a?.platform || '').trim() &&
          (a?.username || '').trim() &&
          ['instagram', 'tiktok', 'youtube'].includes((a.platform || '').toLowerCase())
      )
      .map((a) => ({
        platform: (a.platform || '').trim().toLowerCase(),
        username: (a.username || '').trim().replace(/^@+/, ''),
        followers: a.followers ?? undefined,
        engagement_rate: a.engagement_rate ?? undefined,
        avg_likes: a.avg_likes ?? undefined,
      }));

    if (igTtAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No Instagram, TikTok, or YouTube account with username found for this influencer.' },
        { status: 400 }
      );
    }

    const shared: AuditShared = {
      biography: (influencer.bio as string) ?? undefined,
      category_name: (influencer.category as string) ?? undefined,
      display_name: (influencer.display_name as string) ?? undefined,
      gender: (influencer.gender as string) ?? undefined,
    };

    const auditResult = await runAuditGemini(igTtAccounts, shared);

    const auditpr_audit: AuditprAudit = {
      scoreBreakdown: auditResult.scoreBreakdown,
      scoreBreakdown_en: auditResult.scoreBreakdown_en,
      whyWorkWithThem: auditResult.whyWorkWithThem,
      whyWorkWithThem_en: auditResult.whyWorkWithThem_en,
      positives: auditResult.positives,
      positives_en: auditResult.positives_en,
      negatives: auditResult.negatives,
      negatives_en: auditResult.negatives_en,
      brandSafe: auditResult.brandSafe,
      niche: auditResult.niche,
      niche_en: auditResult.niche_en,
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
