import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { runAuditGeminiStrict, type AuditAccount, type AuditResult } from '../lib/auditGemini';

const AUDITPR = (process.env.AUDITPR_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const PROGRESS_PATH = path.join('reports', 'fill-missing-social-progress.json');
const BATCH_IDS_PATH = path.join('reports', 'approve-unapproved-progress.json');
const DELAY_MS = 1500;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Acc = {
  platform?: string;
  username?: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
  posts_count?: number;
  avg_views?: number;
  er_suspicious?: boolean;
  er_flag_reason?: string;
};

function formatFollowers(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(num);
}

function parseFollowersFromApi(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const s = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!s) return 0;
  const num = Number(s);
  if (Number.isFinite(num)) return Math.round(num);
  const match = s.replace(/,/g, '').match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return Math.round(n * 1_000);
  if (suffix === 'm') return Math.round(n * 1_000_000);
  return Math.round(n);
}

function plat(a: Acc) {
  return String(a.platform || '').trim().toLowerCase();
}

function uname(a: Acc) {
  return String(a.username || '').replace(/^@+/, '').trim();
}

function missingEr(a: Acc) {
  if (!['instagram', 'tiktok', 'youtube'].includes(plat(a))) return false;
  if (!uname(a)) return false;
  const er = String(a.engagement_rate || '').trim();
  return !er || er === 'N/A';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadProgress(): { done: Record<string, unknown>; failed: Record<string, unknown> } {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return { done: {}, failed: {} };
  }
}

function saveProgress(p: object) {
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }, null, 2));
}

async function fetchMetrics(platform: string, username: string) {
  const timeout = platform === 'tiktok' ? 120_000 : platform === 'instagram' ? 95_000 : 45_000;
  const url = `${AUDITPR}/metrics/${platform}/${encodeURIComponent(username)}?for_import=true`;
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeout) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auditpr ${res.status}: ${text.slice(0, 160)}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === 'Failed' || data.error) {
    throw new Error(String(data.error || data.error_detail || 'Auditpr metrics failed'));
  }
  return {
    followers: formatFollowers(parseFollowersFromApi(data.followers)),
    engagement_rate: typeof data.engagement_rate === 'string' ? data.engagement_rate : 'N/A',
    avg_likes: String(Number(data.avg_likes) || 0),
    posts_count: parseFollowersFromApi(data.posts_count),
    avg_views: parseFollowersFromApi(data.avg_views) || parseFollowersFromApi(data.avg_plays) || undefined,
  };
}

async function refreshAudit(inf: {
  id: string;
  display_name?: string;
  bio?: string;
  category?: string;
  gender?: string;
  location?: string;
  audience_male_percent?: number | null;
  audience_female_percent?: number | null;
  accounts: Acc[];
}) {
  const igTtAccounts: AuditAccount[] = (inf.accounts || [])
    .filter(
      (a) =>
        uname(a) &&
        ['instagram', 'tiktok', 'youtube'].includes(plat(a))
    )
    .map((a) => ({
      platform: plat(a),
      username: uname(a),
      followers: a.followers ?? undefined,
      engagement_rate: a.engagement_rate ?? undefined,
      avg_likes: a.avg_likes ?? undefined,
      posts_count: a.posts_count ?? undefined,
      er_suspicious: a.er_suspicious === true,
      er_flag_reason: a.er_flag_reason ?? undefined,
    }));
  if (!igTtAccounts.length) throw new Error('No social accounts for AI');

  let exampleAudits: AuditResult[] | undefined;
  const category = (inf.category || '').trim() || null;
  const q = admin.from('influencers').select('auditpr_audit').neq('id', inf.id).not('auditpr_audit', 'is', null).limit(1);
  if (category) {
    const { data } = await q.eq('category', category).maybeSingle();
    const audit = data?.auditpr_audit as AuditResult | undefined;
    if (audit && Array.isArray(audit.scoreBreakdown)) exampleAudits = [audit];
  }
  if (!exampleAudits) {
    const { data } = await admin
      .from('influencers')
      .select('auditpr_audit')
      .neq('id', inf.id)
      .not('auditpr_audit', 'is', null)
      .limit(1)
      .maybeSingle();
    const audit = data?.auditpr_audit as AuditResult | undefined;
    if (audit && Array.isArray(audit.scoreBreakdown)) exampleAudits = [audit];
  }

  const auditResult = await runAuditGeminiStrict(
    igTtAccounts,
    {
      biography: inf.bio ?? undefined,
      category_name: inf.category ?? undefined,
      display_name: inf.display_name ?? undefined,
      gender: inf.gender ?? undefined,
      location: inf.location ?? undefined,
      audience_male_percent: inf.audience_male_percent ?? undefined,
      audience_female_percent: inf.audience_female_percent ?? undefined,
    },
    { exampleAudits }
  );
  const auditpr_audit = {
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
  const { error } = await admin.from('influencers').update({ auditpr_audit }).eq('id', inf.id);
  if (error) throw error;
}

async function main() {
  const batch = JSON.parse(fs.readFileSync(BATCH_IDS_PATH, 'utf8'));
  const ids = Object.keys(batch.done || {});
  const { data, error } = await admin
    .from('influencers')
    .select(
      'id, display_name, contact_email, accounts, bio, category, gender, location, audience_male_percent, audience_female_percent'
    )
    .in('id', ids);
  if (error) throw error;

  const jobs = (data || []).filter((inf) => (inf.accounts || []).some(missingEr));
  const progress = loadProgress();
  const remaining = jobs.filter((j) => !progress.done[j.id]);
  console.log(`People with missing ER: ${jobs.length}, remaining: ${remaining.length}`);
  saveProgress(progress);

  for (let i = 0; i < remaining.length; i++) {
    const inf = remaining[i];
    const n = `${i + 1}/${remaining.length}`;
    const miss = (inf.accounts || []).filter(missingEr);
    process.stdout.write(`[${n}] ${inf.display_name} (${miss.map((a) => plat(a)).join(',')}) ... `);
    const accErrors: string[] = [];
    let accounts = [...(inf.accounts || [])] as Acc[];
    let updatedAny = false;

    for (const target of miss) {
      const p = plat(target);
      const u = uname(target);
      try {
        const metrics = await fetchMetrics(p, u);
        accounts = accounts.map((a) => {
          if (plat(a) === p && uname(a).toLowerCase() === u.toLowerCase()) {
            return { ...a, ...metrics };
          }
          return a;
        });
        updatedAny = true;
        process.stdout.write(`${p}@${u}=${metrics.engagement_rate} `);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        accErrors.push(`${p}@${u}: ${msg}`);
        process.stdout.write(`${p}@${u}=FAIL `);
      }
      await sleep(DELAY_MS);
    }

    if (updatedAny) {
      const { error: upErr } = await admin.from('influencers').update({ accounts }).eq('id', inf.id);
      if (upErr) throw upErr;
    }

    try {
      await refreshAudit({ ...inf, accounts });
      progress.done[inf.id] = {
        name: inf.display_name,
        email: inf.contact_email,
        updated: updatedAny,
        accErrors,
        at: new Date().toISOString(),
      };
      delete progress.failed[inf.id];
      saveProgress(progress);
      console.log(accErrors.length ? `AI OK (partial) ${accErrors.join(' | ')}` : 'AI OK');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      progress.failed[inf.id] = { name: inf.display_name, error: msg, accErrors, at: new Date().toISOString() };
      saveProgress(progress);
      console.log(`AI FAIL ${msg}`);
    }
  }

  console.log(`DONE ok=${Object.keys(progress.done).length} fail=${Object.keys(progress.failed).length} of ${jobs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
