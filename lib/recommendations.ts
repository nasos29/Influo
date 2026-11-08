// Smart Recommendation System for Matching Influencers to Brands

import { categoryLabel, categoryTranslations, isGeneralCategory, parseStoredCategories } from "./categories.ts";
import { formatEuro } from "./formatEuro.ts";
import { INFLUENCER_LANGUAGES } from "./languages.ts";
import { listedPriceMin } from "./parsePrice.ts";
import { sanitizeSkills, skillLabel } from "./skills.ts";

export interface BrandProfile {
  id: string;
  brand_name: string;
  industry?: string | null; // Can be category or industry
  category?: string | null; // Preferred field name
  contact_email: string;
  location?: string | null; // Optional: for location-based matching
  /** Free text such as a campaign title or brand bio. Skills are matched against it. */
  brief?: string | null;
  /** Open or draft campaigns. Used only to check budget, platforms, and place. */
  campaigns?: BrandCampaignHint[] | null;
}

export interface BrandCampaignHint {
  title?: string | null;
  budget?: number | null;
  platforms?: string[] | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
}

/** Strategic audit from Gemini (auditpr_audit) – used for better matching and reasons. */
export interface AuditprAuditProfile {
  niche?: string | null;
  niche_en?: string | null;
  whyWorkWithThem?: string | null;
  whyWorkWithThem_en?: string | null;
  positives?: string[] | null;
  positives_en?: string[] | null;
  scoreBreakdown?: string[] | null;
  brandSafe?: boolean;
}

export interface InfluencerProfile {
  id: string | number;
  display_name: string;
  category?: string; // Primary category (for compatibility)
  categories?: string[]; // All categories (if available)
  engagement_rate?: string | { [key: string]: string } | null; // Can be per-platform object or legacy string (same as profile page)
  followers_count?: string | null;
  avg_likes?: string | { [key: string]: string } | null; // Per-platform or legacy (same as profile page)
  min_rate?: string | null;
  location?: string | null;
  gender?: string;
  avg_rating?: number | null;
  total_reviews?: number | null;
  past_brands?: any[] | number | null;
  verified?: boolean;
  accounts?: Array<{ platform: string; followers: string }> | null;
  audience_male_percent?: number | null;
  audience_female_percent?: number | null;
  audience_top_age?: string | null;
  bio?: string | null;
  rate_card?: {
    story?: string;
    post?: string;
    reel?: string;
    facebook?: string;
  } | null;
  profile_slug?: string | null;
  avatar_url?: string | null;
  /** Cheapest package, or min_rate when the creator has no package price. */
  from_price?: number | null;
  languages?: string[] | string | null;
  /** Strategic audit – niche, brandSafe, whyWorkWithThem (for brands). */
  auditpr_audit?: AuditprAuditProfile | null;
  /** Brand dashboard: email for messaging (not shown publicly). */
  contact_email?: string | null;
  skills?: string[] | null;
}

export interface MatchScore {
  influencer: InfluencerProfile;
  score: number; // 0-100
  reasons: string[];
  /** First line of "why work with them" from audit (for UI). */
  auditWhyLine?: string | null;
  strengths: {
    categoryMatch?: number;
    nicheMatch?: number;
    engagementQuality?: number;
    ratingQuality?: number;
    valuePrice?: number;
    locationMatch?: number;
    verifiedStatus?: number;
    brandSafe?: number; // 1 if audit says brand-safe, 0.5 otherwise
  };
}

/**
 * Parse engagement rate from string or per-platform object (e.g., "3.5%", "3.5", "High", or { instagram: "5.5%" })
 */
