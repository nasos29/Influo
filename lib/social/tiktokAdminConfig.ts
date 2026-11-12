/**
 * Admin-only TikTok Login Kit spike configuration.
 * Ordinary influencers / brands must not use these endpoints during the testing phase.
 * Never reuses META_IG_TEST_INFLUENCER_ID.
 *
 * Pure gates live here for unit tests. resolveTikTokAdminSession lazy-loads apiAuth
 * so Node tests can import this module without next/server.
 */

export const ADMIN_TT_RETURN_PATH = "/admin/integrations/tiktok";
export const ADMIN_TT_OAUTH_PURPOSE = "admin_tt_test" as const;

/** Designated Influo influencer row that owns the encrypted TikTok test connection. */
export function tiktokTestInfluencerId(): string {
  return (process.env.TIKTOK_TEST_INFLUENCER_ID || "").trim();
}

export function requireTikTokTestInfluencerId(): string {
  const id = tiktokTestInfluencerId();
  if (!id) {
    throw new Error("TIKTOK_TEST_INFLUENCER_ID is not configured");
  }
  return id;
}

export function isTikTokTestInfluencerId(id: string | null | undefined): boolean {
  const expected = tiktokTestInfluencerId();
  if (!expected || !id) return false;
  return expected === id;
}

/** Pure gate used by connect route + unit tests (no I/O). */
export function evaluateAdminTtConnectAccess(opts: {
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
export function evaluateAdminTtCallbackOwnership(opts: {
  purpose?: string;
  stateInfluencerId: string;
  testInfluencerId: string;
  stateUidIsAdmin: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (opts.purpose !== ADMIN_TT_OAUTH_PURPOSE) return { ok: false, reason: "invalid_state" };
  if (!opts.testInfluencerId || opts.stateInfluencerId !== opts.testInfluencerId) {
    return { ok: false, reason: "influencer_mismatch" };
  }
  if (!opts.stateUidIsAdmin) return { ok: false, reason: "admin_required" };
  return { ok: true };
}

export type TikTokTestInfluencerRow = {
  id: string;
  display_name: string | null;
};

type InfluencerLookupClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        maybeSingle: () => Promise<{
          data: TikTokTestInfluencerRow | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

/**
 * Fail-closed existence check for TIKTOK_TEST_INFLUENCER_ID.
 * Does not invent UUIDs — returns not_found when the row is missing.
 */
export async function verifyTikTokTestInfluencerExists(
  influencerId: string,
  client: InfluencerLookupClient
): Promise<
  | { ok: true; influencer: TikTokTestInfluencerRow }
  | { ok: false; reason: "not_found" | "query_failed"; message?: string }
> {
  const id = (influencerId || "").trim();
  if (!id) return { ok: false, reason: "not_found" };
  const { data, error } = await client
    .from("influencers")
    .select("id, display_name")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, reason: "query_failed", message: error.message };
  if (!data?.id) return { ok: false, reason: "not_found" };
  return { ok: true, influencer: data };
}

export type TikTokAdminSessionUser = { id: string; email?: string | null };

export type TikTokAdminSessionResult =
  | {
      ok: true;
      user: TikTokAdminSessionUser;
      testInfluencerId: string;
      influencer: TikTokTestInfluencerRow;
    }
  | { ok: false; status: 401 | 403 | 503 | 404 | 500; reason: string };

/**
 * Full admin + env + influencer existence gate for TikTok connect/status/spike.
 * Uses existing apiAuth helpers (lazy import). Fail closed on any missing check.
 * Does not use META_IG_TEST_INFLUENCER_ID.
 */
export async function resolveTikTokAdminSession(request: Request): Promise<TikTokAdminSessionResult> {
  const { isAdminUser, supabaseService, userFromBearer } = await import("@/lib/apiAuth");

  const user = await userFromBearer(request);
  if (!user) return { ok: false, status: 401, reason: "unauthorized" };
  if (!(await isAdminUser(user))) return { ok: false, status: 403, reason: "forbidden" };

  const testInfluencerId = tiktokTestInfluencerId();
  if (!testInfluencerId) {
    return { ok: false, status: 503, reason: "test_influencer_unset" };
  }

  // Cast avoids TS "excessively deep" instantiation from the full Supabase client type.
  const exists = await verifyTikTokTestInfluencerExists(
    testInfluencerId,
    supabaseService() as unknown as InfluencerLookupClient
  );
  if (!exists.ok) {
    if (exists.reason === "not_found") {
      return { ok: false, status: 404, reason: "test_influencer_not_found" };
    }
    return { ok: false, status: 500, reason: "test_influencer_query_failed" };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email },
    testInfluencerId,
    influencer: exists.influencer,
  };
}
