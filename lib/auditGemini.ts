/**
 * Gemini strategic audit – multi-platform: one unified audit from all IG/TikTok metrics.
 * Used by /api/admin/refresh-audit, backfill-audit, and refreshSocialStats.
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in env.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { cleanNegativesLists } from '@/lib/auditNegativesDefaults';

/** One social account (Instagram, TikTok, or YouTube) with metrics. YouTube: subscribers = followers. */
export type AuditAccount = {
  platform: string;
  username: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
};

/** Shared profile data (bio, category, display name, gender, location, audience split for smarter copy). */
export type AuditShared = {
  biography?: string | null;
  category_name?: string | null;
  display_name?: string | null;
  gender?: string | null;
  location?: string | null;
   /** Optional audience gender split (percent values like 60, 40). */
  audience_male_percent?: number | null;
  audience_female_percent?: number | null;
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

export const AUDIT_FALLBACK_MESSAGE = 'Προσωρινή αδυναμία ανάλυσης.';
const GEMINI_TIMEOUT_MS = Math.min(
  120000,
  Math.max(15000, Number(process.env.GEMINI_TIMEOUT_MS || 45000))
);
const GEMINI_MAX_RETRIES = Math.min(
  3,
  Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 2))
);

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

/** Normalize DB/profile gender strings for Greek agreement in audit copy. */
function auditGenderBucket(raw: string | null | undefined): 'male' | 'female' | 'neutral' {
  const g = (raw || '').trim().toLowerCase();
  if (!g) return 'neutral';
  if (
    g === 'male' ||
    g === 'm' ||
    g === 'man' ||
    g === 'άνδρας' ||
    g === 'αντρας' ||
    g === 'άντρας'
  ) {
    return 'male';
  }
  if (
    g === 'female' ||
    g === 'f' ||
    g === 'woman' ||
    g === 'γυναίκα' ||
    g === 'γυναικα'
  ) {
    return 'female';
  }
  return 'neutral';
}

