/**
 * Flag unreliable / suspicious engagement rates for display on profiles.
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

/**
 * Decide if an account's ER should be flagged.
 * Prefer AuditPro flags when present; otherwise use heuristics on stored metrics.
 */
export function detectErFlag(input: {
  engagement_rate?: string | null;
  posts_count?: number | string | null;
  avg_likes?: string | number | null;
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

  const posts =
    typeof input.posts_count === 'number'
      ? input.posts_count
      : Number(String(input.posts_count ?? '').replace(/[^\d.]/g, '')) || 0;
  if (posts > 0 && posts < 5) {
    return { suspicious: true, reason: 'low_sample', ...LABELS.low_sample };
  }

  const er = parseErPercent(erStr);
  if (er == null) return null;

  // Unrealistically high for organic feeds (e.g. 86% from 2–3 posts)
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
