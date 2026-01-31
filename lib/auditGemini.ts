/**
 * Gemini strategic audit – same prompt as Auditpr (backend/services/gemini.py audit_with_gemini).
 * Used by /api/admin/refresh-audit so Influo can get the audit without calling localhost Auditpr.
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) in env.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

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

export type AuditResult = {
  scoreBreakdown: string[];
  scoreBreakdown_en?: string[];
  brandSafe: boolean;
  niche?: string;
  niche_en?: string;
};

function buildPrompt(platform: string, username: string, metrics: AuditMetrics): string {
  const I = metrics;
  const followers = I.followers ?? 'N/A';
  const er = I.engagement_rate ?? 'N/A';
  const avg_likes = I.avg_likes != null ? String(I.avg_likes) : 'N/A';
  const avg_comments = I.avg_comments != null ? String(I.avg_comments) : 'N/A';
  const posts =
    I.posts_count != null ? ` Posts: ${I.posts_count}.` : '';
  const cat = I.category_name ? ` Κατηγορία: ${I.category_name}.` : '';
  const bio = I.biography
    ? ` Bio: ${String(I.biography).slice(0, 300)}.`
    : '';
  const engagement_note = I.engagement_hidden
    ? ' Σημείωση: Avg Likes/Comments και ER είναι εκτίμηση (ο λογαριασμός κρύβει τα likes).'
    : '';
  let brand_mention = '';
  if (
    I.brand_mention_er != null ||
    I.brand_mention_effectiveness != null ||
    I.brand_mention_saturation != null
  ) {
    brand_mention = ` Brand mention: ER ${I.brand_mention_er ?? '—'}%, Effectiveness ${I.brand_mention_effectiveness ?? '—'}%, Saturation ${I.brand_mention_saturation ?? '—'}%.`;
  }
  const is_tiktok = (platform || '').toLowerCase() === 'tiktok';
  const lang_note = is_tiktok
    ? ' Πλατφόρμα: TikTok. Κάθε scoreBreakdown ΑΠΟΚΛΕΙΣΤΙΚΑ στα Ελληνικά.'
    : ' Κάθε scoreBreakdown στα Ελληνικά.';
  const niche_rule =
    ' niche: ΕΝΑ συγκεκριμένο niche στα αγγλικά, επαγγελματικά συμπερασμένο ΑΠΟ το περιεχόμενο (bio, κατηγορία, τόνος). ' +
    'Π.χ. Fashion, Model, Beauty & Makeup, Fitness, Food, Travel, Gaming, Comedy, Music, Education. ' +
    'ΣΗΜΑΝΤΙΚΟ: Αν το προφίλ δείχνει φωτογραφίες/μοντέλο/στυλ (fashion, modelling, aesthetic) ΜΗΝ βάζεις Humor ή Comedy – διάλεξε Fashion, Model ή Beauty & Makeup. ' +
    'Χρησιμοποίησε Humor/Comedy ΜΟΝΟ αν το bio ή το context δείχνουν ξεκάθαρα αστείο περιεχόμενο. ' +
    'ΑΠΑΓΟΡΕΥΕΤΑΙ: Creator, Content Creator, Influencer, Lifestyle (ως default). ΜΗΝ γράψεις Άγνωστο.';

  return (
    `Ανάλυσε το προφίλ @${username} στο ${platform}. ` +
    `Δεδομένα: Followers: ${followers}, ER: ${er}, Avg Likes: ${avg_likes}, Avg Comments: ${avg_comments}.${posts}${cat}${bio}${brand_mention}${engagement_note} ` +
    `Δημιούργησε Strategic Audit (JSON): scoreBreakdown (4 strings, καθεμία στα Ελληνικά), scoreBreakdown_en (4 strings, same content in English), brandSafe (boolean),${niche_rule} niche_en (same niche in English, one word or short phrase).${lang_note} ` +
    'Επίστρεψε ΜΟΝΟ έγκυρο JSON με τα πεδία scoreBreakdown, scoreBreakdown_en, brandSafe, niche, niche_en.'
  );
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
 * Run Gemini strategic audit with the same prompt as Auditpr.
 * Uses GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY. Model: gemini-2.0-flash (or GEMINI_AUDIT_MODEL).
 */
export async function runAuditGemini(
  platform: string,
  username: string,
  metrics: AuditMetrics
): Promise<AuditResult> {
  const apiKey =
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[auditGemini] GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not set');
    return FALLBACK;
  }

  const modelId = (process.env.GEMINI_AUDIT_MODEL || 'gemini-2.0-flash').trim();
  const prompt = buildPrompt(platform, username, metrics);

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
