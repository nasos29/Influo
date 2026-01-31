/**
 * Gemini strategic audit – multi-platform: one unified audit from all IG/TikTok metrics.
 * Used by /api/admin/refresh-audit, backfill-audit, and refreshSocialStats.
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in env.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** One social account (Instagram, TikTok, or YouTube) with metrics. YouTube: subscribers = followers. */
export type AuditAccount = {
  platform: string;
  username: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
};

/** Shared profile data (bio, category). */
export type AuditShared = {
  biography?: string | null;
  category_name?: string | null;
};

export type AuditResult = {
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

/** Legacy single-account metrics (for backward compatibility if needed). */
export type AuditMetrics = {
  followers?: string | number | null;
  engagement_rate?: string | null;
  avg_likes?: string | number | null;
  avg_comments?: string | number | null;
  posts_count?: number | null;
  category_name?: string | null;
  biography?: string | null;
  engagement_hidden?: boolean;
  brand_mention_er?: number | string | null;
  brand_mention_effectiveness?: number | string | null;
  brand_mention_saturation?: number | string | null;
};

function buildMultiPlatformPrompt(accounts: AuditAccount[], shared: AuditShared): string {
  const platformsBlock = accounts
    .map(
      (a) =>
        `- ${(a.platform || '').trim()}: @${(a.username || '').trim().replace(/^@+/, '')} — Followers: ${a.followers ?? 'N/A'}, Engagement rate: ${a.engagement_rate ?? 'N/A'}, Avg likes: ${a.avg_likes ?? 'N/A'}`
    )
    .join('\n');

  const bio = (shared.biography || '').trim().slice(0, 400);
  const cat = (shared.category_name || '').trim();
  const bioBlock = bio ? `\nBIOGRAPHY (creator):\n${bio}` : '';
  const categoryBlock = cat ? `\nCATEGORY: ${cat}` : '';

  return `You are a senior influencer marketing analyst. Your output is read by BRANDS who are evaluating this creator for potential partnerships. The goal is a complete, balanced profile FOR BRANDS – not advice to the creator.

CREATOR DATA – SOCIAL ACCOUNTS (metrics per platform). Platforms can be Instagram, TikTok, or YouTube (for YouTube, subscribers = followers).
${platformsBlock}
${bioBlock}
${categoryBlock}

TASK:
Write a strategic profile that helps brands decide whether to work with this creator. Describe strengths AND weaknesses in a factual, neutral way. Use detailed bullets (2–3 sentences or 1–2 lines each). Do NOT give recommendations to the creator. Describe what IS.

OUTPUT – Return ONLY valid JSON with these exact keys (no markdown, no extra text):
- scoreBreakdown: array of exactly 4 bullet points in GREEK (Ελληνικά). Each bullet MUST be 2–3 sentences or 2–3 lines – rich, detailed text for brands. Use more words; avoid one-liners.
- scoreBreakdown_en: array of exactly 4 bullet points in ENGLISH, same content and length as scoreBreakdown.
- whyWorkWithThem: 2–4 sentences in GREEK: reasons a brand should work with this creator, based PRIMARILY on their profile (bio, category, metrics, niche). Do NOT include "Γιατί να συνεργαστώ μαζί του" – only the reasons.
- whyWorkWithThem_en: same as whyWorkWithThem, in ENGLISH. Do NOT include "Why work with them" – only the reasons.
- positives: array of 2–4 points in GREEK – key strengths for brands. Each point 1–2 sentences (e.g. "Δυνατό engagement στο Instagram και συνεπής απεικόνιση niche.").
- positives_en: array of 2–4 points in ENGLISH, same content as positives.
- negatives: array of 2–4 points in GREEK – drawbacks or concerns for brands. Each point 1–2 sentences. Can be empty array if no significant negatives.
- negatives_en: array of 2–4 points in ENGLISH, same content as negatives.
- brandSafe: boolean (true if content and metrics suggest brand-safe; false if risks).
- niche: ONE niche label in GREEK (e.g. "Μόδα", "Fitness").
- niche_en: ONE niche label in ENGLISH (Fashion, Fitness, Beauty & Makeup, etc.). Do NOT use: Creator, Content Creator, Influencer, Lifestyle as default.

RULES:
- Audience is brands. Be detailed in bullets; more words, not one-liners.
- Include both positives and negatives where relevant.
- No advisory tone. Descriptive only.
- In GREEK text when referring to companies/brands: use "επιχειρήσεις" (e.g. "Οι επιχειρήσεις πρέπει..."). Do NOT use "μάρκες". If you use the word "brands", write "τα brands" never "οι brands" (e.g. "Τα brands μπορούν..." – συνεργασία influencers με επιχειρήσεις/brands).
- If the profile suggests fashion/model/aesthetic content, use Fashion, Model or Beauty & Makeup – not Humor/Comedy unless the bio clearly indicates comedy.`;
}

function parseResponse(text: string): AuditResult {
  let raw = (text || '').trim();
  if (raw.includes('```json')) {
    raw = raw.split('```json')[1].split('```')[0];
  } else if (raw.includes('```')) {
    raw = raw.split('```')[1].split('```')[0];
  }
  raw = raw.trim();
  const data = JSON.parse(raw) as Record<string, unknown>;
  return {
    scoreBreakdown: (data.scoreBreakdown as string[]) || ['Ανάλυση δεν διαθέσιμη.'],
    scoreBreakdown_en: Array.isArray(data.scoreBreakdown_en) ? (data.scoreBreakdown_en as string[]) : undefined,
    whyWorkWithThem: typeof data.whyWorkWithThem === 'string' ? (data.whyWorkWithThem as string).trim() : undefined,
    whyWorkWithThem_en: typeof data.whyWorkWithThem_en === 'string' ? (data.whyWorkWithThem_en as string).trim() : undefined,
    positives: Array.isArray(data.positives) ? (data.positives as string[]) : undefined,
    positives_en: Array.isArray(data.positives_en) ? (data.positives_en as string[]) : undefined,
    negatives: Array.isArray(data.negatives) ? (data.negatives as string[]) : undefined,
    negatives_en: Array.isArray(data.negatives_en) ? (data.negatives_en as string[]) : undefined,
    brandSafe: Boolean(data.brandSafe !== false),
    niche: ((data.niche as string) || '').trim() || 'Creator',
    niche_en: ((data.niche_en as string) || '').trim() || undefined,
  };
}

const FALLBACK: AuditResult = {
  scoreBreakdown: ['Προσωρινή αδυναμία ανάλυσης.'],
  brandSafe: true,
  niche: 'Creator',
};

/**
 * Run Gemini strategic audit from all platforms' metrics (one unified audit).
 * Uses GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. Model: gemini-2.0-flash (or GEMINI_AUDIT_MODEL).
 */
export async function runAuditGemini(
  accounts: AuditAccount[],
  shared: AuditShared
): Promise<AuditResult> {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    console.error('[auditGemini] GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set');
    return FALLBACK;
  }

  const filtered = accounts.filter(
    (a) =>
      (a?.platform || '').trim() &&
      (a?.username || '').trim()
  );
  if (filtered.length === 0) {
    console.error('[auditGemini] No valid accounts (platform + username)');
    return FALLBACK;
  }

  const modelId = (process.env.GEMINI_AUDIT_MODEL || 'gemini-2.0-flash').trim();
  const prompt = buildMultiPlatformPrompt(filtered, shared);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text?.()?.trim() ?? '';
    if (!text) return FALLBACK;
    return parseResponse(text);
  } catch (e) {
    console.error('[auditGemini]', e);
    return FALLBACK;
  }
}
