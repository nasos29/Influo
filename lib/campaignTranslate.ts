import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseService } from "@/lib/apiAuth";

const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const LATIN_RE = /[A-Za-z]/;

export type CampaignEnFields = {
  title_en: string | null;
  description_en: string | null;
  deliverables_en: string | null;
};

function looksGreek(text: string): boolean {
  return GREEK_RE.test(text || "");
}

function looksEnglish(text: string): boolean {
  const t = text || "";
  return LATIN_RE.test(t) && !GREEK_RE.test(t);
}

function cleanTranslation(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").trim();
}

async function translateFieldsWithGemini(input: {
  title: string;
  description: string;
  deliverables: string;
}): Promise<{ title: string; description: string; deliverables: string }> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const modelId = (process.env.GEMINI_AUDIT_MODEL || "gemini-flash-latest").trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const prompt = `Translate this influencer marketing campaign from Greek to natural English.
Keep packaging/platform names (Stories, Reels, TikTok, YouTube, Instagram, Post) when present.
Return ONLY valid JSON with keys title, description, deliverables. No markdown.

Title: ${input.title}
Description: ${input.description}
Deliverables: ${input.deliverables || "(none)"}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text?.()?.trim() || "";
  if (!raw) throw new Error("Empty Gemini campaign translation");

  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(jsonText) as {
    title?: unknown;
    description?: unknown;
    deliverables?: unknown;
  };

  const title = cleanTranslation(typeof parsed.title === "string" ? parsed.title : "");
  const description = cleanTranslation(
    typeof parsed.description === "string" ? parsed.description : ""
  );
  let deliverables = cleanTranslation(
    typeof parsed.deliverables === "string" ? parsed.deliverables : ""
  );
  if (!input.deliverables.trim() || /^ \(?none\)?$/i.test(deliverables)) deliverables = "";

  if (!title || !description) throw new Error("Incomplete Gemini campaign translation");
  return { title, description, deliverables };
}

/**
 * Derive English copies of campaign title/description/deliverables.
 * Greek source → translate. Already-English source → copy as-is.
 */
export async function ensureCampaignEnglish(input: {
  title: string;
  description: string;
  deliverables?: string | null;
  title_en?: string | null;
  description_en?: string | null;
  deliverables_en?: string | null;
  /** When true, retranslate even if EN fields already exist. */
  force?: boolean;
}): Promise<CampaignEnFields & { changed: boolean; note: string }> {
  const title = (input.title || "").trim();
  const description = (input.description || "").trim();
  const deliverables = (input.deliverables || "").trim();
  const prevTitleEn = (input.title_en || "").trim();
  const prevDescEn = (input.description_en || "").trim();
  const prevDelEn = (input.deliverables_en || "").trim();

  if (!title || !description) {
    return {
      title_en: null,
      description_en: null,
      deliverables_en: null,
      changed: false,
      note: "Missing title/description",
    };
  }

  const hasCompleteEn = !!(prevTitleEn && prevDescEn && (!deliverables || prevDelEn));
  if (!input.force && hasCompleteEn) {
    return {
      title_en: prevTitleEn,
      description_en: prevDescEn,
      deliverables_en: deliverables ? prevDelEn : null,
      changed: false,
      note: "English already present",
    };
  }

  const sourceIsEnglish =
    looksEnglish(title) && looksEnglish(description) && (!deliverables || looksEnglish(deliverables));

  if (sourceIsEnglish) {
    const next = {
      title_en: title,
      description_en: description,
      deliverables_en: deliverables || null,
    };
    const changed =
      next.title_en !== prevTitleEn ||
      next.description_en !== prevDescEn ||
      (next.deliverables_en || "") !== prevDelEn;
    return { ...next, changed, note: "Source already English; copied to *_en" };
  }

  // Mostly Greek (or mixed) → Gemini EN.
  if (looksGreek(title) || looksGreek(description) || looksGreek(deliverables) || !sourceIsEnglish) {
    const translated = await translateFieldsWithGemini({ title, description, deliverables });
    const next = {
      title_en: translated.title,
      description_en: translated.description,
      deliverables_en: translated.deliverables || null,
    };
    const changed =
      next.title_en !== prevTitleEn ||
      next.description_en !== prevDescEn ||
      (next.deliverables_en || "") !== prevDelEn;
    return { ...next, changed, note: "Translated Greek campaign → English" };
  }

  return {
    title_en: prevTitleEn || null,
    description_en: prevDescEn || null,
    deliverables_en: prevDelEn || null,
    changed: false,
    note: "Left unchanged",
  };
}

/** Load a campaign, ensure EN fields, persist if needed. */
export async function refreshCampaignEnglish(
  campaignId: string,
  opts?: { force?: boolean }
): Promise<void> {
  const admin = supabaseService();
  const { data, error } = await admin
    .from("brand_campaigns")
    .select("id, title, description, deliverables, title_en, description_en, deliverables_en")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    if (/title_en|description_en|deliverables_en|column/i.test(error.message || "")) {
      console.warn("[campaignTranslate] EN columns missing; skip", campaignId);
      return;
    }
    throw error;
  }
  if (!data) return;

  const next = await ensureCampaignEnglish({
    title: data.title || "",
    description: data.description || "",
    deliverables: data.deliverables,
    title_en: data.title_en,
    description_en: data.description_en,
    deliverables_en: data.deliverables_en,
    force: opts?.force === true,
  });

  if (!next.changed) return;

  const { error: updateError } = await admin
    .from("brand_campaigns")
    .update({
      title_en: next.title_en,
      description_en: next.description_en,
      deliverables_en: next.deliverables_en,
    })
    .eq("id", campaignId);

  if (updateError) {
    if (/title_en|description_en|deliverables_en|column/i.test(updateError.message || "")) {
      console.warn("[campaignTranslate] EN columns missing on update; skip", campaignId);
      return;
    }
    throw updateError;
  }
}

/** Backfill open campaigns missing English copy (best-effort, capped). */
export async function backfillOpenCampaignsEnglish(limit = 40): Promise<{
  checked: number;
  updated: number;
}> {
  const admin = supabaseService();
  const { data, error } = await admin
    .from("brand_campaigns")
    .select("id, title, description, deliverables, title_en, description_en, deliverables_en")
    .eq("status", "open")
    .or("title_en.is.null,description_en.is.null")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (/title_en|description_en|column/i.test(error.message || "")) {
      return { checked: 0, updated: 0 };
    }
    throw error;
  }

  let updated = 0;
  for (const row of data || []) {
    try {
      const before = (row.title_en || "").trim() && (row.description_en || "").trim();
      await refreshCampaignEnglish(String(row.id), { force: !before });
      const { data: after } = await admin
        .from("brand_campaigns")
        .select("title_en, description_en")
        .eq("id", row.id)
        .maybeSingle();
      if (after?.title_en && after?.description_en) updated += 1;
    } catch (err) {
      console.error("[campaignTranslate] backfill failed", row.id, err);
    }
  }
  return { checked: (data || []).length, updated };
}
