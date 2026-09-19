import { GoogleGenerativeAI } from '@google/generative-ai';

const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const LATIN_RE = /[A-Za-z]/;

export function bioLooksGreek(text: string): boolean {
  return GREEK_RE.test(text || '');
}

export function bioLooksEnglish(text: string): boolean {
  const t = text || '';
  return LATIN_RE.test(t) && !GREEK_RE.test(t);
}

export type BioPair = {
  bio: string | null;
  bio_en: string | null;
  changed: boolean;
  note: string;
};

async function translateWithGemini(text: string, target: 'el' | 'en'): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing');
  }
  const modelId = (process.env.GEMINI_AUDIT_MODEL || 'gemini-2.0-flash').trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });
  const prompt =
    target === 'en'
      ? `Translate this influencer biography from Greek to natural English. Return only the translation, no quotes or commentary.\n\n${text}`
      : `Translate this influencer biography from English to natural Greek. Return only the translation, no quotes or commentary.\n\n${text}`;
  const result = await model.generateContent(prompt);
  const out = result.response.text?.()?.trim() || '';
  if (!out) throw new Error('Empty Gemini translation');
  return out.replace(/^["']|["']$/g, '').trim();
}

/**
 * Greek bio → keep bio, fill bio_en.
 * English bio → move to bio_en, write Greek translation into bio.
 */
export async function ensureBilingualBio(
  bioRaw: string | null | undefined,
  bioEnRaw: string | null | undefined
): Promise<BioPair> {
  const bio = (bioRaw || '').trim();
  const bioEn = (bioEnRaw || '').trim();

  if (!bio && !bioEn) {
    return { bio: null, bio_en: null, changed: false, note: 'No bio to translate' };
  }

  if (bio && bioLooksGreek(bio)) {
    if (bioEn) {
      return { bio, bio_en: bioEn, changed: false, note: 'Greek bio already has English' };
    }
    const translated = await translateWithGemini(bio, 'en');
    return { bio, bio_en: translated, changed: true, note: 'Translated Greek bio → English' };
  }

  if (bio && bioLooksEnglish(bio)) {
    const english = bio;
    if (bioEn && bioLooksGreek(bioEn)) {
      return {
        bio: bioEn,
        bio_en: english,
        changed: true,
        note: 'Moved English to bio_en and kept existing Greek in bio',
      };
    }
    const greek = await translateWithGemini(english, 'el');
    return {
      bio: greek,
      bio_en: english,
      changed: true,
      note: 'Moved English bio → bio_en and translated to Greek',
    };
  }

  if (!bio && bioEn) {
    if (bioLooksGreek(bioEn)) {
      const translated = await translateWithGemini(bioEn, 'en');
      return { bio: bioEn, bio_en: translated, changed: true, note: 'bio_en was Greek; moved to bio and translated EN' };
    }
    const greek = await translateWithGemini(bioEn, 'el');
    return { bio: greek, bio_en: bioEn, changed: true, note: 'Translated English bio_en → Greek bio' };
  }

  return { bio: bio || null, bio_en: bioEn || null, changed: false, note: 'Bio left unchanged' };
}