function buildMultiPlatformPrompt(accounts: AuditAccount[], shared: AuditShared, exampleAudits?: AuditResult[]): string {
  const platformsBlock = accounts
    .map(
      (a) =>
        `- ${(a.platform || '').trim()}: @${(a.username || '').trim().replace(/^@+/, '')} — Followers: ${a.followers ?? 'N/A'}, Engagement rate: ${a.engagement_rate ?? 'N/A'}, Avg likes: ${a.avg_likes ?? 'N/A'}`
    )
    .join('\n');

  const bio = (shared.biography || '').trim().slice(0, 400);
  const cat = (shared.category_name || '').trim();
  const displayName = (shared.display_name || '').trim() || null;
  const genderBucket = auditGenderBucket(shared.gender);
  const location = (shared.location || '').trim() || null;
  const malePct = typeof shared.audience_male_percent === 'number' ? shared.audience_male_percent : null;
  const femalePct = typeof shared.audience_female_percent === 'number' ? shared.audience_female_percent : null;
  const bioBlock = bio ? `\nBIOGRAPHY (creator):\n${bio}` : '';
  const categoryBlock = cat ? `\nCATEGORY: ${cat}` : '';
  const locationBlock = location ? `\nLOCATION (creator has set this): ${location}. If LOCATION is set, do NOT add any negative about geographic target or local businesses – the creator has declared their location.` : '';
  const audienceGenderBlock =
    malePct != null || femalePct != null
      ? `\nAUDIENCE GENDER SPLIT (approximate):${
          femalePct != null ? `\n- Female: ~${Math.round(femalePct)}%` : ''
        }${malePct != null ? `\n- Male: ~${Math.round(malePct)}%` : ''}\nWhen writing the analysis, explicitly mention this gender split so businesses understand if the audience skews more towards women, men, or is balanced.`
      : '';
  const greekCreatorNom =
    genderBucket === 'male' ? 'ο δημιουργός' : genderBucket === 'female' ? 'η δημιουργός' : 'ο/η δημιουργός';
  const greekCreatorAcc =
    genderBucket === 'male' ? 'τον δημιουργό' : genderBucket === 'female' ? 'την δημιουργό' : 'τον/την δημιουργό';
  const creatorName = displayName || greekCreatorNom;
  const nameBlock = displayName
    ? `\nCREATOR DISPLAY NAME (use ONLY this when referring to the person in your text): ${displayName}`
    : `\nCREATOR DISPLAY NAME: not provided – in Greek use "${greekCreatorNom}" (nominative) when you need a generic label; in English use "the creator".`;
  const genderNote =
    genderBucket === 'female'
      ? '\nCREATOR GENDER: Female. In Greek text use feminine agreement throughout (e.g. "της", "αυτή", "η δημιουργός", "την δημιουργό").'
      : genderBucket === 'male'
        ? '\nCREATOR GENDER: Male. In Greek text use masculine agreement throughout (e.g. "του", "αυτός", "ο δημιουργός", "τον δημιουργό").'
        : '\nCREATOR GENDER: Not specified. In Greek, avoid wrong gender: use "ο/η δημιουργός" / "τον/την δημιουργό" or rephrase in neuter/plural where clearer; never default to only feminine forms.';

  const base = `You are a senior influencer marketing analyst. Your output is read by BRANDS who are evaluating this creator for potential partnerships. The goal is a complete, balanced profile FOR BRANDS – not advice to the creator. Be thorough and nuanced: consider reach, engagement quality, content fit, audience overlap, and brand safety.

CREATOR DATA – SOCIAL ACCOUNTS (metrics per platform). Platforms can be Instagram, TikTok, or YouTube (for YouTube, subscribers = followers).
${platformsBlock}
${bioBlock}
${categoryBlock}${locationBlock}${audienceGenderBlock}${nameBlock}${genderNote}

CRITICAL – NAMES: In ALL output (scoreBreakdown, whyWorkWithThem, positives, negatives) you must NEVER write the creator's username, @handle, or social media handle. Always refer to the person ONLY by their display name ("${creatorName}") or as "${greekCreatorNom}" / "the creator". Match Greek grammatical gender to the creator (per CREATOR GENDER above). If you see a username in the data above, do not repeat it in your text.

TONE – "Με το γάντι": Be professional and honest but diplomatic. Criticism must be constructive and gentle, not harsh or accusatory. Avoid sounding like a warning or a reprimand. Frame limitations in a neutral or positive light where possible (e.g. "Μικρότερο κοινό – ιδανικό για targeted campaigns" rather than "περιορίζει την απήχηση σε σύγκριση με δημιουργούς με μεγαλύτερο κοινό"). Do NOT use phrases like "Απαιτείται προσεκτική αξιολόγηση", "προσεκτική αξιολόγηση της ποιότητας", or "διασφαλιστεί η συμβατότητα" – no generic advisory warnings.

TASK:
Write a strategic profile that helps brands decide whether to work with this creator. Focus on strengths; only mention weaknesses when there is a clear, factual risk (not comparisons to other creators). Use detailed bullets (2–3 sentences or 1–2 lines each). Do NOT give recommendations to the creator. Describe what IS. Do not invent negatives that merely compare this creator unfavourably to others.

OUTPUT – Return ONLY valid JSON with these exact keys (no markdown, no extra text):
- scoreBreakdown: array of exactly 4 bullet points in GREEK (Ελληνικά). Each bullet MUST be 2–3 sentences or 2–3 lines – rich, detailed, nuanced text for brands. Reference the creator ONLY by display name or "${greekCreatorNom}" (with correct gender agreement) – never by @username.
- scoreBreakdown_en: array of exactly 4 bullet points in ENGLISH, same content and length as scoreBreakdown.
- whyWorkWithThem: 2–4 sentences in GREEK: reasons a brand should work with this creator. Do NOT include "Γιατί να συνεργαστώ μαζί του/της". Use ONLY the display name or "${greekCreatorNom}" (with correct agreement), never @username.
- whyWorkWithThem_en: same as whyWorkWithThem, in ENGLISH. Do NOT include "Why work with them". Use only display name or "the creator".
- positives: array of 2–4 points in GREEK – key strengths for brands. Each point 1–2 sentences.
- positives_en: array of 2–4 points in ENGLISH, same content as positives.
- negatives: array of 0–4 points in GREEK. ONLY when there is a real limitation, trade-off or concrete risk for businesses — ήπια διατύπωση (“σημεία προσοχής για τις επιχειρήσεις”). Αν δεν υπάρχει κάτι αξιοσημείωτο, επέστρεψε κενό array []. FORBIDDEN: σύγκριση με άλλους δημιουργούς, επίκληση λιγότερων followers vs άλλους, ουδέτερα demographics ως “αρνητικό”.
- negatives_en: array of 0–4 points in ENGLISH, same rules; empty [] when nothing noteworthy.
- brandSafe: boolean (true if content and metrics suggest brand-safe; false if risks).
- niche: ONE niche label in GREEK (e.g. "Μόδα", "Fitness").
- niche_en: ONE niche label in ENGLISH (Fashion, Fitness, Beauty & Makeup, etc.). Do NOT use: Creator, Content Creator, Influencer, Lifestyle as default.

RULES:
- Audience is brands. Be detailed and nuanced in bullets; more words, not one-liners.
- Positives: always include 2–4 strong points, με θετικό και δίκαιο τόνο προς ${greekCreatorAcc}.
- Negatives: 0–4 σημεία μόνο όταν υπάρχει πραγματικό trade-off ή ρίσκο για τις επιχειρήσεις· αλλιώς κενό array. Τόνος ήπιος, επαγγελματικός.
- Μην παρουσιάζεις ποτέ ως “αρνητικό” κάτι που είναι απλή περιγραφή του κοινού ή του προφίλ (π.χ. αναλογία ανδρών/γυναικών, χώρα, ηλικίες) εκτός αν δημιουργεί σαφή δυσκολία για συγκεκριμένο τύπο καμπανιών.
- Never use comparisons with "other creators" or comments about "limited reach" vs others; focus on describing this creator’s reality for brands.
- No advisory or warning tone. No "απαιτείται προσεκτική αξιολόγηση" or similar. Descriptive only.
- In GREEK text when referring to companies/brands: use "επιχειρήσεις" (e.g. "Οι επιχειρήσεις πρέπει..."). Do NOT use "μάρκες". If you use the word "brands", write "τα brands" never "οι brands".
- If the profile suggests fashion/model/aesthetic content, use Fashion, Model or Beauty & Makeup – not Humor/Comedy unless the bio clearly indicates comedy.`;
  const exampleBlock =
    exampleAudits?.length &&
    exampleAudits[0]?.scoreBreakdown?.length
      ? `

LEARN FROM THIS EXAMPLE – Match this depth, structure and quality (content is from another creator; your output must be about the current creator above, in the same style):
\`\`\`json
${JSON.stringify(
  {
    scoreBreakdown: exampleAudits[0].scoreBreakdown,
    scoreBreakdown_en: exampleAudits[0].scoreBreakdown_en,
    whyWorkWithThem: exampleAudits[0].whyWorkWithThem,
    whyWorkWithThem_en: exampleAudits[0].whyWorkWithThem_en,
    positives: exampleAudits[0].positives,
    positives_en: exampleAudits[0].positives_en,
    negatives: exampleAudits[0].negatives,
    negatives_en: exampleAudits[0].negatives_en,
    brandSafe: exampleAudits[0].brandSafe,
    niche: exampleAudits[0].niche,
    niche_en: exampleAudits[0].niche_en,
  },
  null,
  2
)}
\`\`\`
`
      : '';
  return base + exampleBlock;
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
  const rawNeg = Array.isArray(data.negatives) ? (data.negatives as string[]) : undefined;
  const rawNegEn = Array.isArray(data.negatives_en) ? (data.negatives_en as string[]) : undefined;
  const cleanedNeg = cleanNegativesLists(rawNeg, rawNegEn);
  return {
    scoreBreakdown: (data.scoreBreakdown as string[]) || ['Ανάλυση δεν διαθέσιμη.'],
    scoreBreakdown_en: Array.isArray(data.scoreBreakdown_en) ? (data.scoreBreakdown_en as string[]) : undefined,
    whyWorkWithThem: typeof data.whyWorkWithThem === 'string' ? (data.whyWorkWithThem as string).trim() : undefined,
    whyWorkWithThem_en: typeof data.whyWorkWithThem_en === 'string' ? (data.whyWorkWithThem_en as string).trim() : undefined,
    positives: Array.isArray(data.positives) ? (data.positives as string[]) : undefined,
    positives_en: Array.isArray(data.positives_en) ? (data.positives_en as string[]) : undefined,
    negatives: cleanedNeg.negatives,
    negatives_en: cleanedNeg.negatives_en,
    brandSafe: Boolean(data.brandSafe !== false),
    niche: ((data.niche as string) || '').trim() || 'Creator',
    niche_en: ((data.niche_en as string) || '').trim() || undefined,
  };
}

