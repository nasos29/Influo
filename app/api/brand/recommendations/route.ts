import { NextRequest, NextResponse } from "next/server";
import { isBrandUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import {
  brandProfileHash,
  rankWithGemini,
  rememberRanking,
  type BrandRecommendationInput,
  type GeminiRank,
  type RecommendationCandidate,
} from "@/lib/brandRecommendationGemini";
import { categoryLabel, parseStoredCategories } from "@/lib/categories";
import { packageTitle, packagesForViewer } from "@/lib/servicePackages";
import { listedPriceMin } from "@/lib/parsePrice";
import { sanitizeSkills, skillLabel } from "@/lib/skills";

export const runtime = "nodejs";

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function languagesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).slice(0, 6);
  return asText(value)
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function missingCacheTable(error: { code?: string; message?: string } | null): boolean {
  const message = (error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("brand_recommendation_cache");
}

async function brandIdFor(userId: string, email: string): Promise<string | null> {
  const admin = supabaseService();
  const byId = await admin.from("brands").select("id").eq("id", userId).maybeSingle();
  if (byId.data?.id) return String(byId.data.id);
  if (!email) return null;
  const priv = await admin.from("brand_private").select("brand_id").ilike("contact_email", email).maybeSingle();
  if (priv.data?.brand_id) return String(priv.data.brand_id);
  const byEmail = await admin.from("brands").select("id").ilike("contact_email", email).maybeSingle();
  return byEmail.data?.id ? String(byEmail.data.id) : null;
}

function candidateFromRow(row: Record<string, unknown>): RecommendationCandidate {
  const packages = packagesForViewer(row.service_packages, row.rate_card, row.accounts)
    .map((pkg) => ({
      label: packageTitle(pkg.platform, pkg.type, pkg.quantity || 1, "el"),
      price: listedPriceMin(pkg.price) ?? 0,
    }))
    .filter((pkg) => pkg.price > 0)
    .slice(0, 8);
  const skills = sanitizeSkills(row.skills).slice(0, 8).map((key) => skillLabel(key, "el") || key);
  return {
    id: String(row.id ?? ""),
    name: asText(row.display_name),
    categories: parseStoredCategories(row.category).map((key) => categoryLabel(key, "el")),
    skills,
    languages: languagesOf(row.languages),
    location: asText(row.location),
    packages,
  };
}

function asRanking(value: unknown): GeminiRank[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { ranking?: unknown }).ranking)) return null;
  const ranking = (value as { ranking: unknown[] }).ranking;
  const out: GeminiRank[] = [];
  for (const item of ranking) {
    if (!item || typeof item !== "object") return null;
    const row = item as { id?: unknown; reasons_el?: unknown; reasons_en?: unknown };
    const id = asText(row.id);
    if (!id || !Array.isArray(row.reasons_el) || !Array.isArray(row.reasons_en)) return null;
    if (row.reasons_el.length !== 3 || row.reasons_en.length !== 3) return null;
    if (row.reasons_el.some((line) => typeof line !== "string") || row.reasons_en.some((line) => typeof line !== "string")) {
      return null;
    }
    out.push({
      id,
      reasonsEl: row.reasons_el as [string, string, string],
      reasonsEn: row.reasons_en as [string, string, string],
    });
  }
  return out.length ? out : null;
}

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user || !(await isBrandUser(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map((id) => asText(id)).filter(Boolean))].slice(0, 30)
    : [];
  if (!ids.length) return NextResponse.json({ source: "rules", ranking: [] });

  const admin = supabaseService();
  const brandId = await brandIdFor(user.id, (user.email || "").trim());
  if (!brandId) return NextResponse.json({ error: "Brand not found" }, { status: 403 });

  const brandRow = await admin
    .from("brands")
    .select("id, brand_name, industry, bio, city, instagram, website")
    .eq("id", brandId)
    .maybeSingle();
  if (!brandRow.data) return NextResponse.json({ source: "rules", ranking: [] });

  const brand: BrandRecommendationInput = {
    name: asText(brandRow.data.brand_name),
    industry: asText(brandRow.data.industry),
    bio: asText(brandRow.data.bio),
    city: asText(brandRow.data.city),
    instagram: asText(brandRow.data.instagram),
    website: asText(brandRow.data.website),
  };
  const hash = brandProfileHash(brand);

  const cached = await admin
    .from("brand_recommendation_cache")
    .select("profile_hash, payload, expires_at")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!cached.error && cached.data && cached.data.profile_hash === hash) {
    const expires = new Date(String(cached.data.expires_at)).getTime();
    const ranking = expires > Date.now() ? asRanking(cached.data.payload) : null;
    if (ranking) {
      rememberRanking(brandId, hash, ranking);
      const visible = ranking.filter((row) => ids.includes(row.id)).slice(0, 8);
      if (!visible.length) return NextResponse.json({ source: "rules", ranking: [] });
      return NextResponse.json({ source: "gemini", ranking: visible.map(toJson) });
    }
  } else if (cached.error && !missingCacheTable(cached.error)) {
    console.error("[brand-recommendations] cache read failed");
  }

  const approved = await admin
    .from("influencers")
    .select("id, display_name, category, skills, languages, location, service_packages, rate_card, accounts, approved")
    .in("id", ids)
    .eq("approved", true);
  if (approved.error || !approved.data?.length) {
    return NextResponse.json({ source: "rules", ranking: [] });
  }
  const byId = new Map(approved.data.map((row) => [String(row.id), row as Record<string, unknown>]));
  const candidates = ids
    .map((id) => byId.get(id))
    .filter((row): row is Record<string, unknown> => !!row)
    .map(candidateFromRow)
    .filter((row) => row.id && row.name);

  const ranking = await rankWithGemini(brandId, hash, brand, candidates);
  if (!ranking) return NextResponse.json({ source: "rules", ranking: [] });

  const expiresAt = new Date(Date.now() + CACHE_MS).toISOString();
  const payload = { ranking: ranking.map(toJson) };
  const saved = await admin.from("brand_recommendation_cache").upsert(
    { brand_id: brandId, profile_hash: hash, payload, expires_at: expiresAt },
    { onConflict: "brand_id" }
  );
  if (saved.error && !missingCacheTable(saved.error)) {
    console.error("[brand-recommendations] cache write failed");
  }
  return NextResponse.json({ source: "gemini", ranking: payload.ranking });
}

function toJson(row: GeminiRank) {
  return { id: row.id, reasons_el: row.reasonsEl, reasons_en: row.reasonsEn };
}
