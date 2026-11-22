import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureBilingualBio } from '@/lib/bioTranslate';
import { runAuditGeminiStrict } from '@/lib/auditGemini';
import {
  isClearAccountNotFoundForEmail,
  isMissingAccountEmailOnApproveEnabled,
} from '@/lib/socialAccountMissing';
import { runLenientInsightsCheck, type InsightsScrapedAccount } from '@/lib/lenientInsightsCheck';
import { parseFollowerString } from '@/lib/parseFollowers';
import { adminInboxAddress } from '@/lib/adminMessageSummary';
import { shouldSetWrongUsernameHold } from '@/lib/wrongUsernameHold';
import { isSessionDeadError } from '@/lib/socialRefreshLogs';

export type ScrapedAccountLike = InsightsScrapedAccount & {
  ok?: boolean;
  error?: string;
  engagement_rate?: string;
  posts_count?: number;
};

export type WouldBeEmail = { to: string; reason: string; template: string };

export function wouldApproveNewFromScrapedAccounts(accounts: ScrapedAccountLike[]): {
  would_approve: boolean;
  block_reason: string | null;
} {
  if (!accounts.length) {
    return { would_approve: false, block_reason: 'No social profiles scraped' };
  }
  const sessionErrors = accounts.filter((a) => !a.ok && isSessionDeadError(String(a.error || '')));
  if (sessionErrors.length) {
    return { would_approve: false, block_reason: 'Session dead during scrape' };
  }
  const failures = accounts.filter((a) => !a.ok);
  if (failures.length) {
    return { would_approve: false, block_reason: 'One or more accounts failed scrape' };
  }
  return { would_approve: true, block_reason: null };
}

export function buildWouldBeEmailsForApproveNew(input: {
  influencerId: string;
  influencerName: string;
  contactEmail: string;
  accounts: ScrapedAccountLike[];
  wouldApprove: boolean;
  wouldAdminUnapproved: boolean;
}): WouldBeEmail[] {
  const out: WouldBeEmail[] = [];
  const contact = String(input.contactEmail || '').trim();
  if (input.wouldApprove && contact) {
    out.push({
      to: contact,
      reason: 'profile_approved',
      template: 'Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅',
    });
  }
  if (isMissingAccountEmailOnApproveEnabled() && !input.wouldApprove) {
    for (const acc of input.accounts) {
      if (acc.ok) continue;
      const err = String(acc.error || '');
      if (!isClearAccountNotFoundForEmail(err)) continue;
      const platform = String(acc.platform || '').trim();
      const username = String(acc.username || '').replace(/^@+/, '');
      if (!platform || !username || !contact) continue;
      out.push({
        to: contact,
        reason: `missing_social_account:${platform}:${username}`,
        template: 'missing_social_account',
      });
    }
  }
  if (input.wouldAdminUnapproved) {
    const admin = adminInboxAddress(process.env.ADMIN_EMAIL);
    if (admin) {
      out.push({
        to: admin,
        reason: 'admin_alert_unapproved',
        template: 'Δεν εγκρίθηκε: ' + input.influencerName,
      });
    }
  }
  if (!input.wouldApprove && shouldSetWrongUsernameHold(input.accounts)) {
    const admin = adminInboxAddress(process.env.ADMIN_EMAIL);
    if (admin) {
      out.push({
        to: admin,
        reason: 'wrong_username_hold',
        template: 'Wrong-username hold (no creator email)',
      });
    }
  }
  return out;
}

export async function runApproveNewPreview(
  supabaseAdmin: SupabaseClient,
  input: {
    influencerId: string;
    influencerName: string;
    accounts: ScrapedAccountLike[];
  }
): Promise<{
  translation: Awaited<ReturnType<typeof ensureBilingualBio>>;
  ai_evaluation: Awaited<ReturnType<typeof runAuditGeminiStrict>> | { error: string };
  insights_check: Awaited<ReturnType<typeof runLenientInsightsCheck>>;
  would_approve: boolean;
  would_be_emails: WouldBeEmail[];
}> {
  const { influencerId, influencerName, accounts } = input;
  const { data: inf, error } = await supabaseAdmin
    .from('influencers')
    .select(
      'id, display_name, contact_email, bio, bio_en, category, gender, location, audience_male_percent, audience_female_percent, min_rate, service_packages, rate_card, skills, certifications, languages, insights_urls, approved, approved_at'
    )
    .eq('id', influencerId)
    .maybeSingle();
  if (error || !inf) {
    throw new Error(error?.message || 'Influencer not found');
  }

  let translation: Awaited<ReturnType<typeof ensureBilingualBio>>;
  try {
    translation = await ensureBilingualBio(inf.bio, inf.bio_en);
  } catch (e: unknown) {
    translation = {
      bio: inf.bio,
      bio_en: inf.bio_en,
      note: `Bio translate skipped: ${e instanceof Error ? e.message : 'error'}`,
      changed: false,
    };
  }

  const auditAccounts = accounts
    .filter((a) => a.ok !== false)
    .map((a) => ({
      platform: String(a.platform || '').toLowerCase(),
      username: String(a.username || '').replace(/^@+/, ''),
      followers: a.followers,
      engagement_rate: a.engagement_rate,
      avg_likes: a.avg_likes,
      posts_count: a.posts_count,
    }));

  let ai_evaluation: Awaited<ReturnType<typeof runAuditGeminiStrict>> | { error: string };
  try {
    ai_evaluation = await runAuditGeminiStrict(auditAccounts, {
      biography: inf.bio ?? undefined,
      category_name: inf.category ?? undefined,
      display_name: inf.display_name ?? undefined,
      gender: inf.gender ?? undefined,
      location: inf.location ?? undefined,
      audience_male_percent: inf.audience_male_percent ?? undefined,
      audience_female_percent: inf.audience_female_percent ?? undefined,
      min_rate: inf.min_rate ?? undefined,
      service_packages: inf.service_packages,
      rate_card: inf.rate_card,
      skills: inf.skills,
      certifications: inf.certifications,
      languages: inf.languages ?? null,
    });
  } catch (e: unknown) {
    ai_evaluation = { error: e instanceof Error ? e.message : String(e) };
  }

  const insights_check = await runLenientInsightsCheck({
    insights_urls: inf.insights_urls,
    scrapedAccounts: accounts,
  });

  const gate = wouldApproveNewFromScrapedAccounts(accounts);
  const would_approve = gate.would_approve && !inf.approved && !(inf as { approved_at?: string }).approved_at;

  const would_be_emails = buildWouldBeEmailsForApproveNew({
    influencerId,
    influencerName: influencerName || inf.display_name || influencerId,
    contactEmail: String(inf.contact_email || ''),
    accounts,
    wouldApprove: would_approve,
    wouldAdminUnapproved: !would_approve,
  });

  return {
    translation,
    ai_evaluation,
    insights_check,
    would_approve,
    would_be_emails,
  };
}

export function scrapeAccountFollowersForDisplay(accounts: ScrapedAccountLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of accounts) {
    const p = String(a.platform || '').toLowerCase();
    if (!p) continue;
    out[p] = parseFollowerString(a.followers);
  }
  return out;
}