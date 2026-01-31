/**
 * Gemini strategic audit – multi-platform: one unified audit from all IG/TikTok metrics.
 * Used by /api/admin/refresh-audit, backfill-audit, and refreshSocialStats.
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in env.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/** One social account (Instagram or TikTok) with metrics. */
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

CREATOR DATA – SOCIAL ACCOUNTS (metrics per platform):
${platformsBlock}
${bioBlock}
${categoryBlock}

TASK:
Write a strategic profile that helps brands decide whether to work with this creator. Describe strengths AND weaknesses/concerns in a factual, neutral way. Do NOT give recommendations to the creator (e.g. avoid "should improve", "ought to"). Instead describe what IS: e.g. "Strong engagement on Instagram", "Limited reach on TikTok", "Consistent niche across platforms", "Engagement rate below average for this tier".

OUTPUT – Return ONLY valid JSON with these exact keys (no markdown, no extra text):
- scoreBreakdown: array of exactly 4 short bullet points in GREEK (Ελληνικά), each one line. Each bullet describes a characteristic for brands (strengths and/or drawbacks). Neutral, descriptive tone – no advice to the creator.
- scoreBreakdown_en: array of exactly 4 short bullet points in ENGLISH, same content as scoreBreakdown.
- brandSafe: boolean (true if content and metrics suggest brand-safe; false if risks).
- niche: ONE niche label in GREEK (e.g. "Μόδα", "Fitness") – single term or very short phrase.
- niche_en: ONE niche label in ENGLISH (e.g. Fashion, Fitness, Beauty & Makeup). Use standard categories: Fashion, Model, Beauty & Makeup, Fitness, Food, Travel, Gaming, Comedy, Music, Education, etc. Do NOT use: Creator, Content Creator, Influencer, Lifestyle as default.

RULES:
- Audience is brands. Highlight what matters for brand partnerships: reach, engagement quality, consistency, niche fit, risks.
- Include both positives and negatives where relevant (e.g. "Δυνατό engagement" vs "Μικρό reach στο TikTok").
- No advisory or coaching tone. Descriptive only.
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