const FALLBACK: AuditResult = {
  scoreBreakdown: [AUDIT_FALLBACK_MESSAGE],
  brandSafe: true,
  niche: 'Creator',
  negatives: [],
  negatives_en: [],
};

/** Detect synthetic fallback so API routes can fail loudly instead of storing placeholder audits. */
export function isAuditFallbackResult(audit: AuditResult): boolean {
  return (
    Array.isArray(audit.scoreBreakdown) &&
    audit.scoreBreakdown.length === 1 &&
    (audit.scoreBreakdown[0] || '').trim() === AUDIT_FALLBACK_MESSAGE &&
    (audit.niche || '').trim() === 'Creator' &&
    audit.brandSafe === true
  );
}

async function generateContentWithTimeout(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  prompt: string,
  timeoutMs: number
) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`Gemini request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([model.generateContent(prompt), timeoutPromise]);
}

function isRetryableGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.toLowerCase().includes('resource exhausted') ||
    msg.toLowerCase().includes('timeout')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentResilient(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  prompt: string
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await generateContentWithTimeout(model, prompt, GEMINI_TIMEOUT_MS);
    } catch (err: unknown) {
      lastError = err;
      if (attempt === GEMINI_MAX_RETRIES || !isRetryableGeminiError(err)) break;
      const delayMs = Math.min(10000, 1500 * Math.pow(2, attempt));
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Strict variant for admin APIs: throws explicit errors instead of returning fallback.
 * Use this when UI must show actionable failure reason.
 */
export async function runAuditGeminiStrict(
  accounts: AuditAccount[],
  shared: AuditShared,
  options?: { exampleAudits?: AuditResult[] }
): Promise<AuditResult> {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    throw new Error('Gemini API key missing (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).');
  }

  const filtered = accounts.filter(
    (a) =>
      (a?.platform || '').trim() &&
      (a?.username || '').trim()
  );
  if (filtered.length === 0) {
    throw new Error('No valid social accounts (platform + username) for audit.');
  }

  const modelId = (process.env.GEMINI_AUDIT_MODEL || 'gemini-2.0-flash').trim();
  const prompt = buildMultiPlatformPrompt(filtered, shared, options?.exampleAudits);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await generateContentResilient(model, prompt);
    const response = result.response;
    const text = response.text?.()?.trim() ?? '';
    if (!text) {
      throw new Error(`Gemini returned empty response (model: ${modelId}).`);
    }
    try {
      const parsed = parseResponse(text);
      if (isAuditFallbackResult(parsed)) {
        throw new Error(`Gemini returned fallback placeholder (model: ${modelId}).`);
      }
      return parsed;
    } catch (parseErr) {
      if (parseErr instanceof Error) {
        throw new Error(`Gemini response parse failed: ${parseErr.message}`);
      }
      throw new Error('Gemini response parse failed.');
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Gemini request failed (${modelId}): ${msg}`);
  }
}

/**
 * Run Gemini strategic audit from all platforms' metrics (one unified audit).
 * Uses GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. Model: gemini-2.0-flash (or GEMINI_AUDIT_MODEL).
 */
export async function runAuditGemini(
  accounts: AuditAccount[],
  shared: AuditShared,
  options?: { exampleAudits?: AuditResult[] }
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
  const prompt = buildMultiPlatformPrompt(filtered, shared, options?.exampleAudits);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await generateContentResilient(model, prompt);
    const response = result.response;
    const text = response.text?.()?.trim() ?? '';
    if (!text) return FALLBACK;
    return parseResponse(text);
  } catch (e) {
    console.error('[auditGemini]', e);
    return FALLBACK;
  }
}
