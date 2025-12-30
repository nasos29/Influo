// Smart Recommendation System for Matching Influencers to Brands

export interface BrandProfile {
  id: string;
  brand_name: string;
  industry?: string | null;
  contact_email: string;
  // We can add more fields later like budget_range, target_audience, etc.
}

export interface InfluencerProfile {
  id: string | number;
  display_name: string;
  category?: string;
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
  influencerCategory: string | undefined
): number {
  if (!brandIndustry || !influencerCategory) return 0.5; // Neutral if missing
  
  const industryLower = brandIndustry.toLowerCase().trim();
  const categoryLower = influencerCategory.toLowerCase().trim();
  
  // Exact match
  if (industryLower === categoryLower) return 1.0;
  
  // Category mapping for better matching
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
  for (const [industry, categories] of Object.entries(categoryMappings)) {
    if (industryLower.includes(industry) || industry.includes(industryLower)) {
      if (categories.some(cat => categoryLower.includes(cat) || cat.includes(categoryLower))) {
        return 0.9;
      }
    }
  }
  
  // Partial match
  if (industryLower.includes(categoryLower) || categoryLower.includes(industryLower)) {
    return 0.7;
  }
  
  // Lifestyle is a good general match
  if (categoryLower.includes('lifestyle')) return 0.6;
  
  return 0.3; // Weak match
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
  
  // Calculate engagement value (engagement per €100)
  const engagementValue = (engagement * followerCount) / (rate / 100);
  
  // Higher engagement value = better score
  // This is a simplified calculation - in production, you'd want more sophisticated logic
  if (engagementValue > 1000) return 1.0;
  if (engagementValue > 500) return 0.8;
  if (engagementValue > 200) return 0.6;
  if (engagementValue > 100) return 0.4;
  return 0.2;
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
        categoryMatch: calculateCategoryMatch(brand.industry, influencer.category),
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
      
      // Calculate weighted overall score
      let score = 0;
      score += strengths.categoryMatch * 30; // 30% weight
      score += strengths.engagementQuality * 25; // 25% weight
      score += strengths.ratingQuality * 20; // 20% weight (if preferHighRating)
      score += strengths.valuePrice * 15; // 15% weight
      score += strengths.verifiedStatus * 10; // 10% weight
      
      // Generate match reasons
      const reasons: string[] = [];
      
      if (strengths.categoryMatch >= 0.8) {
        reasons.push(`Ταιριάζει στο niche ${brand.industry || 'σου'}`);
      }
      
      if (strengths.engagementQuality >= 0.8) {
        const rate = parseEngagementRate(influencer.engagement_rate);
        reasons.push(`Υψηλό engagement rate (${rate.toFixed(1)}%)`);
      }
      
      if (strengths.ratingQuality >= 0.8 && influencer.avg_rating && influencer.total_reviews) {
        reasons.push(`Εξαιρετική αξιολόγηση (${influencer.avg_rating.toFixed(1)}/5 από ${influencer.total_reviews} reviews)`);
      }
      
      if (strengths.valuePrice >= 0.7) {
        reasons.push(`Καλή αναλογία τιμής/ποιοτικότητας`);
      }
      
      if (influencer.verified) {
        reasons.push(`Επαληθευμένος influencer`);
      }
      
      if (influencer.total_reviews && influencer.total_reviews > 5) {
        reasons.push(`Έμπειρος με ${influencer.total_reviews}+ συνεργασίες`);
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

