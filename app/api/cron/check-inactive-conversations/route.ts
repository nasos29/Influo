import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { closeConversation } from '@/lib/closeConversation';
import { runMessageSummaries } from '@/lib/messageSummaryRun';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const maxDuration = 60;

/**
 * Closes threads with no message for 10+ minutes.
 * Also sends at most one unread summary per quiet conversation (default 20 minutes).
 * Does not email a full transcript.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('x-vercel-cron') === '1' ||
    req.headers.get('user-agent')?.includes('vercel-cron');

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized. Missing or invalid CRON_SECRET.' }, { status: 401 });
    }
  } else if (!isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized. CRON_SECRET not configured.' }, { status: 401 });
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

    const [stale, never] = await Promise.all([
      supabaseAdmin
        .from('conversations')
        .select('id, last_message_at')
        .is('closed_at', null)
        .lt('last_message_at', cutoff)
        .limit(200),
      supabaseAdmin
        .from('conversations')
        .select('id, last_message_at')
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

    const inactiveConversations = [...(stale.data || []), ...(never.data || [])];

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

    return NextResponse.json({
      success: true,
      message: `Processed ${inactiveConversations.length} conversations`,
      results,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cron error';
    console.error('[Cron] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
