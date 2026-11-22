/** Approval DB patch for new creators (analytics verified only when Insights check passed). */
export function buildNewInfluencerApprovalPatch(
  analyticsVerified: boolean,
  nowIso = new Date().toISOString()
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    analytics_verified: analyticsVerified,
    approved: true,
    approved_at: nowIso,
  };
  if (analyticsVerified) {
    patch.analytics_verified_at = nowIso;
  }
  return patch;
}