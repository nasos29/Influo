/**
 * Flag unreliable / suspicious engagement rates for display on profiles.
 *
 * Thresholds align with industry views-based TikTok ER (Modash/HypeAuditor:
 * strong ~3–6%) vs follower-based Instagram ER (Modash: likes÷followers).
 */

export type ErFlagReason =
  | 'quality_adjusted' // AuditPro lowered ER (possible fake followers)
  | 'estimated' // likes hidden / approximate ER
  | 'low_sample' // too few posts to trust the %
  | 'inflated'; // unrealistically high ER

export type ErFlag = {
  suspicious: boolean;
  reason: ErFlagReason;
  /** Short UI label */
  labelEl: string;
  labelEn: string;
  /** Longer hint for title/tooltip */
  hintEl: string;
  hintEn: string;
};

const LABELS: Record<ErFlagReason, Omit<ErFlag, 'suspicious' | 'reason'>> = {
  quality_adjusted: {
    labelEl: 'Ύποπτο ER',
    labelEn: 'Suspicious ER',
    hintEl: 'Το engagement φαίνεται χαμηλό για το μέγεθος του κοινού — πιθανόν ανενεργοί ή fake followers.',
    hintEn: 'Engagement looks low for this audience size — possible inactive or fake followers.',
  },
  estimated: {
    labelEl: 'Εκτίμηση',
    labelEn: 'Estimate',
    hintEl: 'Τα likes είναι κρυφά· το ER είναι εκτίμηση, όχι ακριβής μέτρηση.',
    hintEn: 'Likes are hidden; this ER is an estimate, not an exact measurement.',
  },
  low_sample: {
    labelEl: 'Αναξιόπιστο',
    labelEn: 'Unreliable',
    hintEl: 'Πολύ λίγα posts στο δείγμα — το ER μπορεί να μην είναι αντιπροσωπευτικό.',
    hintEn: 'Too few posts in the sample — this ER may not be representative.',
  },
  inflated: {
    labelEl: 'Ύποπτο ER',
    labelEn: 'Suspicious ER',
    hintEl: 'Το engagement είναι ασυνήθιστα υψηλό — πιθανόν λάθος μέτρηση ή πολύ μικρό δείγμα.',
    hintEn: 'Engagement is unusually high — possible measurement error or a tiny sample.',
  },
};

export function parseErPercent(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace(/~/g, '').replace(/%/g, '').replace(',', '.').trim();
  if (!s || s.toUpperCase() === 'N/A') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCount(raw: number | string | null | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Decide if an account's ER should be flagged.
 * Prefer AuditPro flags when present; otherwise use heuristics on stored metrics.
 */
export function detectErFlag(input: {
  engagement_rate?: string | null;
  posts_count?: number | string | null;
  avg_likes?: string | number | null;
  avg_views?: string | number | null;
  platform?: string | null;
  /** From AuditPro */
  suspected_fake_penalty?: boolean | null;
  engagement_hidden?: boolean | null;
  engagement_rate_raw?: string | null;
}): ErFlag | null {
  const erStr = String(input.engagement_rate || '').trim();
  if (!erStr || erStr.toUpperCase() === 'N/A' || erStr === '-') return null;

  if (input.suspected_fake_penalty) {
    return { suspicious: true, reason: 'quality_adjusted', ...LABELS.quality_adjusted };
  }
  if (input.engagement_hidden || erStr.startsWith('~')) {
    return { suspicious: true, reason: 'estimated', ...LABELS.estimated };
  }

  const posts = parseCount(input.posts_count);
  if (posts > 0 && posts < 5) {
    return { suspicious: true, reason: 'low_sample', ...LABELS.low_sample };
  }

  const er = parseErPercent(erStr);
  if (er == null) return null;

  const platform = String(input.platform || '').toLowerCase();
  const views = parseCount(input.avg_views);
  const likes = parseCount(input.avg_likes);

  // TikTok / YouTube: Modash+HypeAuditor use views-based ER (strong ~3–6%).
  // Legacy follower-based rows often sit at 30–200% — treat those as inflated/data issues.
  if (platform === 'tiktok' || platform === 'youtube') {
    const looksViewsBased = views > 0 && likes > 0 && likes <= views * 1.25 && er < 40;
    if (looksViewsBased) {
      // Views-based: >18% is extreme; >12% with tiny sample is shaky
      if (er >= 18) return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
      if (er >= 12 && posts > 0 && posts < 12) {
        return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
      }
      return null;
    }
    // Follower-based / broken views (likes >> views): only flag extreme outliers
    if (er >= 80) return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
    if (er >= 40 && posts > 0 && posts < 12) {
      return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
    }
    return null;
  }

  // Instagram (follower-based, Modash-style): organic ER rarely exceeds ~20–25%
  if (er >= 25) {
    return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
  }
  if (er >= 15 && posts > 0 && posts < 12) {
    return { suspicious: true, reason: 'inflated', ...LABELS.inflated };
  }

  return null;
}

export function erFlagFromReason(reason: ErFlagReason): ErFlag {
  return { suspicious: true, reason, ...LABELS[reason] };
}

export function erFlagLabel(flag: ErFlag, lang: 'el' | 'en'): string {
  return lang === 'el' ? flag.labelEl : flag.labelEn;
}

export function erFlagHint(flag: ErFlag, lang: 'el' | 'en'): string {
  return lang === 'el' ? flag.hintEl : flag.hintEn;
}
