/**
 * completion_rate helpers.
 * DB historically defaulted the column to 100, which looked like a perfect
 * completion rate with zero collaborations. Callers must treat null as
 * "no data" and ignore rates when there is no collab evidence.
 */

export const COMPLETION_NONE_SUBTITLE = {
  el: 'Καμία συνεργασία ακόμα',
  en: 'No collaborations yet',
} as const;

export type CompletionLang = keyof typeof COMPLETION_NONE_SUBTITLE;

export type ResolveCompletionRateOptions = {
  /** When 0, rate is ignored (no proposals → no completion %). */
  proposalCount?: number | null;
  totalReviews?: number | null;
  completedCampaigns?: number | null;
  /**
   * When true (default), ignore the rate if totalReviews=0 and
   * completedCampaigns=0 — guards against leftover DB default 100.
   * Only applies when at least one evidence field was provided.
   */
  requireCollabEvidence?: boolean;
};

/**
 * Normalize a stored completion_rate for display or scoring.
 * Returns null when absent, when there are no proposals, or when the
 * no-evidence guard applies.
 */
export function resolveCompletionRate(
  completionRate: unknown,
  options?: ResolveCompletionRateOptions
): number | null {
  if (completionRate == null || completionRate === '') return null;
  const n =
    typeof completionRate === 'number' ? completionRate : Number(completionRate);
  if (!Number.isFinite(n) || n < 0) return null;

  if (options?.proposalCount != null && Number(options.proposalCount) <= 0) {
    return null;
  }

  const requireEvidence = options?.requireCollabEvidence !== false;
  const evidenceProvided =
    options?.totalReviews !== undefined || options?.completedCampaigns !== undefined;
  if (requireEvidence && evidenceProvided) {
    const reviews = Math.max(0, Number(options?.totalReviews) || 0);
    const camps = Math.max(0, Number(options?.completedCampaigns) || 0);
    if (reviews <= 0 && camps <= 0) return null;
  }

  return n;
}

/** Primary label + optional subtitle for profile/tools UI. */
export function formatCompletionRateDisplay(
  rate: number | null | undefined,
  lang: CompletionLang = 'el'
): { primary: string; subtitle: string | null } {
  if (rate == null) {
    return { primary: '—', subtitle: COMPLETION_NONE_SUBTITLE[lang] };
  }
  return { primary: `${rate}%`, subtitle: null };
}
