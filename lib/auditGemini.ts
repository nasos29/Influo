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

/** Shared profile data (bio, category, display name, gender, location for smarter copy). */
export type AuditShared = {
  biography?: string | null;
  category_name?: string | null;
  display_name?: string | null;
  gender?: string | null;
  location?: string | null;
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
  const displayName = (shared.display_name || '').trim() || null;
  const gender = (shared.gender || '').trim().toLowerCase() || null;
  const location = (shared.location || '').trim() || null;
  const bioBlock = bio ? `\nBIOGRAPHY (creator):\n${bio}` : '';
  const categoryBlock = cat ? `\nCATEGORY: ${cat}` : '';
  const locationBlock = location ? `\nLOCATION (creator has set this): ${location}. If LOCATION is set, do NOT add any negative about geographic target or local businesses – the creator has declared their location.` : '';
  const creatorName = displayName || 'η δημιουργός';
  const nameBlock = displayName ? `\nCREATOR DISPLAY NAME (use ONLY this when referring to the person in your text): ${displayName}` : '\nCREATOR DISPLAY NAME: not provided – use "η δημιουργός" in Greek and "the creator" in English.';
  const genderNote = gender === 'female' ? '\nCREATOR GENDER: Female. In Greek text use feminine forms where relevant (e.g. "της", "αυτή", "η δημιουργός").' : gender === 'male' ? '\nCREATOR GENDER: Male. In Greek text use masculine forms where relevant (e.g. "του", "αυτός", "ο δημιουργός").' : '';

  return `You are a senior influencer marketing analyst. Your output is read by BRANDS who are evaluating this creator for potential partnerships. The goal is a complete, balanced profile FOR BRANDS – not advice to the creator. Be thorough and nuanced: consider reach, engagement quality, content fit, audience overlap, and brand safety.

CREATOR DATA – SOCIAL ACCOUNTS (metrics per platform). Platforms can be Instagram, TikTok, or YouTube (for YouTube, subscribers = followers).
${platformsBlock}
${bioBlock}
${categoryBlock}${locationBlock}${nameBlock}${genderNote}

CRITICAL – NAMES: In ALL output (scoreBreakdown, whyWorkWithThem, positives, negatives) you must NEVER write the creator's username, @handle, or social media handle. Always refer to the person ONLY by their display name ("${creatorName}") or as "η δημιουργός" / "the creator". If you see a username in the data above, do not repeat it in your text.

TASK:
Write a strategic profile that helps brands decide whether to work with this creator. Describe strengths AND weaknesses in a factual, neutral way. Use detailed bullets (2–3 sentences or 1–2 lines each). Do NOT give recommendations to the creator. Describe what IS.

OUTPUT – Return ONLY valid JSON with these exact keys (no markdown, no extra text):
- scoreBreakdown: array of exactly 4 bullet points in GREEK (Ελληνικά). Each bullet MUST be 2–3 sentences or 2–3 lines – rich, detailed, nuanced text for brands. Reference the creator ONLY by display name or "η δημιουργός" – never by @username.
- scoreBreakdown_en: array of exactly 4 bullet points in ENGLISH, same content and length as scoreBreakdown.
- whyWorkWithThem: 2–4 sentences in GREEK: reasons a brand should work with this creator. Do NOT include "Γιατί να συνεργαστώ μαζί του/της". Use ONLY the display name or "η δημιουργός", never @username.
- whyWorkWithThem_en: same as whyWorkWithThem, in ENGLISH. Do NOT include "Why work with them". Use only display name or "the creator".
- positives: array of 2–4 points in GREEK – key strengths for brands. Each point 1–2 sentences.
- positives_en: array of 2–4 points in ENGLISH, same content as positives.
- negatives: array of 2–4 points in GREEK – real drawbacks or concerns for brands (e.g. narrow niche, content risks, or limited reach when follower count is low). Each point 1–2 sentences. Can be empty array if no significant negatives. When mentioning reach or follower count (e.g. "μικρός αριθμός followers", "περιορίζει την απήχηση"), use ONLY the actual numbers from the creator data above – do not invent figures; the assessment must be fair. FORBIDDEN: "Δεν υπάρχει σαφής γεωγραφικός στόχος" / "no clear geographic target" / "τοπικές επιχειρήσεις" if LOCATION is provided in the data above; only if there is no location at all may you consider it, and prefer to omit it. Apply the same standard to all creators.
- negatives_en: array of 2–4 points in ENGLISH, same content as negatives.
- brandSafe: boolean (true if content and metrics suggest brand-safe; false if risks).
- niche: ONE niche label in GREEK (e.g. "Μόδα", "Fitness").
- niche_en: ONE niche label in ENGLISH (Fashion, Fitness, Beauty & Makeup, etc.). Do NOT use: Creator, Content Creator, Influencer, Lifestyle as default.

RULES:
- Audience is brands. Be detailed and nuanced in bullets; more words, not one-liners.
- Include both positives and negatives where relevant. Negatives must be specific and factual. When referring to reach or follower count, use only the actual numbers from the data above so the assessment is fair and accurate. Never add "γεωγραφικός στόχος" or "geographic target" if LOCATION was provided in the creator data.
- No advisory tone. Descriptive only.
- In GREEK text when referring to companies/brands: use "επιχειρήσεις" (e.g. "Οι επιχειρήσεις πρέπει..."). Do NOT use "μάρκες". If you use the word "brands", write "τα brands" never "οι brands".
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
