/**
 * Rank a short approved candidate list with the existing Gemini flash model.
 * Callers must already hold a cache hit or be willing to fall back.
 * The API key is never logged.
 */

import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isGeminiPaused } from "@/lib/geminiPause";

export type RecommendationCandidate = {
  id: string;
  name: string;
  categories: string[];
  skills: string[];
  languages: string[];
  location: string;
  packages: { label: string; price: number }[];
};

export type BrandRecommendationInput = {
  name: string;
  industry: string;
  bio: string;
  city: string;
  instagram: string;
  website: string;
};

export type GeminiRank = {
  id: string;
  reasonsEl: [string, string, string];
  reasonsEn: [string, string, string];
};

const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;
const MAX_RANKED = 8;

type MemoryHit =
  | { kind: "ok"; hash: string; expires: number; ranking: GeminiRank[] }
  | { kind: "fail"; hash: string; expires: number };

const memory = new Map<string, MemoryHit>();

export function brandProfileHash(input: BrandRecommendationInput): string {
  const stable = {
    name: input.name.trim(),
    industry: input.industry.trim(),
    bio: input.bio.trim(),
    city: input.city.trim(),
    instagram: input.instagram.trim(),
    website: input.website.trim(),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function clipReason(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 179).trimEnd()}…`;
}

function exactlyThree(value: unknown): [string, string, string] | null {
  if (!Array.isArray(value)) return null;
  const texts = value
    .map((item) => (typeof item === "string" ? clipReason(item) : ""))
    .filter(Boolean);
  if (texts.length < 3) return null;
  return [texts[0], texts[1], texts[2]];
}

/** Keep only rows whose id was in the candidate list and that have exactly three reasons in each language. */
export function parseGeminiRecommendation(raw: unknown, allowedIds: Iterable<string>): GeminiRank[] {
  const allowed = new Set(allowedIds);
  const record = raw && typeof raw === "object" ? (raw as { influencers?: unknown }) : null;
  const list = Array.isArray(raw) ? raw : Array.isArray(record?.influencers) ? record.influencers : [];
  const out: GeminiRank[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id ?? "").trim();
    if (!id || !allowed.has(id) || seen.has(id)) continue;
    const reasonsEl = exactlyThree((item as { reasons_el?: unknown }).reasons_el);
    const reasonsEn = exactlyThree((item as { reasons_en?: unknown }).reasons_en);
    if (!reasonsEl || !reasonsEn) continue;
    seen.add(id);
    out.push({ id, reasonsEl, reasonsEn });
    if (out.length >= MAX_RANKED) break;
  }
  return out;
}

function promptFor(brand: BrandRecommendationInput, candidates: RecommendationCandidate[]): string {
  return `You rank influencer candidates for one brand. Reply with JSON only:
{"influencers":[{"id":"...","reasons_el":["...","...","..."],"reasons_en":["...","...","..."]}]}
Rules:
- Use only ids from the candidate list. At most 8, best fit first.
- Every chosen influencer has exactly 3 reasons_el and exactly 3 reasons_en.
- reasons_el are Greek. reasons_en are English. Each reason is one short sentence.
- Base every reason on the brand profile and that influencer's categories, skills, packages, prices, location, or languages. Do not invent followers, past work, or prices.
- Skip a weak candidate instead of writing a vague reason.

Brand:
${JSON.stringify({
    name: brand.name,
    industry: brand.industry,
    bio: brand.bio.slice(0, 600),
    city: brand.city,
    instagram: brand.instagram,
    website: brand.website,
  })}

Candidates:
${JSON.stringify(candidates)}`;
}

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim();
}

function logGeminiFailure(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const safe = message.replace(/AIza[\w-]*/g, "[redacted]").slice(0, 300);
  console.error("[brand-recommendations] Gemini failed:", safe);
}

async function callGemini(brand: BrandRecommendationInput, candidates: RecommendationCandidate[]): Promise<GeminiRank[] | null> {
  if (isGeminiPaused()) return null;
  const apiKey = geminiKey();
  if (!apiKey) return null;
  const modelId = (process.env.GEMINI_AUDIT_MODEL || "gemini-2.0-flash").trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
  });
  const timer = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
  });
  const result = await Promise.race([
    model.generateContent(promptFor(brand, candidates)),
    timer,
  ]);
  const text = result.response.text?.()?.trim() ?? "";
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const ranking = parseGeminiRecommendation(parsed, candidates.map((row) => row.id));
  return ranking.length ? ranking : null;
}

export function readMemoryRanking(brandId: string, hash: string): GeminiRank[] | null | "skip" {
  const hit = memory.get(brandId);
  if (!hit || hit.hash !== hash || hit.expires <= Date.now()) return null;
  if (hit.kind === "fail") return "skip";
  return hit.ranking;
}

export function rememberRanking(brandId: string, hash: string, ranking: GeminiRank[]): void {
  memory.set(brandId, { kind: "ok", hash, expires: Date.now() + MEMORY_TTL_MS, ranking });
}

export function rememberFailure(brandId: string, hash: string): void {
  memory.set(brandId, { kind: "fail", hash, expires: Date.now() + FAILURE_TTL_MS });
}

export async function rankWithGemini(
  brandId: string,
  hash: string,
  brand: BrandRecommendationInput,
  candidates: RecommendationCandidate[]
): Promise<GeminiRank[] | null> {
  const cached = readMemoryRanking(brandId, hash);
  if (cached === "skip") return null;
  if (cached) return cached;
  try {
    const ranking = await callGemini(brand, candidates);
    if (!ranking) {
      rememberFailure(brandId, hash);
      return null;
    }
    rememberRanking(brandId, hash, ranking);
    return ranking;
  } catch (err) {
    logGeminiFailure(err);
    rememberFailure(brandId, hash);
    return null;
  }
}
