/**
 * Admin-only Instagram Unified Login spike configuration.
 * Ordinary influencers must not use these endpoints during the testing phase.
 */

export const ADMIN_IG_RETURN_PATH = "/admin/integrations/instagram";

/** Designated Influo influencer row that owns the encrypted test connection. */
export function metaIgTestInfluencerId(): string {
  return (process.env.META_IG_TEST_INFLUENCER_ID || "").trim();
}

export function requireMetaIgTestInfluencerId(): string {
  const id = metaIgTestInfluencerId();
  if (!id) {
    throw new Error("META_IG_TEST_INFLUENCER_ID is not configured");
  }
  return id;
}

export function isMetaIgTestInfluencerId(id: string | null | undefined): boolean {
  const expected = metaIgTestInfluencerId();
  if (!expected || !id) return false;
  return expected === id;
}

/** Pure gate used by connect route + unit tests (no I/O). */
export function evaluateAdminIgConnectAccess(opts: {
  hasUser: boolean;
  isAdmin: boolean;
  queryInfluencerId?: string | null;
  testInfluencerId: string;
}): { status: 401 | 403 | 503 | 200; reason?: string } {
  if (!opts.hasUser) return { status: 401, reason: "unauthorized" };
  if (!opts.isAdmin) return { status: 403, reason: "forbidden" };
  if (!opts.testInfluencerId) return { status: 503, reason: "test_influencer_unset" };
  const q = (opts.queryInfluencerId || "").trim();
  if (q && q !== opts.testInfluencerId) {
    return { status: 403, reason: "influencer_mismatch" };
  }
  return { status: 200 };
}

/** Callback ownership checks after state signature verifies. */
export function evaluateAdminIgCallbackOwnership(opts: {
  purpose?: string;
  stateInfluencerId: string;
  testInfluencerId: string;
  stateUidIsAdmin: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (opts.purpose !== "admin_ig_test") return { ok: false, reason: "invalid_state" };
  if (!opts.testInfluencerId || opts.stateInfluencerId !== opts.testInfluencerId) {
    return { ok: false, reason: "influencer_mismatch" };
  }
  if (!opts.stateUidIsAdmin) return { ok: false, reason: "admin_required" };
  return { ok: true };
}
