import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { closeConversation } from '@/lib/closeConversation';
import { runAdminMessageSummaries, runMessageSummaries } from '@/lib/messageSummaryRun';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 60;

/**
 * Closes threads with no message for 10+ minutes.
 * Also sends at most one unread summary per quiet conversation (default 20 minutes),
 * and one admin summary per quiet or newly closed conversation.
 * Does not email a full transcript.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} only (no hardcoded secrets).
 * Ops: disable the legacy pg_cron job that hit this every 5 minutes on the DB — do that by hand.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized. CRON_SECRET not configured.' }, { status: 401 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized. Missing or invalid CRON_SECRET.' }, { status: 401 });
  }

  try {
    let summary: { sent: number; skipped: number; errors: string[] } | null = null;
    try {
      summary = await runMessageSummaries();
    } catch (error) {
      console.error('[Cron] message summary failed:', error);
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    // Only open threads (closed_at IS NULL) — already-closed rows are skipped.
    const [stale, never] = await Promise.all([
      supabaseAdmin
        .from('conversations')
        .select('id')
        .is('closed_at', null)
        .lt('last_message_at', cutoff)
        .limit(200),
      supabaseAdmin
        .from('conversations')
        .select('id')
        .is('closed_at', null)
        .is('last_message_at', null)
        .limit(50),
    ]);

    if (stale.error || never.error) {
      return NextResponse.json(
        { error: stale.error?.message || never.error?.message, summary },
        { status: 500 }
      );
    }

    const seen = new Set<string>();
    const inactiveConversations: { id: string }[] = [];
    for (const row of [...(stale.data || []), ...(never.data || [])]) {
      const id = String(row.id);
      if (seen.has(id)) continue;
      seen.add(id);
      inactiveConversations.push({ id });
    }

    if (inactiveConversations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No inactive conversations to close',
        count: 0,
        summary,
      });
    }

    const results = [];
    for (const conv of inactiveConversations) {
      try {
        const endResponse = await closeConversation(conv.id);
        if (endResponse.success) {
          results.push({ conversationId: conv.id, status: endResponse.alreadyClosed ? 'already_closed' : 'closed' });
        } else {
          results.push({ conversationId: conv.id, status: 'error', error: endResponse.error });
        }
      } catch (err: unknown) {
        results.push({
          conversationId: conv.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const newlyClosed = results
      .filter((row) => row.status === 'closed')
      .map((row) => row.conversationId);
    let adminAfterClose: { sent: number; skipped: number; errors: string[] } | null = null;
    if (newlyClosed.length > 0) {
      try {
        adminAfterClose = await runAdminMessageSummaries({ includeClosed: true });
      } catch (error) {
        console.error('[Cron] admin summary after close failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${inactiveConversations.length} conversations`,
      results,
      summary,
      adminAfterClose,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cron error';
    console.error('[Cron] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