function parseEngagementRate(rate: string | { [key: string]: string } | null | undefined): number {
  if (!rate) return 0;
  
  // If it's an object (per-platform), calculate average or use first available
  if (typeof rate === 'object' && rate !== null && !Array.isArray(rate)) {
    const rates = Object.values(rate).filter(v => v && v !== '-');
    if (rates.length === 0) return 0;
    
    // Parse all rates and calculate average
    const parsedRates = rates.map(r => {
      const clean = r.toString().toLowerCase().trim().replace('%', '').replace(',', '.');
      if (clean.includes('high') || clean.includes('υψηλ')) return 4;
      if (clean.includes('medium') || clean.includes('μεσαί')) return 2.5;
      if (clean.includes('low') || clean.includes('χαμηλ')) return 1;
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    });
    
    const sum = parsedRates.reduce((acc, val) => acc + val, 0);
    return sum / parsedRates.length;
  }
  
  // Legacy string format
  const clean = rate.toString().toLowerCase().trim().replace('%', '').replace(',', '.');
  if (clean.includes('high') || clean.includes('υψηλ')) return 4;
  if (clean.includes('medium') || clean.includes('μεσαί')) return 2.5;
  if (clean.includes('low') || clean.includes('χαμηλ')) return 1;
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse followers count from string (e.g., "50K", "1.2M", "50000")
 */
function parseFollowers(followers: string | null | undefined): number {
  if (!followers) return 0;
  const clean = followers.toString().toLowerCase().trim().replace(',', '').replace(' ', '');
  if (clean.endsWith('k')) {
    return parseFloat(clean) * 1000;
  } else if (clean.endsWith('m')) {
    return parseFloat(clean) * 1000000;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse minimum rate from string (e.g., "€100", "100€", "100")
 */
function parseMinRate(rate: string | null | undefined): number {
  return listedPriceMin(rate) ?? 0;
}

/**
 * Normalize label for matching (lowercase, trim, remove & and accents-like)
 */
function normalizeLabel(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Audit fields are sometimes a string, a list, or a nested object. Callers must not .slice them raw. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ");
  return "";
}

export function asTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

/** Greek industry/category keywords → English concept for better matching */
const GREEK_TO_CONCEPT: { [key: string]: string } = {
  μόδα: 'fashion',
  μοδα: 'fashion',
  ομορφιά: 'beauty',
  ομορφια: 'beauty',
  μακιγιάζ: 'beauty',
  μακιαζ: 'beauty',
  ταξίδια: 'travel',
  ταξιδια: 'travel',
  φαγητό: 'food',
  φαγητο: 'food',
  υγεία: 'fitness',
  υγεια: 'fitness',
  τεχνολογία: 'tech',
  τεχνολογια: 'tech',
  επιχειρήσεις: 'business',
  οικονομικά: 'business',
  gaming: 'gaming',
  οικογένεια: 'family',
  lifestyle: 'lifestyle',
  γενικά: 'general',
};

/**
 * Match brand industry to a single label (category or niche)
 */
function canonicalCategoryKeys(value: unknown): string[] {
  const out: string[] = [];
  for (const cat of parseStoredCategories(value)) {
    if (!cat || isGeneralCategory(cat) || out.includes(cat)) continue;
    if (!categoryTranslations[cat]) continue;
    out.push(cat);
  }
  return out;
}

/**
 * Canonical categories listed by both sides.
 * Audit niche text is not a category. A loose alias inside another label does not count.
 * Empty when the creator does not list the brand's category.
 */
export function sharedCategoryKeys(brandValue: unknown, influencerValue: unknown): string[] {
  const influencer = new Set(canonicalCategoryKeys(influencerValue));
  return canonicalCategoryKeys(brandValue).filter((cat) => influencer.has(cat));
}

/** Shared-category sentence, or null when the intersection is empty. */
export function sharedCategoryReason(
  brandValue: unknown,
  influencerValue: unknown,
  lang: "el" | "en"
): string | null {
  const labels = sharedCategoryKeys(brandValue, influencerValue)
    .map((key) => categoryLabel(key, lang))
    .filter(Boolean);
  if (!labels.length) return null;
  const line = lang === "en" ? `Shared categories: ${labels.join(", ")}` : `Κοινές κατηγορίες: ${labels.join(", ")}`;
  return clipReason(line);
}

function clipReason(text: string, max = 96): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function labelMatchScore(brandIndustry: string, label: string): number {
  const brand = normalizeLabel(brandIndustry);
  const labelNorm = normalizeLabel(label);
  if (!brand || !labelNorm) return 0;
  if (brand === labelNorm) return 1.0;
  if (brand.includes(labelNorm) || labelNorm.includes(brand)) return 0.9;
  // Word overlap
  const brandWords = brand.split(' ');
  const labelWords = labelNorm.split(' ');
  if (brandWords.some((w) => labelWords.includes(w))) return 0.85;
  return 0;
}

/**
 * Calculate category + audit niche match (professional: use audit niche when available)
 */
function calculateCategoryMatch(
  brandIndustry: string | null | undefined,
  influencerCategory: string | undefined,
  influencerCategories?: string[],
  auditNiche?: string | null,
  auditNicheEn?: string | null
): number {
  const brandCategories = parseStoredCategories(brandIndustry).filter((cat) => !isGeneralCategory(cat));
  if (!brandIndustry) return 0.5;
  if (brandCategories.length === 0) return 0.5;

  const influencerKeys = parseStoredCategories(
    influencerCategories && influencerCategories.length ? influencerCategories : influencerCategory
  );

  return Math.max(
    ...brandCategories.map((cat) =>
      scoreOneBrandCategory(cat, influencerKeys[0], influencerKeys, auditNiche, auditNicheEn)
    )
  );
}

function scoreOneBrandCategory(
  brandIndustry: string,
  influencerCategory: string | undefined,
  influencerCategories: string[] | undefined,
  auditNiche?: string | null,
  auditNicheEn?: string | null
): number {
  const industryLower = brandIndustry.toLowerCase().trim();
  const industryNorm = normalizeLabel(brandIndustry);
  const brandConcept = GREEK_TO_CONCEPT[industryNorm] || industryNorm.split(' ')[0] || industryNorm;
  const allCategories = (influencerCategories || (influencerCategory ? [influencerCategory] : []))
    .map((cat) => (typeof cat === "string" ? cat : ""))
    .filter(Boolean);
  const hasGeneral = allCategories.some(
    (cat) => cat.toLowerCase().trim() === 'γενικά' || cat.toLowerCase().trim() === 'general'
  );
  if (hasGeneral && allCategories.length === 1) return 0.5;

  let bestMatch = 0;

  // 1) Audit niche (Gemini) – highest trust for brands
  const nicheEn = asText(auditNicheEn);
  const nicheEl = asText(auditNiche);
  if (nicheEn || nicheEl) {
    const nicheScoreEn = nicheEn ? labelMatchScore(brandIndustry, nicheEn) : 0;
    const nicheScoreEl = nicheEl ? labelMatchScore(brandIndustry, nicheEl) : 0;
    bestMatch = Math.max(bestMatch, nicheScoreEn, nicheScoreEl);
    if (bestMatch >= 0.9) return Math.min(1.0, bestMatch + 0.05); // Slight bonus for audit niche
  }

  // 2) Category exact/partial
  for (const cat of allCategories) {
    if (!cat) continue;
    const categoryLower = cat.toLowerCase().trim();
    if (industryLower === categoryLower) return 1.0;
    if (industryLower.includes(categoryLower) || categoryLower.includes(industryLower)) {
      bestMatch = Math.max(bestMatch, 0.9);
    }
  }
  if (bestMatch > 0) return bestMatch;

  if (typeof influencerCategory === "string" && influencerCategory) {
    const categoryLower = influencerCategory.toLowerCase().trim();
    if (industryLower === categoryLower) return 1.0;
  }

  const categoryMappings: { [key: string]: string[] } = {
    fashion: ['fashion & style', 'beauty & makeup', 'lifestyle'],
    tech: ['tech & gadgets', 'gaming & esports', 'business & finance'],
    food: ['food & drink', 'lifestyle', 'travel'],
    beauty: ['beauty & makeup', 'fashion & style', 'lifestyle'],
    fitness: ['health & fitness', 'sports & athletes', 'lifestyle'],
    travel: ['travel', 'lifestyle', 'photography'],
    business: ['business & finance', 'tech & gadgets', 'education & coaching'],
    unboxing: ['unboxing'],
  };

  for (const [industry, mappedCats] of Object.entries(categoryMappings)) {
    const brandMatchesIndustry =
      industryLower.includes(industry) ||
      industry.includes(industryLower) ||
      brandConcept === industry ||
      industryNorm.includes(industry);
    if (brandMatchesIndustry) {
      for (const cat of allCategories) {
        const catLower = cat.toLowerCase().trim();
        const catNorm = normalizeLabel(cat);
        const catConcept = GREEK_TO_CONCEPT[catNorm] || catNorm;
        if (
          mappedCats.some((mappedCat) => catLower.includes(mappedCat) || mappedCat.includes(catLower)) ||
          (catConcept && industry === catConcept)
        ) {
          bestMatch = Math.max(bestMatch, 0.85);
        }
      }
    }
  }

  for (const cat of allCategories) {
    const catLower = cat.toLowerCase().trim();
    if (industryLower.includes(catLower) || catLower.includes(industryLower)) {
      bestMatch = Math.max(bestMatch, 0.75);
    }
  }

  if (allCategories.some((cat) => cat.toLowerCase().includes('lifestyle'))) {
    bestMatch = Math.max(bestMatch, 0.6);
  }

  return bestMatch > 0 ? bestMatch : 0.3;
}

/**
 * Calculate engagement quality score (higher engagement = better)
 */
function calculateEngagementQuality(engagementRate: string | { [key: string]: string } | null | undefined): number {
  const rate = parseEngagementRate(engagementRate);
  if (rate === 0) return 0.5; // Neutral if unknown
  
  // Engagement rate scoring:
  // > 5% = Excellent (1.0)
  // 3-5% = Very Good (0.8)
  // 2-3% = Good (0.6)
  // 1-2% = Average (0.4)
  // < 1% = Low (0.2)
  
  if (rate >= 5) return 1.0;
  if (rate >= 3) return 0.8;
  if (rate >= 2) return 0.6;
  if (rate >= 1) return 0.4;
  return 0.2;
}

/**
 * Calculate rating quality score
 */
function calculateRatingQuality(
  avgRating: number | null | undefined,
  totalReviews: number | null | undefined
): number {
  if (!avgRating || !totalReviews || totalReviews === 0) return 0.5; // Neutral if no reviews
  
  // High rating + many reviews = best
  // Rating 4.5+ with 10+ reviews = 1.0
  // Rating 4+ with 5+ reviews = 0.8
  // Rating 3.5+ with reviews = 0.6
  // Lower ratings = 0.4-0.2
  
  if (avgRating >= 4.5 && totalReviews >= 10) return 1.0;
  if (avgRating >= 4 && totalReviews >= 5) return 0.8;
  if (avgRating >= 3.5 && totalReviews >= 1) return 0.6;
  if (avgRating >= 3) return 0.4;
  return 0.2;
}

/**
 * Calculate value/price score (lower price relative to engagement = better value)
 */
function calculateValueScore(
  minRate: string | null | undefined,
  engagementRate: string | { [key: string]: string } | null | undefined,
  followers: string | null | undefined
): number {
  const rate = parseMinRate(minRate);
  const engagement = parseEngagementRate(engagementRate);
  const followerCount = parseFollowers(followers);
  
  if (rate === 0 || engagement === 0 || followerCount === 0) return 0.5; // Neutral if missing data
  
  // Calculate Cost Per Engagement (CPE) - lower is better
  // CPE = cost / (engagement_rate * followers / 100)
  const potentialReach = followerCount;
  const engagementReach = (engagement / 100) * potentialReach; // Estimated engaged users per post
  
  if (engagementReach === 0) return 0.5;
  
  const costPerEngagement = rate / engagementReach;
  
  // Lower CPE = better value
  // Ideal CPE < 0.1€, Good < 0.5€, Average < 1€, Poor > 1€
  if (costPerEngagement < 0.1) return 1.0; // Excellent value
  if (costPerEngagement < 0.2) return 0.9;
  if (costPerEngagement < 0.5) return 0.8; // Very good
  if (costPerEngagement < 1.0) return 0.6; // Good
  if (costPerEngagement < 2.0) return 0.4; // Average
  return 0.2; // Poor value
}

/**
 * Calculate location match (if brand wants local influencers)
 */
function calculateLocationMatch(
  brandLocation?: string | null,
  influencerLocation?: string | null
): number {
  const brandLoc = asText(brandLocation).toLowerCase();
  const influencerLoc = asText(influencerLocation).toLowerCase();
  if (!brandLoc || !influencerLoc) return 0.5;
  
  if (placesMatch(brandLoc, influencerLoc)) return 1;
  if (brandLoc.includes(influencerLoc) || influencerLoc.includes(brandLoc)) return 0.8;
  
  // Common location keywords
  const greeceKeywords = ["ελλάδα", "greece", "ellada"];
  const brandInGreece = greeceKeywords.some((kw) => brandLoc.includes(kw));
  const creatorInGreece = greeceKeywords.some((kw) => influencerLoc.includes(kw));
  if (brandInGreece && creatorInGreece) return 0.6;
  
  return 0.3; // Different locations
}

const PLACE_ALIASES: string[][] = [
  ["αθηνα", "athens"],
  ["θεσσαλονικη", "thessaloniki", "salonika"],
  ["πατρα", "patras"],
  ["ηρακλειο", "heraklion"],
  ["λαρισα", "larissa"],
  ["βολος", "volos"],
  ["ιωαννινα", "ioannina"],
  ["χαλκιδα", "chalkida", "chalcis"],
  ["ροδος", "rhodes"],
  ["χανια", "chania"],
];

function foldPlace(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ς/g, "σ")
    .trim();
}

/** True only when both texts name the same place. One side saying "Greece" is not enough. */
export function placesMatch(a: string, b: string): boolean {
  const left = foldPlace(a);
  const right = foldPlace(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  return PLACE_ALIASES.some(
    (group) => group.some((token) => left.includes(token)) && group.some((token) => right.includes(token))
  );
}

function joinAnd(items: string[], lang: "el" | "en"): string {
  if (items.length <= 1) return items[0] || "";
  const last = items[items.length - 1];
  const head = items.slice(0, -1).join(", ");
  return lang === "el" ? `${head} και ${last}` : `${head} and ${last}`;
}

function creatorLanguageCodes(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : asText(value).split(/[,;/|]/);
  const codes: string[] = [];
  for (const part of parts) {
    const key = asText(part);
    if (!key) continue;
    const row = INFLUENCER_LANGUAGES.find(
      (lang) =>
        lang.code === key.toLowerCase() ||
        lang.el.toLowerCase() === key.toLowerCase() ||
        lang.en.toLowerCase() === key.toLowerCase()
    );
    if (row && !codes.includes(row.code)) codes.push(row.code);
  }
  return codes;
}

function mentionedLanguageCodes(text: string): string[] {
  const hay = foldPlace(text);
  if (!hay) return [];
  return INFLUENCER_LANGUAGES.filter((lang) => {
    const names = [lang.el, lang.en].map((name) => foldPlace(name)).filter((name) => name.length >= 4);
    const code = new RegExp(`(?:^|[^a-zα-ω])${lang.code}(?:$|[^a-zα-ω])`).test(hay);
    return code || names.some((name) => hay.includes(name));
  }).map((lang) => lang.code);
}

function platformLabel(platform: string): string {
  const key = platform.toLowerCase();
  if (key === "instagram") return "Instagram";
  if (key === "tiktok") return "TikTok";
  if (key === "youtube") return "YouTube";
  if (key === "facebook") return "Facebook";
  if (key === "twitter" || key === "x") return "X";
  return platform;
}

function bestEngagement(rate: InfluencerProfile["engagement_rate"]): { rate: number; platform: string | null } | null {
  if (!rate) return null;
  if (typeof rate === "object" && !Array.isArray(rate)) {
    let best: { rate: number; platform: string } | null = null;
    for (const [platform, raw] of Object.entries(rate)) {
      const value = parseEngagementRate(raw);
      if (!(value >= 2)) continue;
      if (!best || value > best.rate) best = { rate: value, platform };
    }
    return best;
  }
  const value = parseEngagementRate(rate);
  return value >= 2 ? { rate: value, platform: null } : null;
}

function pastBrandNames(value: InfluencerProfile["past_brands"]): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter(Boolean);
}

/**
 * Exactly three reasons when at least three facts match this brand.
 * Fewer only when there are not three true facts. No audit prose and no filler.
 */
export function buildMatchReasons(
  brand: BrandProfile,
  influencer: InfluencerProfile,
  matchedSkills: string[],
  lang: "el" | "en"
): string[] {
  const isEn = lang === "en";
  const reasons: string[] = [];
  const add = (text: string | null | undefined) => {
    const clean = clipReason(asText(text), 140);
    if (!clean || reasons.includes(clean) || reasons.length >= 3) return;
    reasons.push(clean);
  };

  const brandName = foldPlace(asText(brand.brand_name));
  const past = pastBrandNames(influencer.past_brands);
  const workedTogether = brandName.length >= 2 && past.some((name) => foldPlace(name) === brandName);
  if (workedTogether) {
    add(isEn ? "You have worked together before" : "Έχετε ήδη συνεργαστεί");
  }

  add(sharedCategoryReason(
    brand.category || brand.industry,
    influencer.categories?.length ? influencer.categories : influencer.category,
    lang
  ));

  const creatorPlace = asText(influencer.location);
  const brandPlaces = [brand.location, ...(brand.campaigns || []).map((campaign) => campaign.location)]
    .map((place) => asText(place))
    .filter(Boolean);
  if (creatorPlace && brandPlaces.some((place) => placesMatch(place, creatorPlace))) {
    add(isEn ? `Same area: ${creatorPlace}` : `Ίδια περιοχή: ${creatorPlace}`);
  }

  const fromPrice = influencer.from_price != null && influencer.from_price > 0
    ? influencer.from_price
    : listedPriceMin(influencer.min_rate);
  const fitting = (brand.campaigns || [])
    .map((campaign) => ({
      title: asText(campaign.title),
      budget: typeof campaign.budget === "number" ? campaign.budget : Number(campaign.budget),
    }))
    .filter((campaign) => Number.isFinite(campaign.budget) && campaign.budget > 0 && fromPrice != null && fromPrice <= campaign.budget)
    .sort((a, b) => a.budget - b.budget);
  if (fromPrice != null && fitting[0]) {
    const amount = formatEuro(fromPrice, lang);
    const budget = formatEuro(fitting[0].budget, lang);
    const title = fitting[0].title;
    add(
      title
        ? isEn
          ? `From ${amount}, within the “${title}” budget (${budget})`
          : `Από ${amount}, μέσα στο budget της «${title}» (${budget})`
        : isEn
          ? `From ${amount}, within a campaign budget (${budget})`
          : `Από ${amount}, μέσα σε budget καμπάνιας (${budget})`
    );
  }

  const wantedPlatforms = new Set(
    (brand.campaigns || [])
      .flatMap((campaign) => (Array.isArray(campaign.platforms) ? campaign.platforms : []))
      .map((platform) => asText(platform).toLowerCase())
      .filter(Boolean)
  );
  const creatorPlatforms = (Array.isArray(influencer.accounts) ? influencer.accounts : [])
    .map((account) => asText(account?.platform).toLowerCase())
    .filter((platform) => platform && wantedPlatforms.has(platform));
  const uniquePlatforms = [...new Set(creatorPlatforms)].map(platformLabel);
  if (uniquePlatforms.length) {
    add(
      isEn
        ? `${joinAnd(uniquePlatforms, "en")}, like your campaigns`
        : `${joinAnd(uniquePlatforms, "el")}, όπως οι καμπάνιες σας`
    );
  }

  if (matchedSkills.length) {
    const names = matchedSkills.slice(0, 3).map((key) => skillLabel(key, lang)).filter(Boolean);
    if (names.length) {
      add(isEn ? `Matching skills: ${names.join(", ")}` : `Δεξιότητες που ταιριάζουν: ${names.join(", ")}`);
    }
  }

  const brief = [
    brand.brief,
    ...(brand.campaigns || []).flatMap((campaign) => [campaign.title, campaign.description, campaign.category]),
  ].map((part) => asText(part)).filter(Boolean).join("\n");
  const asked = mentionedLanguageCodes(brief);
  const spoken = creatorLanguageCodes(influencer.languages).filter((code) => asked.includes(code));
  if (spoken.length) {
    const labels = spoken
      .slice(0, 2)
      .map((code) => INFLUENCER_LANGUAGES.find((row) => row.code === code)?.[lang] || "")
      .filter(Boolean);
    if (labels.length) {
      add(
        isEn
          ? `Speaks ${joinAnd(labels, "en")}, which you ask for`
          : `Μιλάει ${joinAnd(labels, "el")}, όπως ζητάτε`
      );
    }
  }

  const engagement = bestEngagement(influencer.engagement_rate);
  if (engagement) {
    const shown = lang === "el" ? engagement.rate.toFixed(1).replace(".", ",") : engagement.rate.toFixed(1);
    const where = engagement.platform ? platformLabel(engagement.platform) : "";
    add(
      where
        ? isEn
          ? `Engagement ${shown}% on ${where}`
          : `Engagement ${shown}% στο ${where}`
        : isEn
          ? `Engagement ${shown}%`
          : `Engagement ${shown}%`
    );
  }

  if (!workedTogether && past.length && reasons.length < 3) {
    const names = past.slice(0, 2).join(", ");
    add(isEn ? `Previous collaborations: ${names}` : `Προηγούμενες συνεργασίες: ${names}`);
  }

  return reasons.slice(0, 3);
}

/**
 * Displayed scores: never 100%, ties spread by 1, and never higher than the row above.
 * Order stays the incoming rank (highest raw score first).
 */
function spreadDisplayedScores<T extends { score: number }>(ranked: T[]): void {
  let prevShown = 96;
  let lastRaw: number | null = null;
  for (const match of ranked) {
    const tie = lastRaw !== null && match.score === lastRaw;
    lastRaw = match.score;
    const shown = Math.max(1, Math.min(95, match.score, tie ? prevShown - 1 : prevShown - (prevShown > match.score ? 0 : 1)));
    match.score = shown;
    prevShown = shown;
  }
}

/** Engagement above this, or on accounts below MIN_FOLLOWERS_FOR_ER, is treated as bad data. */
const MAX_PLAUSIBLE_ER = 25;
const MIN_FOLLOWERS_FOR_ER = 500;

type PlatformStat = { platform: string; followers: number; followersRaw: string; er: number | null; erRaw: string | null };

function platformStats(influencer: InfluencerProfile): PlatformStat[] {
  const out: PlatformStat[] = [];
  for (const acc of Array.isArray(influencer.accounts) ? influencer.accounts : []) {
    const a = acc as { platform?: string; followers?: string; engagement_rate?: string };
    if (!a?.platform) continue;
    const followers = parseFollowers(a.followers);
    const er = a.engagement_rate ? parseEngagementRate(a.engagement_rate) : 0;
    const plausible = er > 0 && er <= MAX_PLAUSIBLE_ER && followers >= MIN_FOLLOWERS_FOR_ER;
    out.push({ platform: a.platform.toLowerCase(), followers, followersRaw: String(a.followers ?? ""), er: plausible ? er : null, erRaw: plausible ? String(a.engagement_rate) : null });
  }
  return out;
}

/** 0..1 on a log scale: ~1k → 0.2, 10k → 0.55, 100k+ → 1. */
function reachScore(followers: number): number {
  if (!(followers > 0)) return 0.1;
  return Math.max(0.05, Math.min(1, (Math.log10(followers) - 2.4) / 2.6));
}

function budgetFitScore(price: number | null | undefined, budgetPerCreator: number | null | undefined): number {
  if (!budgetPerCreator || budgetPerCreator <= 0) return 0.5;
  if (!price || price <= 0) return 0.4; // unknown price: slightly below neutral
  const r = price / budgetPerCreator;
  if (r <= 1) return 1;
  if (r <= 1.3) return 0.6;
  if (r <= 2) return 0.3;
  return 0.1;
}

export type MatchContext = {
  /** Campaign wizard: only creators on these platforms, scored on those platforms. Dashboard: omit. */
  platforms?: string[] | null;
  budgetPerCreator?: number | null;
  goal?: string | null;
  /** Neighbouring categories that count as a weaker match. */
  relatedCategories?: string[] | null;
};

/**
 * Shared recommendation scoring (brand dashboard + campaign wizard). No AI calls.
 * Weights (of 100): category 35, engagement 20, reach 12, budget fit 10 (or value 10 when no budget),
 * value 8, location 5, rating 10 only when reviews exist; renormalized to 100. Skill bonus up to +4.
 */
export function recommendInfluencers(
  brand: BrandProfile,
  influencers: InfluencerProfile[],
  options?: {
    limit?: number;
    minScore?: number;
    preferVerified?: boolean;
    preferHighRating?: boolean;
    lang?: 'el' | 'en';
    context?: MatchContext;
  }
): MatchScore[] {
  const limit = options?.limit || 10;
  const minScore = options?.minScore || 30;
  const lang = options?.lang || 'el';
  const ctx = options?.context || {};
  const wantPlatforms = (ctx.platforms || []).map((p) => p.toLowerCase()).filter(Boolean);
  const related = ctx.relatedCategories || [];
  const brandCategory = brand.category || brand.industry;
  const reachWeight = ctx.goal === "ugc" ? 4 : ctx.goal === "awareness" ? 15 : 12;

  const list = Array.isArray(influencers) ? influencers : [];

  const scores: MatchScore[] = list
    .flatMap((original): MatchScore[] => {
      try {
      const all = platformStats(original);
      const stats = wantPlatforms.length ? all.filter((s) => wantPlatforms.includes(s.platform)) : all;
      if (wantPlatforms.length && stats.length === 0) return [];
      const best = stats.reduce<PlatformStat | null>((m, s) => (!m || s.followers > m.followers ? s : m), null);
      // Work on a view limited to the relevant platforms with only plausible engagement values.
      const erObj: Record<string, string> = {};
      for (const s of stats) if (s.erRaw) erObj[s.platform] = s.erRaw;
      const influencer: InfluencerProfile = {
        ...original,
        engagement_rate: Object.keys(erObj).length ? erObj : null,
        followers_count: best ? best.followersRaw : original.followers_count,
      };

      const audit = influencer.auditpr_audit;
      const cats = influencer.categories?.length ? influencer.categories : parseStoredCategories(influencer.category);
      const overlap = sharedCategoryKeys(brandCategory, cats);
      const nearOverlap = overlap.length ? [] : related.filter((c) => sharedCategoryKeys(c, cats).length > 0);
      let categoryMatch = calculateCategoryMatch(brandCategory, influencer.category, influencer.categories, audit?.niche, audit?.niche_en);
      const nicheHit = Boolean(brandCategory) && Math.max(
        labelMatchScore(String(brandCategory), asText(audit?.niche)),
        labelMatchScore(String(brandCategory), asText(audit?.niche_en))
      ) >= 0.85;
      if (overlap.length) {
        const primary = cats[0] && overlap.includes(cats[0]);
        categoryMatch = primary || nicheHit ? 1 : 0.85;
        if (cats.length > 5 && !primary && !nicheHit) categoryMatch -= 0.15; // ticks many categories
      } else if (nearOverlap.length) {
        categoryMatch = 0.6;
      } else {
        categoryMatch = Math.min(categoryMatch, 0.45);
      }

      const locationMatch = brand.location && influencer.location ? calculateLocationMatch(brand.location, influencer.location) : 0.5;
      const er = parseEngagementRate(influencer.engagement_rate);
      const engagementQuality = er > 0 ? calculateEngagementQuality(influencer.engagement_rate) : 0.35;
      const price = typeof influencer.from_price === "number" && influencer.from_price > 0 ? influencer.from_price : parseMinRate(influencer.min_rate) || null;
      const valuePrice = calculateValueScore(price ? String(price) : null, influencer.engagement_rate, influencer.followers_count);
      const budgetFit = budgetFitScore(price, ctx.budgetPerCreator);
      const reach = reachScore(best?.followers || 0);
      const hasReviews = Boolean(influencer.total_reviews && influencer.total_reviews > 0);
      const ratingQuality = calculateRatingQuality(influencer.avg_rating, influencer.total_reviews);

      const parts: Array<[number, number]> = [
        [categoryMatch, 35],
        [engagementQuality, 20],
        [reach, reachWeight],
        [valuePrice, 8],
        [ctx.budgetPerCreator ? budgetFit : valuePrice, 10],
        [locationMatch, brand.location ? 5 : 0],
        [ratingQuality, hasReviews ? 10 : 0],
      ];
      const totalW = parts.reduce((n, [, w]) => n + w, 0);
      let score = (parts.reduce((n, [v, w]) => n + v * w, 0) / totalW) * 100;

      const brief = asText(brand.brief).toLowerCase();
      const matchedSkills = sanitizeSkills(influencer.skills).filter((key) => {
        if (!brief) return false;
        const el = skillLabel(key, "el").toLowerCase();
        const en = skillLabel(key, "en").toLowerCase();
        const plain = key.replace(/_/g, " ");
        return brief.includes(el) || brief.includes(en) || brief.includes(plain) || brief.includes(key);
      });
      if (matchedSkills.length) score += Math.min(4, matchedSkills.length * 2);
      score = Math.min(score, 100);

      const reasons = buildMatchReasons(brand, influencer, matchedSkills, lang);
      if (!overlap.length && nearOverlap.length && reasons.length < 3) {
        const label = nearOverlap.map((c) => categoryLabel(c, lang) || c).slice(0, 2).join(", ");
        reasons.unshift(lang === "en" ? `Related category: ${label}` : `Σχετική κατηγορία: ${label}`);
      }
      if (best && best.followers >= 1000 && reasons.length < 3) {
        const n = best.followers >= 1000 ? `${Math.round(best.followers / 100) / 10}K`.replace(".0K", "K") : String(best.followers);
        reasons.push(lang === "en" ? `${n} followers on ${platformLabel(best.platform)}` : `${n} ακόλουθοι στο ${platformLabel(best.platform)}`);
      }

      return [{
        influencer: original,
        score: Math.round(score),
        reasons: reasons.slice(0, 3),
        auditWhyLine: null,
        strengths: { categoryMatch, nicheMatch: categoryMatch, engagementQuality, ratingQuality, valuePrice, locationMatch, verifiedStatus: influencer.verified ? 1 : 0.5, brandSafe: audit?.brandSafe === true ? 1 : 0.5 },
      }];
      } catch (err) {
        console.error("[Recommendations] skip influencer", original?.id, err);
        return [];
      }
    })
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score);

  spreadDisplayedScores(scores);
  return scores.slice(0, limit);
}

/** Total creators that pass the shared scoring (for "N ταιριάζουν"). */
export function countMatchingInfluencers(brand: BrandProfile, influencers: InfluencerProfile[], options?: { minScore?: number; context?: MatchContext }): number {
  return recommendInfluencers(brand, influencers, { ...options, limit: 100000 }).length;
}

/**
 * Get personalized recommendations based on brand's past proposals
 */
export async function getPersonalizedRecommendations(
  brandEmail: string,
  allInfluencers: InfluencerProfile[]
): Promise<MatchScore[]> {
  // In the future, we could analyze past proposals to learn preferences
  // For now, we'll use the general recommendation system
  
  // You could enhance this by:
  // 1. Fetching brand's past proposals
  // 2. Analyzing which influencers they collaborated with
  // 3. Learning from accepted/rejected proposals
  // 4. Adjusting weights based on past behavior
  
  return [];
}

