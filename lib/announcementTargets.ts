/**
 * Admin announcement specific-recipient helpers (multi-select).
 * Keeps singular target_*_id compatible with target_*_ids arrays.
 */

export const MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS = 50;

export type CollectTargetIdsInput = {
  /** Legacy single id (string). */
  singular?: unknown;
  /** New multi ids (string[] or string). */
  plural?: unknown;
};

/**
 * Flatten singular + plural into a deduped list of non-empty trimmed ids
 * (order: first-seen from plural, then singular).
 */
export function collectTargetIds(input: CollectTargetIdsInput): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const addOne = (value: unknown) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) addOne(item);
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const s = String(value);
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
      return;
    }
    if (typeof value !== 'string') return;
    const s = value.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  addOne(input.plural);
  addOne(input.singular);
  return out;
}

export type ParseSpecificTargetIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; code: 'empty' | 'too_many'; error: string };

/**
 * Parse + dedupe specific recipient ids and enforce the 50-cap.
 * When `required`, empty → error (for specific / specific_brand).
 */
export function parseSpecificTargetIds(
  input: CollectTargetIdsInput & {
    required?: boolean;
    max?: number;
    /** Used in error text, e.g. "influencer" / "brand". */
    kind?: 'influencer' | 'brand';
  }
): ParseSpecificTargetIdsResult {
  const max = input.max ?? MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS;
  const kind = input.kind ?? 'influencer';
  const ids = collectTargetIds(input);

  if (ids.length === 0) {
    if (input.required) {
      return {
        ok: false,
        code: 'empty',
        error:
          kind === 'brand'
            ? 'target_brand_id or target_brand_ids required when target_type is specific_brand'
            : 'target_influencer_id or target_influencer_ids required when target_type is specific',
      };
    }
    return { ok: true, ids: [] };
  }

  if (ids.length > max) {
    return {
      ok: false,
      code: 'too_many',
      error: `At most ${max} recipients allowed per send (got ${ids.length})`,
    };
  }

  return { ok: true, ids };
}
