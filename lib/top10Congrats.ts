/**
 * Congratulate influencers who newly enter the homepage Top 10.
 * First run bootstraps the snapshot without sending (no spam to current Top 10).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { computeTopInfluencers, type TopInfluencerRow } from '@/lib/computeTopInfluencers';
import { publicProfilePath } from '@/lib/profileSlug';
import { sendPushInfluencerTop10 } from '@/lib/push';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr').replace(/\/$/, '');
const FROM_EMAIL = 'Influo <noreply@influo.gr>';
const SNAPSHOT_ID = 'global';

export function buildTop10CongratsHtml(name: string, profileUrl: string): string {
  const safeName = escapeHtml(name || 'δημιουργέ');
  const safeUrl = escapeHtml(profileUrl);
  return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #92400e; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">🏆 Είσαι στο Top 10!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${safeName},</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Συγχαρητήρια — το προφίλ σου μπήκε στα <strong>Top 10 influencers</strong> του Influo.</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Τα Brands βλέπουν τώρα το προφίλ σου πιο ψηλά στην αρχική σελίδα.</p>
            <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #92400e; font-weight: 600;">Για να μείνεις ψηλά, κράτα ενεργό προφίλ:</p>
              <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #78350f;">
                <li style="margin-bottom: 6px;">ενημερωμένη φωτογραφία, social stats και media kit</li>
                <li>γρήγορες απαντήσεις στα μηνύματα των Brands (μετράει στο προφίλ σου)</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 28px 0 8px;">
              <a href="${safeUrl}" style="display: inline-block; background: #071b2a; color: #ffffff !important; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-size: 13px; font-weight: 600;">Δες το προφίλ σου</a>
            </div>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Καλή συνέχεια,<br/>Η ομάδα του Influo</p>
            </div>
          </div>
        </div>
      `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function loadSnapshotIds(sb: SupabaseClient): Promise<string[] | null> {
  const { data, error } = await sb
    .from('top_influencers_snapshot')
    .select('influencer_ids')
    .eq('id', SNAPSHOT_ID)
    .maybeSingle();
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      throw new Error(
        'Table top_influencers_snapshot missing. Run docs/ADD_TOP_INFLUENCERS_SNAPSHOT.sql in Supabase.'
      );
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  const ids = Array.isArray(data.influencer_ids) ? data.influencer_ids.map(String) : [];
  return ids;
}

async function saveSnapshotIds(sb: SupabaseClient, ids: string[]): Promise<void> {
  const { error } = await sb.from('top_influencers_snapshot').upsert({
    id: SNAPSHOT_ID,
    influencer_ids: ids,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function sendTop10Email(
  email: string,
  name: string,
  profileUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [email],
    subject: 'Συγχαρητήρια! Μπήκες στο Top 10 του Influo 🏆',
    html: buildTop10CongratsHtml(name, profileUrl),
  });
  if (error) throw new Error(error.message);
}

export type Top10CongratsResult = {
  bootstrapped: boolean;
  topIds: string[];
  newcomers: string[];
  emailed: number;
  pushed: number;
  errors: string[];
};

/**
 * Compare current Top 10 with last snapshot; email + push newcomers.
 * First run only saves the snapshot (no notifications).
 */
export async function runTop10Congrats(options?: {
  supabase?: SupabaseClient;
  /** When true, notify even on first bootstrap (for admin preview tests). */
  forceNotify?: boolean;
}): Promise<Top10CongratsResult> {
  const sb = options?.supabase ?? getAdmin();
  const top = await computeTopInfluencers({ supabase: sb });
  const topIds = top.map((t) => String(t.id));
  const prev = await loadSnapshotIds(sb);

  if (prev == null && !options?.forceNotify) {
    await saveSnapshotIds(sb, topIds);
    return {
      bootstrapped: true,
      topIds,
      newcomers: [],
      emailed: 0,
      pushed: 0,
      errors: [],
    };
  }

  const prevSet = new Set((prev || []).map((id) => String(id).toLowerCase()));
  const newcomers = top.filter((t) => !prevSet.has(String(t.id).toLowerCase()));

  let emailed = 0;
  let pushed = 0;
  const errors: string[] = [];

  for (const row of newcomers) {
    try {
      const result = await notifyOne(sb, row);
      emailed += result.emailed;
      pushed += result.pushed;
    } catch (e) {
      errors.push(
        `${row.display_name || row.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  await saveSnapshotIds(sb, topIds);

  return {
    bootstrapped: false,
    topIds,
    newcomers: newcomers.map((n) => String(n.id)),
    emailed,
    pushed,
    errors,
  };
}

async function notifyOne(
  sb: SupabaseClient,
  row: TopInfluencerRow
): Promise<{ emailed: number; pushed: number }> {
  const { data: inf, error } = await sb
    .from('influencers')
    .select('id, display_name, contact_email, profile_slug')
    .eq('id', row.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inf) throw new Error('Influencer not found');

  const name = (inf.display_name || row.display_name || '').trim() || 'δημιουργέ';
  const path = publicProfilePath(inf.profile_slug || row.profile_slug, inf.id);
  const profileUrl = `${SITE_URL}${path}`;
  const email = (inf.contact_email || '').trim();

  let emailed = 0;
  if (email) {
    await sendTop10Email(email, name, profileUrl);
    emailed = 1;
  }

  const push = await sendPushInfluencerTop10(String(inf.id), name, path);
  return { emailed, pushed: push.sent };
}
