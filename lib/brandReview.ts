/** Marker in influencer_reviews.project_type: creator reviewed a brand (not brand→creator). */
export const BRAND_REVIEW_MARKER = "__of_brand__";

export function isBrandTargetReview(projectType: string | null | undefined): boolean {
  return String(projectType || "") === BRAND_REVIEW_MARKER;
}

/**
 * PostgREST `.or()` filter that keeps only brand→creator reviews (excludes the
 * creator→brand marker rows, including NULL project_type).
 */
export const CREATOR_TARGET_REVIEW_FILTER = `project_type.is.null,project_type.neq.${BRAND_REVIEW_MARKER}`;
