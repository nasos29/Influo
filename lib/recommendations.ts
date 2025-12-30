// Smart Recommendation System for Matching Influencers to Brands

export interface BrandProfile {
  id: string;
  brand_name: string;
  industry?: string | null; // Can be category or industry
  category?: string | null; // Preferred field name
  contact_email: string;
  // We can add more fields later like budget_range, target_audience, etc.
}

export interface InfluencerProfile {
  id: string | number;
  display_name: string;
  category?: string; // Primary category (for compatibility)
  categories?: string[]; // All categories (if available)
  engagement_rate?: string | null;
  followers_count?: string | null;
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
}

export interface MatchScore {
  influencer: InfluencerProfile;
  score: number; // 0-100
  reasons: string[];
  strengths: {
    categoryMatch?: number;
    engagementQuality?: number;
    ratingQuality?: number;
    valuePrice?: number;
    locationMatch?: number;
    verifiedStatus?: number;
  };
}

/**
 * Parse engagement rate from string (e.g., "3.5%", "3.5", "High")
 */
function parseEngagementRate(rate: string | null | undefined): number {
  if (!rate) return 0;
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
 * Calculate category match score
 */
function calculateCategoryMatch(
  brandIndustry: string | null | undefined,
  influencerCategory: string | undefined,
  influencerCategories?: string[]
): number {
  if (!brandIndustry) return 0.5; // Neutral if brand has no category
  
  // Normalize category names for comparison
  const industryLower = brandIndustry.toLowerCase().trim();
  
  // Check if influencer has "Γενικά" or "General" - matches everything with high score
  const allCategories = influencerCategories || (influencerCategory ? [influencerCategory] : []);
  const hasGeneral = allCategories.some(cat => 
    cat.toLowerCase().trim() === 'γενικά' || cat.toLowerCase().trim() === 'general'
  );
  
  if (hasGeneral) {
    return 0.95; // Very high score for "General" category
  }
  
  // Check all influencer categories against brand category
  let bestMatch = 0;
  
  for (const cat of allCategories) {
    if (!cat) continue;
    
    const categoryLower = cat.toLowerCase().trim();
    
    // Exact match - highest priority!
    if (industryLower === categoryLower) {
      return 1.0; // Perfect match - return immediately
    }
    
    // Check partial matches
    if (industryLower.includes(categoryLower) || categoryLower.includes(industryLower)) {
      bestMatch = Math.max(bestMatch, 0.9);
    }
  }
  
  // Return best match found if we have one
  if (bestMatch > 0) return bestMatch;
  
  // Fallback: If no match found in multiple categories, try primary category
  if (influencerCategory) {
    const categoryLower = influencerCategory.toLowerCase().trim();
    // Exact match
    if (industryLower === categoryLower) return 1.0;
  }
  
  // Category mapping for better matching (only if no exact match found)
  const categoryMappings: { [key: string]: string[] } = {
    'fashion': ['fashion & style', 'beauty & makeup', 'lifestyle'],
    'tech': ['tech & gadgets', 'gaming & esports', 'business & finance'],
    'food': ['food & drink', 'lifestyle', 'travel'],
    'beauty': ['beauty & makeup', 'fashion & style', 'lifestyle'],
    'fitness': ['health & fitness', 'sports & athletes', 'lifestyle'],
    'travel': ['travel', 'lifestyle', 'photography'],
    'business': ['business & finance', 'tech & gadgets', 'education & coaching'],
  };
  
  // Check if brand industry matches any mapped categories
  for (const [industry, mappedCats] of Object.entries(categoryMappings)) {
    if (industryLower.includes(industry) || industry.includes(industryLower)) {
      for (const cat of allCategories) {
        const catLower = cat.toLowerCase().trim();
        if (mappedCats.some(mappedCat => catLower.includes(mappedCat) || mappedCat.includes(catLower))) {
          bestMatch = Math.max(bestMatch, 0.85);
        }
      }
    }
  }
  
  // Partial match
  for (const cat of allCategories) {
    const catLower = cat.toLowerCase().trim();
    if (industryLower.includes(catLower) || catLower.includes(industryLower)) {
      bestMatch = Math.max(bestMatch, 0.75);
    }
  }
  
  // Lifestyle is a good general match
  if (allCategories.some(cat => cat.toLowerCase().includes('lifestyle'))) {
    bestMatch = Math.max(bestMatch, 0.6);
  }
  
  return bestMatch > 0 ? bestMatch : 0.3; // Weak match if nothing found
}

/**
 * Calculate engagement quality score (higher engagement = better)
 */
function calculateEngagementQuality(engagementRate: string | null | undefined): number {
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
  engagementRate: string | null | undefined,
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
 * Main recommendation function
 */
export function recommendInfluencers(
  brand: BrandProfile,
  influencers: InfluencerProfile[],
  options?: {
    limit?: number;
    minScore?: number;
    preferVerified?: boolean;
    preferHighRating?: boolean;
  }
): MatchScore[] {
  const limit = options?.limit || 10;
  const minScore = options?.minScore || 30;
  const preferVerified = options?.preferVerified !== false; // Default true
  const preferHighRating = options?.preferHighRating !== false; // Default true
  
  const scores: MatchScore[] = influencers
    .filter(inf => inf.verified !== false) // Only verified influencers
    .map(influencer => {
      const strengths = {
        categoryMatch: calculateCategoryMatch(
          brand.category || brand.industry, 
          influencer.category,
          influencer.categories
        ),
        engagementQuality: calculateEngagementQuality(influencer.engagement_rate),
        ratingQuality: calculateRatingQuality(influencer.avg_rating, influencer.total_reviews),
        valuePrice: calculateValueScore(
          influencer.min_rate,
          influencer.engagement_rate,
          influencer.followers_count
        ),
        locationMatch: 0.5, // Can be improved if we add brand location
        verifiedStatus: influencer.verified ? 1.0 : 0.5,
      };
      
      // Calculate weighted overall score with smart adjustments
      let score = 0;
      
      // Category match is most important (35% weight) - exact match gets bonus
      score += strengths.categoryMatch * 35;
      
      // Engagement quality (25% weight)
      score += strengths.engagementQuality * 25;
      
      // Rating quality (20% weight) - only if has reviews
      if (influencer.total_reviews && influencer.total_reviews > 0) {
        score += strengths.ratingQuality * 20;
      } else {
        // If no reviews, give neutral score (50%) but lower weight
        score += 0.5 * 15; // Reduced weight for unrated influencers
      }
      
      // Value/Price ratio (15% weight)
      score += strengths.valuePrice * 15;
      
      // Verified status (5% weight - bonus, not critical)
      score += strengths.verifiedStatus * 5;
      
      // Bonus points for multiple strengths
      let bonusPoints = 0;
      if (strengths.categoryMatch >= 0.9 && strengths.engagementQuality >= 0.7) {
        bonusPoints += 5; // High category match + good engagement
      }
      if (influencer.total_reviews && influencer.total_reviews >= 10 && influencer.avg_rating && influencer.avg_rating >= 4.5) {
        bonusPoints += 3; // Well-reviewed and highly rated
      }
      if (strengths.valuePrice >= 0.8 && strengths.engagementQuality >= 0.8) {
        bonusPoints += 2; // Great value + high engagement
      }
      
      score += bonusPoints;
      
      // Cap at 100
      score = Math.min(score, 100);
      
      // Generate match reasons (prioritize most important)
      const reasons: string[] = [];
      
      // Category match is top priority - give extra emphasis for exact matches
      if (strengths.categoryMatch >= 0.99) {
        reasons.push(`ΤΕΛΕΙΟ match - Είδος ${brand.category || brand.industry || 'σου'} 🎯⭐`);
      } else if (strengths.categoryMatch >= 0.9) {
        reasons.push(`Τέλειο match στο niche ${brand.category || brand.industry || 'σου'} 🎯`);
      } else if (strengths.categoryMatch >= 0.7) {
        reasons.push(`Ταιριάζει στο niche ${brand.category || brand.industry || 'σου'}`);
      }
      
      // Engagement quality
      if (strengths.engagementQuality >= 0.9) {
        const rate = parseEngagementRate(influencer.engagement_rate);
        reasons.push(`Εξαιρετικό engagement (${rate.toFixed(1)}%) ⭐`);
      } else if (strengths.engagementQuality >= 0.7) {
        const rate = parseEngagementRate(influencer.engagement_rate);
        reasons.push(`Υψηλό engagement rate (${rate.toFixed(1)}%)`);
      }
      
      // Rating quality (only if has reviews)
      if (influencer.total_reviews && influencer.total_reviews > 0) {
        if (strengths.ratingQuality >= 0.9 && influencer.avg_rating && influencer.avg_rating >= 4.5) {
          reasons.push(`Εξαιρετική αξιολόγηση (${influencer.avg_rating.toFixed(1)}/5 από ${influencer.total_reviews} reviews) 🏆`);
        } else if (strengths.ratingQuality >= 0.7 && influencer.avg_rating && influencer.avg_rating >= 4.0) {
          reasons.push(`Καλή αξιολόγηση (${influencer.avg_rating.toFixed(1)}/5)`);
        }
      }
      
      // Value/Price
      if (strengths.valuePrice >= 0.8) {
        reasons.push(`Εξαιρετική αναλογία τιμής/ποιοτικότητας 💰`);
      } else if (strengths.valuePrice >= 0.6) {
        reasons.push(`Καλή αναλογία τιμής/ποιοτικότητας`);
      }
      
      // Experience
      if (influencer.total_reviews && influencer.total_reviews >= 20) {
        reasons.push(`Έμπειρος με ${influencer.total_reviews}+ συνεργασίες`);
      } else if (influencer.total_reviews && influencer.total_reviews >= 10) {
        reasons.push(`Έμπειρος creator`);
      }
      
      // Verified (always mention if verified)
      if (influencer.verified) {
        reasons.push(`Επαληθευμένος ✅`);
      }
      
      // Add default reason if none
      if (reasons.length === 0) {
        reasons.push('Καλή επιλογή για το brand σας');
      }
      
      return {
        influencer,
        score: Math.round(score),
        reasons,
        strengths,
      };
    })
    .filter(match => match.score >= minScore)
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .slice(0, limit); // Limit results
    
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

