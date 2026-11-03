import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser, userFromBearer } from '@/lib/apiAuth';
import { diffProfileChange } from '@/lib/profileChangeDiff';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type LogRow = { influencer_id: string | null; event: string; message: string | null; created_at: string };

/** Turn a run-log row into a short reason, or null when the row is not an unapproval. */
function reasonFrom(row: LogRow): string | null {
  const msg = String(row.message || '').trim();
  if (row.event === 'admin_alert_unapproved') {
    const i = msg.indexOf('|');
    return i >= 0 ? msg.slice(i + 1) : msg;
  }
  if (row.event === 'unapproved') {
    const m = msg.match(/because at least one social profile failed\.\s*(.*)$/i);
    return m ? `Σφάλμα προφίλ (ανανέωση): ${m[1]}` : msg;
  }
  if (row.event === 'persist_warning') return `Σφάλμα αποθήκευσης στατιστικών: ${msg}`;
  if (row.event === 'skipped') {
    if (/not a new influencer/i.test(msg)) return null;
    const m = msg.match(/^Left unapproved \(new influencer\)\.\s*(.*)$/i);
    if (m) return `Σφάλμα προφίλ: ${m[1]}`;
    return msg || null;
  }
  return null;
}

/** Latest unapproval reason + date per influencer, from social_refresh_logs (AuditPro approve-new + social refresh). */
export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdminUser(user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: pending } = await supabaseAdmin.from('influencers').select('id').eq('approved', false).limit(5000);
  const ids = (pending || []).map((r: { id: string }) => String(r.id));
  const reasons: Record<string, { reason: string; at: string }> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from('social_refresh_logs')
      .select('influencer_id, event, message, created_at')
      .in('influencer_id', chunk)
      .in('event', ['admin_alert_unapproved', 'unapproved', 'persist_warning', 'skipped'])
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of (data || []) as LogRow[]) {
      const id = row.influencer_id ? String(row.influencer_id) : '';
      if (!id || reasons[id]) continue;
      const reason = reasonFrom(row);
      if (reason) reasons[id] = { reason: reason.slice(0, 300), at: row.created_at };
    }
  }
  // Classify + add creator profile edits (unreviewed profile_changes) newer than the last AuditPro verdict.
  type Kind = 'profile_changed' | 'account_not_found' | 'check_error' | 'other';
  const out: Record<string, { kind: Kind; reason: string; at: string }> = {};
  const classify = (reason: string): Kind => {
    if (/not found|doesn.?t exist|does not exist|404|could not read .*profile|no social profiles|private|unavailable \(account\)/i.test(reason)) return 'account_not_found';
    if (/getaddrinfo|session|timeout|timed out|network|errno|5\d\d|rate.?limit|σφάλμα αποθήκευσης/i.test(reason)) return 'check_error';
    return 'other';
  };
  for (const [id, r] of Object.entries(reasons)) out[id] = { kind: classify(r.reason), reason: r.reason, at: r.at };
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from('profile_changes')
      .select('influencer_id, created_at, changed_fields, old_values, new_values')
      .in('influencer_id', chunk)
      .eq('reviewed_by_admin', false)
      .order('created_at', { ascending: false })
      .limit(2000);
    const seen = new Set<string>();
    for (const row of (data || []) as Array<{ influencer_id: string; created_at: string; changed_fields: string[] | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null }>) {
      const id = String(row.influencer_id);
      if (seen.has(id)) continue;
      const diffs = diffProfileChange(row.changed_fields, row.old_values, row.new_values);
      if (!diffs.length) continue;
      seen.add(id);
      const prev = out[id];
      if (prev && prev.at > row.created_at) continue;
      const what = diffs
        .map((d) => (d.lines[0] ? `${d.label}: ${d.lines[0].from} → ${d.lines[0].to}` : d.label))
        .join(' · ')
        .slice(0, 300);
      out[id] = { kind: 'profile_changed', reason: what, at: row.created_at };
    }
  }
  return NextResponse.json({ reasons: out });
}
