import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SOCIAL_REFRESH_LOG_RETENTION_DAYS } from '@/lib/socialRefreshLogs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function GET(request: NextRequest) {
  try {
    const runId = request.nextUrl.searchParams.get('runId')?.trim() || '';

    const { data: runs, error: runsError } = await supabaseAdmin
      .from('social_refresh_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(40);

    if (runsError) {
      if (/relation|table|does not exist|schema cache/i.test(runsError.message)) {
        return NextResponse.json({
          runs: [],
          logs: [],
          retentionDays: SOCIAL_REFRESH_LOG_RETENTION_DAYS,
          setupRequired: true,
          error: 'Τρέξτε docs/ADD_SOCIAL_REFRESH_LOGS.sql στο Supabase SQL Editor.',
        });
      }
      throw new Error(runsError.message);
    }

    const selectedRunId = runId || runs?.[0]?.id || '';
    let logs: unknown[] = [];
    if (selectedRunId) {
      const { data: logRows, error: logsError } = await supabaseAdmin
        .from('social_refresh_logs')
        .select('*')
        .eq('run_id', selectedRunId)
        .order('created_at', { ascending: true })
        .limit(2000);
      if (logsError) throw new Error(logsError.message);
      logs = logRows ?? [];
    }

    return NextResponse.json({
      runs: runs ?? [],
      logs,
      selectedRunId,
      retentionDays: SOCIAL_REFRESH_LOG_RETENTION_DAYS,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
