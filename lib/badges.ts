// Badge system για influencers - όπως επιτυχημένες πλατφόρμες

export type BadgeType = 'new' | 'rising' | 'verified' | 'top_performer' | 'pro' | 'elite' | 'vip';

export interface Badge {
  type: BadgeType;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  priority: number; // Για sorting - μεγαλύτερο priority = πιο σημαντικό
}

interface InfluencerMetrics {
  verified?: boolean;
  followers?: { [key: string]: number | undefined };
  engagement_rate?: string;
  total_reviews?: number;
  avg_rating?: number;
  past_brands?: any[] | number;
  account_created_days?: number;
  min_rate?: string;
}

// Helper για υπολογισμό followers
const getMaxFollowers = (followers?: { [key: string]: number | undefined }): number => {
  if (!followers) return 0;
  const values = Object.values(followers).filter((v): v is number => v !== undefined && v !== null);
  return values.length ? Math.max(...values) : 0;
};

// Helper για engagement rate parsing
const parseEngagementRate = (rate?: string): number => {
  if (!rate) return 0;
  return parseFloat(rate.replace('%', '').replace(',', '.')) || 0;
};

// Helper για account age
const getAccountAgeDays = (createdAt?: string): number => {
  if (!createdAt) return 999; // Αν δεν υπάρχει, θεωρούμε ότι είναι παλιό account
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

// Badge definitions
const BADGE_DEFINITIONS: Record<BadgeType, Omit<Badge, 'type'>> = {
  new: {
    label: 'New',
    icon: '✨',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    priority: 1,
  },
  rising: {
    label: 'Rising',
    icon: '📈',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
    priority: 2,
  },
  verified: {
    label: 'Verified',
    icon: '✓',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 border-blue-300',
    priority: 3,
  },
  top_performer: {
    label: 'Top Performer',
    icon: '🏆',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100 border-purple-300',
    priority: 4,
  },
  pro: {
    label: 'Pro',
    icon: '⭐',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100 border-amber-300',
    priority: 5,
  },
  elite: {
    label: 'Elite',
    icon: '💎',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100 border-indigo-300',
    priority: 6,
  },
  vip: {
    label: 'VIP',
    icon: '👑',
    color: 'text-yellow-700',
    bgColor: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400',
    priority: 7,
  },
};

// Greek translations
const BADGE_LABELS_EL: Record<BadgeType, string> = {
  new: 'Νέος',
  rising: 'Ανερχόμενος',
  verified: 'Επαληθευμένος',
  top_performer: 'Top Performer',
  pro: 'Pro',
  elite: 'Elite',
  vip: 'VIP',
};

export function getBadges(metrics: InfluencerMetrics, lang: 'el' | 'en' = 'el'): Badge[] {
  const badges: Badge[] = [];
  const maxFollowers = getMaxFollowers(metrics.followers);
  const engagementRate = parseEngagementRate(metrics.engagement_rate);
  const accountAgeDays = metrics.account_created_days || 999;
  const numBrands = Array.isArray(metrics.past_brands) ? metrics.past_brands.length : (metrics.past_brands || 0);
  const totalReviews = metrics.total_reviews || 0;
  const avgRating = metrics.avg_rating || 0;
  const minRate = metrics.min_rate ? parseFloat(metrics.min_rate.replace(/[^0-9.]/g, '')) : 0;

  // NEW - Account < 30 days
  if (accountAgeDays < 30) {
    badges.push({
      type: 'new',
      ...BADGE_DEFINITIONS.new,
      label: lang === 'el' ? BADGE_LABELS_EL.new : BADGE_DEFINITIONS.new.label,
    });
  }

  // RISING - Account 30-90 days με καλό engagement
  if (accountAgeDays >= 30 && accountAgeDays < 90 && engagementRate > 3 && maxFollowers < 50000) {
    badges.push({
      type: 'rising',
      ...BADGE_DEFINITIONS.rising,
      label: lang === 'el' ? BADGE_LABELS_EL.rising : BADGE_DEFINITIONS.rising.label,
    });
  }

  // VERIFIED - Manual verification
  if (metrics.verified) {
    badges.push({
      type: 'verified',
      ...BADGE_DEFINITIONS.verified,
      label: lang === 'el' ? BADGE_LABELS_EL.verified : BADGE_DEFINITIONS.verified.label,
    });
  }

  // TOP PERFORMER - High engagement rate (>5%) και followers > 10k
  if (engagementRate > 5 && maxFollowers > 10000) {
    badges.push({
      type: 'top_performer',
      ...BADGE_DEFINITIONS.top_performer,
      label: lang === 'el' ? BADGE_LABELS_EL.top_performer : BADGE_DEFINITIONS.top_performer.label,
    });
  }

  // PRO - 5+ συνεργασίες ή 10+ reviews με rating > 4.0
  if (numBrands >= 5 || (totalReviews >= 10 && avgRating >= 4.0)) {
    badges.push({
      type: 'pro',
      ...BADGE_DEFINITIONS.pro,
      label: lang === 'el' ? BADGE_LABELS_EL.pro : BADGE_DEFINITIONS.pro.label,
    });
  }

  // ELITE - 500k+ followers ή 20+ συνεργασίες με rating > 4.5
  if (maxFollowers >= 500000 || (numBrands >= 20 && avgRating >= 4.5)) {
    badges.push({
      type: 'elite',
      ...BADGE_DEFINITIONS.elite,
      label: lang === 'el' ? BADGE_LABELS_EL.elite : BADGE_DEFINITIONS.elite.label,
    });
  }

  // VIP - 1M+ followers ή min_rate > 5000€ ή 50+ συνεργασίες με perfect rating
  if (maxFollowers >= 1000000 || minRate >= 5000 || (numBrands >= 50 && avgRating >= 4.8)) {
    badges.push({
      type: 'vip',
      ...BADGE_DEFINITIONS.vip,
      label: lang === 'el' ? BADGE_LABELS_EL.vip : BADGE_DEFINITIONS.vip.label,
    });
  }

  // Sort by priority (highest first)
  badges.sort((a, b) => b.priority - a.priority);

  // Return only top 2-3 badges για να μην γεμίσει η κάρτα
  return badges.slice(0, 3);
}

// Export badge styling function
export function getBadgeStyles(badge: Badge) {
  return `${badge.bgColor} ${badge.color} border px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1`;
}

