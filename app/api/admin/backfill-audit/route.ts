/**
 * Admin: one-time backfill – run Gemini audit for all influencers (or up to limit).
 * Use once so the "Στρατηγική Αξιολόγηση" card appears for everyone.
 * Thereafter audits run only when metrics (followers, engagement_rate, avg_likes) are updated.
 * POST body: { limit?: number }. Requires GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.
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

type AuditprAudit = { scoreBreakdown: string[]; scoreBreakdown_en?: string[]; brandSafe: boolean; niche?: string; niche_en?: string };

export async function POST(request: NextRequest) {
  try {
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ''
    ).trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set.',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 500) : undefined;

    let query = supabaseAdmin
      .from('influencers')
      .select('id, display_name, bio, category, accounts')
      .not('accounts', 'is', null);

    if (limit) {
      query = query.limit(limit);
    }

    const { data: influencers, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }
    if (!influencers?.length) {
      return NextResponse.json({ updated: 0, errors: [], message: 'No influencers with accounts.' });
    }

    const errors: string[] = [];
    let updated = 0;

    for (const inf of influencers) {
      const accounts = (inf.accounts as AccountRow[] | null) ?? [];
      const igTtAccounts: AuditAccount[] = accounts
        .filter(
          (a) =>
            (a?.platform || '').trim() &&
            (a?.username || '').trim() &&
            ['instagram', 'tiktok'].includes((a.platform || '').toLowerCase())
        )
        .map((a) => ({
          platform: (a.platform || '').trim().toLowerCase(),
          username: (a.username || '').trim().replace(/^@+/, ''),
          followers: a.followers ?? undefined,
          engagement_rate: a.engagement_rate ?? undefined,
          avg_likes: a.avg_likes ?? undefined,
        }));

      if (igTtAccounts.length === 0) {
        continue;
      }

      const shared: AuditShared = {
        biography: (inf.bio as string) ?? undefined,
        category_name: (inf.category as string) ?? undefined,
      };

      try {
        const auditResult = await runAuditGemini(igTtAccounts, shared);
        const auditpr_audit: AuditprAudit = {
          scoreBreakdown: auditResult.scoreBreakdown,
          scoreBreakdown_en: auditResult.scoreBreakdown_en,
          brandSafe: auditResult.brandSafe,
          niche: auditResult.niche,
          niche_en: auditResult.niche_en,
        };

        const { error: updateError } = await supabaseAdmin
          .from('influencers')
          .update({ auditpr_audit })
          .eq('id', inf.id);

        if (updateError) {
          if (/column.*auditpr_audit/i.test(updateError.message)) {
            errors.push(`Column auditpr_audit missing (add jsonb to influencers).`);
            break;
          }
          errors.push(`${inf.display_name ?? inf.id}: ${updateError.message}`);
        } else {
          updated++;
        }
      } catch (e) {
        errors.push(`${inf.display_name ?? inf.id}: ${e instanceof Error ? e.message : 'Audit failed'}`);
      }
    }

    return NextResponse.json({
      updated,
      total: influencers.length,
      errors: errors.slice(0, 20),
      message: `Backfill completed: ${updated}/${influencers.length} updated.`,
    });
  } catch (err: unknown) {
    console.error('[admin backfill-audit]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
