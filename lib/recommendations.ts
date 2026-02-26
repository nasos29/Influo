// Smart Recommendation System for Matching Influencers to Brands

export interface BrandProfile {
  id: string;
  brand_name: string;
  industry?: string | null; // Can be category or industry
  category?: string | null; // Preferred field name
  contact_email: string;
  location?: string | null; // Optional: for location-based matching
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
  /** Strategic audit – niche, brandSafe, whyWorkWithThem (for brands). */
  auditpr_audit?: AuditprAuditProfile | null;
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
  if (!rate) return 0;
  const clean = rate.toString().replace(/[€$,\s]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
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
  if (!brandIndustry) return 0.5;

  const industryLower = brandIndustry.toLowerCase().trim();
  const industryNorm = normalizeLabel(brandIndustry);
  const brandConcept = GREEK_TO_CONCEPT[industryNorm] || industryNorm.split(' ')[0] || industryNorm;
  const allCategories = influencerCategories || (influencerCategory ? [influencerCategory] : []);
  const hasGeneral = allCategories.some(
    (cat) => cat.toLowerCase().trim() === 'γενικά' || cat.toLowerCase().trim() === 'general'
  );
  if (hasGeneral && allCategories.length === 1) return 0.5;

  let bestMatch = 0;

  // 1) Audit niche (Gemini) – highest trust for brands
  if (auditNicheEn || auditNiche) {
    const nicheScoreEn = auditNicheEn ? labelMatchScore(brandIndustry, auditNicheEn) : 0;
    const nicheScoreEl = auditNiche ? labelMatchScore(brandIndustry, auditNiche) : 0;
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

  if (influencerCategory) {
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
  if (!brandLocation || !influencerLocation) return 0.5; // Neutral if not specified
  
  const brandLoc = brandLocation.toLowerCase().trim();
  const influencerLoc = influencerLocation.toLowerCase().trim();
  
  // Exact match
  if (brandLoc === influencerLoc) return 1.0;
  
  // Partial match (e.g., "Athens" matches "Αθήνα")
  if (brandLoc.includes(influencerLoc) || influencerLoc.includes(brandLoc)) {
    return 0.8;
  }
  
  // Common location keywords
  const greeceKeywords = ['ελλάδα', 'greece', 'gr', 'ellada'];
  if (greeceKeywords.some(kw => brandLoc.includes(kw) || influencerLoc.includes(kw))) {
    return 0.6; // Both in Greece
  }
  
  return 0.3; // Different locations
}

/**
 * Main recommendation function – professional algorithm for brands (category/niche, engagement, brand safe, value).
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
  }
): MatchScore[] {
  const limit = options?.limit || 10;
  const minScore = options?.minScore || 30;
  const preferVerified = options?.preferVerified !== false;
  const preferHighRating = options?.preferHighRating !== false;
  const lang = options?.lang || 'el';
  const isEn = lang === 'en';

  console.log('[Recommendations] Processing', influencers.length, 'influencers for brand:', brand.brand_name, 'category:', brand.category || brand.industry);

  const scores: MatchScore[] = influencers
    .map((influencer, index) => {
      const audit = influencer.auditpr_audit;
      const categoryMatch = calculateCategoryMatch(
        brand.category || brand.industry,
        influencer.category,
        influencer.categories,
        audit?.niche,
        audit?.niche_en
      );

      const locationMatch = brand.location && influencer.location
        ? calculateLocationMatch(brand.location, influencer.location)
        : 0.5;
      const brandSafeScore = audit?.brandSafe === true ? 1.0 : 0.5;

      const strengths = {
        categoryMatch: categoryMatch,
        nicheMatch: categoryMatch,
        engagementQuality: calculateEngagementQuality(influencer.engagement_rate),
        ratingQuality: calculateRatingQuality(influencer.avg_rating, influencer.total_reviews),
        valuePrice: calculateValueScore(
          influencer.min_rate,
          influencer.engagement_rate,
          influencer.followers_count
        ),
        locationMatch,
        verifiedStatus: influencer.verified ? 1.0 : 0.5,
        brandSafe: brandSafeScore,
      };

      // Weights: category/niche 35%, engagement 22%, value 14%, verified 5%, rating 14%, brandSafe 5%, location 5% (when used)
      let score = 0;
      score += strengths.categoryMatch * 35;
      score += strengths.engagementQuality * 22;
      score += strengths.valuePrice * 14;
      score += strengths.verifiedStatus * 5;
      score += strengths.brandSafe * 5;

      if (influencer.total_reviews && influencer.total_reviews > 0) {
        score += strengths.ratingQuality * 14;
      } else {
        score += 0.5 * 14;
      }

      if (locationMatch !== 0.5) {
        score += strengths.locationMatch * 5;
      } else {
        score += 0.5 * 5;
      }

      let bonusPoints = 0;
      if (strengths.categoryMatch >= 0.9 && strengths.engagementQuality >= 0.7) bonusPoints += 5;
      if (strengths.categoryMatch >= 0.9 && strengths.brandSafe === 1) bonusPoints += 2; // Niche + brand-safe
      if (influencer.total_reviews && influencer.total_reviews >= 10 && influencer.avg_rating && influencer.avg_rating >= 4.5) bonusPoints += 2;
      if (strengths.valuePrice >= 0.8 && strengths.engagementQuality >= 0.8) bonusPoints += 2;
      score += bonusPoints;
      score = Math.min(score, 100);

      const reasons: string[] = [];

      if (strengths.categoryMatch >= 0.99) {
        reasons.push(isEn ? `Perfect niche match for ${brand.category || brand.industry || 'you'} 🎯` : `ΤΕΛΕΙΟ match - Είδος ${brand.category || brand.industry || 'σου'} 🎯⭐`);
      } else if (strengths.categoryMatch >= 0.9) {
        reasons.push(isEn ? `Strong niche match (${audit?.niche_en || audit?.niche || brand.category || 'your industry'}) 🎯` : `Τέλειο match στο niche ${brand.category || brand.industry || 'σου'} 🎯`);
      } else if (strengths.categoryMatch >= 0.7) {
        reasons.push(isEn ? `Good fit for ${brand.category || brand.industry || 'your industry'}` : `Ταιριάζει στο niche ${brand.category || brand.industry || 'σου'}`);
      }

      if (strengths.engagementQuality >= 0.9) {
        const rate = parseEngagementRate(influencer.engagement_rate);
        reasons.push(isEn ? `Excellent engagement (${rate.toFixed(1)}%) ⭐` : `Εξαιρετικό engagement (${rate.toFixed(1)}%) ⭐`);
      } else if (strengths.engagementQuality >= 0.7) {
        const rate = parseEngagementRate(influencer.engagement_rate);
        reasons.push(isEn ? `High engagement rate (${rate.toFixed(1)}%)` : `Υψηλό engagement rate (${rate.toFixed(1)}%)`);
      }

      if (influencer.total_reviews && influencer.total_reviews > 0) {
        if (strengths.ratingQuality >= 0.9 && influencer.avg_rating && influencer.avg_rating >= 4.5) {
          reasons.push(isEn ? `Top rated (${influencer.avg_rating.toFixed(1)}/5, ${influencer.total_reviews} reviews) 🏆` : `Εξαιρετική αξιολόγηση (${influencer.avg_rating.toFixed(1)}/5 από ${influencer.total_reviews} reviews) 🏆`);
        } else if (strengths.ratingQuality >= 0.7 && influencer.avg_rating && influencer.avg_rating >= 4.0) {
          reasons.push(isEn ? `Good rating (${influencer.avg_rating.toFixed(1)}/5)` : `Καλή αξιολόγηση (${influencer.avg_rating.toFixed(1)}/5)`);
        }
      }

      if (strengths.valuePrice >= 0.8) {
        reasons.push(isEn ? 'Great value for money 💰' : 'Εξαιρετική αναλογία τιμής/ποιοτικότητας 💰');
      } else if (strengths.valuePrice >= 0.6) {
        reasons.push(isEn ? 'Good value' : 'Καλή αναλογία τιμής/ποιοτικότητας');
      }

      if (influencer.total_reviews && influencer.total_reviews >= 20) {
        reasons.push(isEn ? `Experienced (${influencer.total_reviews}+ collaborations)` : `Έμπειρος με ${influencer.total_reviews}+ συνεργασίες`);
      } else if (influencer.total_reviews && influencer.total_reviews >= 10) {
        reasons.push(isEn ? 'Experienced creator' : 'Έμπειρος creator');
      }

      if (influencer.verified) {
        reasons.push(isEn ? 'Verified ✅' : 'Επαληθευμένος ✅');
      }

      if (audit?.brandSafe === true) {
        reasons.push(isEn ? 'Brand Safe – low risk for campaigns ✓' : 'Ασφαλής για brands – χαμηλό ρίσκο για καμπάνιες ✓');
      }

      const positives = isEn ? (audit?.positives_en || audit?.positives) : (audit?.positives || audit?.positives_en);
      if (positives?.length && reasons.length < 5) {
        const shortPositive = positives.find((p) => p && p.length <= 120) || positives[0];
        if (shortPositive) {
          const text = shortPositive.length > 100 ? shortPositive.slice(0, 97) + '...' : shortPositive;
          if (!reasons.some((r) => r.includes(text.slice(0, 30)))) reasons.push(text);
        }
      }

      const whyLine = isEn ? (audit?.whyWorkWithThem_en || audit?.whyWorkWithThem) : (audit?.whyWorkWithThem || audit?.whyWorkWithThem_en);
      const auditWhyLine = whyLine ? (whyLine.split(/[.!]/)[0]?.trim() + (whyLine.includes('.') ? '.' : '') || whyLine.slice(0, 120)) : null;
      if (auditWhyLine && reasons.length < 5) {
        const trimmed = auditWhyLine.length > 100 ? auditWhyLine.slice(0, 97) + '...' : auditWhyLine;
        if (!reasons.includes(trimmed)) reasons.push(trimmed);
      }

      if (reasons.length === 0) {
        reasons.push(isEn ? 'Good fit for your brand' : 'Καλή επιλογή για το brand σας');
      }

      return {
        influencer,
        score: Math.round(score),
        reasons,
        auditWhyLine: auditWhyLine || null,
        strengths,
      };
    })
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, limit); // Limit results
    
  console.log('[Recommendations] Final matches:', scores.length, 'out of', influencers.length, 'influencers');
  console.log('[Recommendations] Top matches:', scores.slice(0, 5).map(m => ({ name: m.influencer.display_name, score: m.score })));
  
  return scores;
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

