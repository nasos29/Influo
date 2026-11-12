/**
 * TikTok Login Kit + Display API (official open.tiktokapis.com v2).
 * Tokens and client_secret stay server-side only.
 *
 * Docs:
 * - https://developers.tiktok.com/doc/login-kit-web
 * - https://developers.tiktok.com/doc/oauth-user-access-token-management
 * - https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
 * - https://developers.tiktok.com/doc/tiktok-api-v2-video-list
 */

export const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_API_BASE = "https://open.tiktokapis.com";
export const TIKTOK_TOKEN_PATH = "/v2/oauth/token/";
export const TIKTOK_REVOKE_PATH = "/v2/oauth/revoke/";
export const TIKTOK_USER_INFO_PATH = "/v2/user/info/";
export const TIKTOK_VIDEO_LIST_PATH = "/v2/video/list/";

/** Scopes requested for admin Display API testing (must be enabled on the TikTok app). */
export const TIKTOK_DEFAULT_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
] as const;

export const TIKTOK_USER_INFO_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "display_name",
  "bio_description",
  "profile_deep_link",
  "is_verified",
  "username",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
] as const;

export const TIKTOK_VIDEO_LIST_FIELDS = [
  "id",
  "title",
  "video_description",
  "duration",
  "cover_image_url",
  "share_url",
  "embed_link",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
  "create_time",
] as const;

const FETCH_TIMEOUT_MS = 20_000;
const VIDEO_MAX_COUNT = 20;
const VIDEO_MAX_PAGES = 25;

export function tiktokClientKey(): string {
  const key = (process.env.TIKTOK_CLIENT_KEY || "").trim();
  if (!key) throw new Error("TIKTOK_CLIENT_KEY is not configured");
  return key;
}

export function tiktokClientSecret(): string {
  const secret = (process.env.TIKTOK_CLIENT_SECRET || "").trim();
  if (!secret) throw new Error("TIKTOK_CLIENT_SECRET is not configured");
  return secret;
}

export function tiktokRedirectUri(): string {
  return (
    (process.env.TIKTOK_REDIRECT_URI || "").trim() ||
    "https://www.influo.gr/api/social/tiktok/callback"
  );
}

export function tiktokScopes(): string {
  const fromEnv = (process.env.TIKTOK_SCOPES || "").trim();
  if (fromEnv) return fromEnv;
  return TIKTOK_DEFAULT_SCOPES.join(",");
}

/** Build TikTok Login Kit authorize URL (official v2 auth page). */
export function buildTikTokAuthorizeUrl(state: string, opts?: { scopes?: string }): string {
  const url = new URL(TIKTOK_AUTH_BASE);
  url.searchParams.set("client_key", tiktokClientKey());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", opts?.scopes ?? tiktokScopes());
  url.searchParams.set("redirect_uri", tiktokRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export type TikTokTokenResult = {
  openId: string;
  scope: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  tokenType: string;
};

export type TikTokTokenError = {
  ok: false;
  error: string;
  errorCode?: string;
  httpStatus: number;
  /** True when the caller should re-authorize the user. */
  requiresReauth?: boolean;
};

type RawTokenBody = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  log_id?: string;
  /** Legacy nested wrapper (older docs) — still accepted if present. */
  data?: RawTokenBody;
  message?: string;
};

/** Validate and normalize a TikTok OAuth token JSON body (no secrets logged). */
export function parseTikTokTokenResponse(
  body: unknown,
  httpStatus: number
): { ok: true; token: TikTokTokenResult } | TikTokTokenError {
  const raw = (body && typeof body === "object" ? body : {}) as RawTokenBody;
  const payload: RawTokenBody =
    raw.data && typeof raw.data === "object" && raw.data.access_token ? raw.data : raw;

  if (payload.error && payload.error !== "ok") {
    const code = String(payload.error);
    return {
      ok: false,
      error: payload.error_description || code,
      errorCode: code,
      httpStatus,
      requiresReauth: isReauthTokenError(code),
    };
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token.trim() : "";
  const openId = typeof payload.open_id === "string" ? payload.open_id.trim() : "";
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : NaN;
  const refreshExpiresIn =
    typeof payload.refresh_expires_in === "number" ? payload.refresh_expires_in : NaN;

  if (!accessToken || !refreshToken || !openId) {
    return {
      ok: false,
      error: "invalid_token_response",
      httpStatus,
      requiresReauth: httpStatus === 401,
    };
  }
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return { ok: false, error: "invalid_expires_in", httpStatus };
  }
  if (!Number.isFinite(refreshExpiresIn) || refreshExpiresIn <= 0) {
    return { ok: false, error: "invalid_refresh_expires_in", httpStatus };
  }

  return {
    ok: true,
    token: {
      openId,
      scope: typeof payload.scope === "string" ? payload.scope : "",
      accessToken,
      expiresIn,
      refreshToken,
      refreshExpiresIn,
      tokenType: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
    },
  };
}

function isReauthTokenError(code: string): boolean {
  const c = code.toLowerCase();
  return (
    c.includes("invalid_grant") ||
    c.includes("access_token_invalid") ||
    c.includes("refresh_token_invalid") ||
    c.includes("access_denied") ||
    c === "401"
  );
}

async function postTokenForm(
  params: Record<string, string>
): Promise<{ ok: true; token: TikTokTokenResult } | TikTokTokenError> {
  const url = `${TIKTOK_API_BASE}${TIKTOK_TOKEN_PATH}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_request_failed";
    return { ok: false, error: redactSecrets(message), httpStatus: 0 };
  }

  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `token_http_${res.status}`, httpStatus: res.status };
  }

  const parsed = parseTikTokTokenResponse(body, res.status);
  if (!parsed.ok) return parsed;
  if (!res.ok) {
    return {
      ok: false,
      error: `token_http_${res.status}`,
      httpStatus: res.status,
      requiresReauth: res.status === 401,
    };
  }
  return parsed;
}

/** Exchange authorization code for access + refresh tokens (server-only). */
export async function exchangeTikTokCodeForToken(
  code: string
): Promise<{ ok: true; token: TikTokTokenResult } | TikTokTokenError> {
  const trimmed = (code || "").trim();
  if (!trimmed) return { ok: false, error: "missing_code", httpStatus: 400 };

  return postTokenForm({
    client_key: tiktokClientKey(),
    client_secret: tiktokClientSecret(),
    code: trimmed,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(),
  });
}

/**
 * Refresh access token. Always persist the returned refresh_token (rotation).
 * Official: POST /v2/oauth/token/ with grant_type=refresh_token.
 */
export async function refreshTikTokAccessToken(
  refreshToken: string
): Promise<{ ok: true; token: TikTokTokenResult } | TikTokTokenError> {
  const trimmed = (refreshToken || "").trim();
  if (!trimmed) return { ok: false, error: "missing_refresh_token", httpStatus: 400 };

  return postTokenForm({
    client_key: tiktokClientKey(),
    client_secret: tiktokClientSecret(),
    grant_type: "refresh_token",
    refresh_token: trimmed,
  });
}

/** Optional revoke on disconnect (official /v2/oauth/revoke/). */
export async function revokeTikTokAccessToken(
  accessToken: string
): Promise<{ ok: true } | { ok: false; error: string; httpStatus: number }> {
  const trimmed = (accessToken || "").trim();
  if (!trimmed) return { ok: false, error: "missing_access_token", httpStatus: 400 };

  const url = `${TIKTOK_API_BASE}${TIKTOK_REVOKE_PATH}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: tiktokClientKey(),
        client_secret: tiktokClientSecret(),
        token: trimmed,
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `revoke_http_${res.status}`, httpStatus: res.status };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "revoke_failed";
    return { ok: false, error: redactSecrets(message), httpStatus: 0 };
  }
}

export type TikTokUserProfile = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  bio_description?: string;
  profile_deep_link?: string;
  is_verified?: boolean;
  username?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
};

export type TikTokApiError = {
  ok: false;
  error: string;
  errorCode?: string;
  httpStatus: number;
  rateLimited?: boolean;
  expiredToken?: boolean;
  requiresReauth?: boolean;
};

type DisplayError = { code?: string; message?: string; log_id?: string };

function mapDisplayError(
  httpStatus: number,
  err?: DisplayError | null
): TikTokApiError {
  const code = (err?.code || "").trim() || `http_${httpStatus}`;
  const message = (err?.message || code).trim();
  const lower = `${code} ${message}`.toLowerCase();
  const rateLimited = httpStatus === 429 || lower.includes("rate_limit");
  const expiredToken =
    lower.includes("access_token_invalid") ||
    lower.includes("expired") ||
    httpStatus === 401;
  const requiresReauth =
    expiredToken ||
    lower.includes("scope_not_authorized") ||
    lower.includes("authorization") ||
    lower.includes("revoked");

  return {
    ok: false,
    error: redactSecrets(message),
    errorCode: code === "ok" ? undefined : code,
    httpStatus,
    rateLimited,
    expiredToken,
    requiresReauth,
  };
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asOptionalBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Map TikTok user object — never assumes optional fields exist. */
export function mapTikTokUserProfile(raw: Record<string, unknown> | null | undefined): TikTokUserProfile {
  if (!raw || typeof raw !== "object") return {};
  return {
    open_id: asOptionalString(raw.open_id),
    union_id: asOptionalString(raw.union_id),
    avatar_url: asOptionalString(raw.avatar_url),
    display_name: asOptionalString(raw.display_name),
    bio_description: asOptionalString(raw.bio_description),
    profile_deep_link: asOptionalString(raw.profile_deep_link),
    is_verified: asOptionalBoolean(raw.is_verified),
    username: asOptionalString(raw.username),
    follower_count: asOptionalNumber(raw.follower_count),
    following_count: asOptionalNumber(raw.following_count),
    likes_count: asOptionalNumber(raw.likes_count),
    video_count: asOptionalNumber(raw.video_count),
  };
}

export async function fetchTikTokUserInfo(
  accessToken: string,
  fields: readonly string[] = TIKTOK_USER_INFO_FIELDS
): Promise<{ ok: true; user: TikTokUserProfile; raw: Record<string, unknown> } | TikTokApiError> {
  const token = (accessToken || "").trim();
  if (!token) return { ok: false, error: "missing_access_token", httpStatus: 400 };

  const url = new URL(`${TIKTOK_API_BASE}${TIKTOK_USER_INFO_PATH}`);
  url.searchParams.set("fields", fields.join(","));

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "user_info_failed";
    return { ok: false, error: redactSecrets(message), httpStatus: 0 };
  }

  let body: {
    data?: { user?: Record<string, unknown> };
    error?: DisplayError;
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, error: `user_info_http_${res.status}`, httpStatus: res.status };
  }

  if (!res.ok || (body.error?.code && body.error.code !== "ok")) {
    return mapDisplayError(res.status, body.error);
  }

  const rawUser = body.data?.user;
  if (!rawUser || typeof rawUser !== "object") {
    return { ok: false, error: "invalid_user_info_response", httpStatus: res.status };
  }

  return { ok: true, user: mapTikTokUserProfile(rawUser), raw: rawUser };
}

export type TikTokVideo = {
  id?: string;
  title?: string;
  video_description?: string;
  duration?: number;
  cover_image_url?: string;
  share_url?: string;
  embed_link?: string;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  view_count?: number;
  create_time?: number;
};

export function mapTikTokVideo(raw: Record<string, unknown> | null | undefined): TikTokVideo {
  if (!raw || typeof raw !== "object") return {};
  return {
    id: asOptionalString(raw.id),
    title: asOptionalString(raw.title),
    video_description: asOptionalString(raw.video_description),
    duration: asOptionalNumber(raw.duration),
    cover_image_url: asOptionalString(raw.cover_image_url),
    share_url: asOptionalString(raw.share_url),
    embed_link: asOptionalString(raw.embed_link),
    like_count: asOptionalNumber(raw.like_count),
    comment_count: asOptionalNumber(raw.comment_count),
    share_count: asOptionalNumber(raw.share_count),
    view_count: asOptionalNumber(raw.view_count),
    create_time: asOptionalNumber(raw.create_time),
  };
}

export type TikTokVideoPage = {
  videos: TikTokVideo[];
  cursor: number | null;
  hasMore: boolean;
};

/**
 * Official POST /v2/video/list/?fields=...
 * Body: { max_count, cursor? }. max_count capped at 20.
 */
export async function fetchTikTokVideoListPage(
  accessToken: string,
  opts?: {
    cursor?: number | null;
    maxCount?: number;
    fields?: readonly string[];
  }
): Promise<{ ok: true; page: TikTokVideoPage } | TikTokApiError> {
  const token = (accessToken || "").trim();
  if (!token) return { ok: false, error: "missing_access_token", httpStatus: 400 };

  const maxCount = Math.min(
    VIDEO_MAX_COUNT,
    Math.max(1, Math.floor(opts?.maxCount ?? VIDEO_MAX_COUNT))
  );
  const fields = (opts?.fields ?? TIKTOK_VIDEO_LIST_FIELDS).join(",");
  const url = new URL(`${TIKTOK_API_BASE}${TIKTOK_VIDEO_LIST_PATH}`);
  url.searchParams.set("fields", fields);

  const body: { max_count: number; cursor?: number } = { max_count: maxCount };
  if (opts?.cursor != null && Number.isFinite(opts.cursor)) {
    body.cursor = opts.cursor;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "video_list_failed";
    return { ok: false, error: redactSecrets(message), httpStatus: 0 };
  }

  let payload: {
    data?: {
      videos?: Array<Record<string, unknown>>;
      cursor?: number;
      has_more?: boolean;
    };
    error?: DisplayError;
  } = {};
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: `video_list_http_${res.status}`, httpStatus: res.status };
  }

  if (!res.ok || (payload.error?.code && payload.error.code !== "ok")) {
    return mapDisplayError(res.status, payload.error);
  }

  const rows = Array.isArray(payload.data?.videos) ? payload.data!.videos! : [];
  const videos = rows.map((r) => mapTikTokVideo(r)).filter((v) => !!v.id);
  const cursor =
    typeof payload.data?.cursor === "number" && Number.isFinite(payload.data.cursor)
      ? payload.data.cursor
      : null;
  const hasMore = payload.data?.has_more === true;

  return { ok: true, page: { videos, cursor, hasMore } };
}

/**
 * Paginate video.list safely (max pages / max_count caps).
 * Stops on API error and returns partial results with the error attached.
 */
export async function listTikTokVideos(
  accessToken: string,
  opts?: { maxPages?: number; maxCount?: number; fields?: readonly string[] }
): Promise<
  | { ok: true; videos: TikTokVideo[]; pages: number }
  | { ok: false; videos: TikTokVideo[]; pages: number; error: TikTokApiError }
> {
  const maxPages = Math.min(VIDEO_MAX_PAGES, Math.max(1, opts?.maxPages ?? VIDEO_MAX_PAGES));
  const all: TikTokVideo[] = [];
  let cursor: number | null | undefined = undefined;
  let pages = 0;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchTikTokVideoListPage(accessToken, {
      cursor: cursor ?? null,
      maxCount: opts?.maxCount,
      fields: opts?.fields,
    });
    pages += 1;
    if (!result.ok) {
      return { ok: false, videos: all, pages, error: result };
    }
    all.push(...result.page.videos);
    if (!result.page.hasMore) {
      return { ok: true, videos: all, pages };
    }
    if (result.page.cursor == null) {
      return { ok: true, videos: all, pages };
    }
    // Guard against stuck pagination.
    if (cursor != null && result.page.cursor === cursor) {
      return { ok: true, videos: all, pages };
    }
    cursor = result.page.cursor;
  }

  return { ok: true, videos: all, pages };
}

/**
 * Admin spike: user info + first video page. No demographics (scopes do not provide them).
 * Never returns tokens.
 */
export type TikTokSpikeReport = {
  apiBase: string;
  scopesRequested: string;
  profile: { ok: boolean; error?: string; user?: TikTokUserProfile };
  videos: {
    ok: boolean;
    error?: string;
    count: number;
    hasMore?: boolean;
    sample: TikTokVideo[];
    missingScope?: boolean;
    permissionDenied?: boolean;
  };
  /** Explicitly false — Display API scopes used here do not include audience analytics. */
  demographicsSupported: false;
  scopesGranted?: string;
};

export async function runTikTokSpike(
  accessToken: string,
  opts?: { scopesGranted?: string }
): Promise<TikTokSpikeReport> {
  const report: TikTokSpikeReport = {
    apiBase: TIKTOK_API_BASE,
    scopesRequested: tiktokScopes(),
    scopesGranted: opts?.scopesGranted,
    profile: { ok: false },
    videos: { ok: false, count: 0, sample: [] },
    demographicsSupported: false,
  };

  const profile = await fetchTikTokUserInfo(accessToken);
  if (profile.ok) {
    report.profile = { ok: true, user: profile.user };
  } else {
    const cls = classifyTikTokScopeError(profile.errorCode, profile.error);
    report.profile = {
      ok: false,
      error: profile.errorCode ? `${profile.errorCode}: ${profile.error}` : profile.error,
    };
    if (cls.missingScope) {
      report.profile.error = `missing_scope: ${report.profile.error}`;
    }
  }

  const page = await fetchTikTokVideoListPage(accessToken, { maxCount: 10 });
  if (page.ok) {
    report.videos = {
      ok: true,
      count: page.page.videos.length,
      hasMore: page.page.hasMore,
      sample: page.page.videos.slice(0, 5),
    };
  } else {
    const cls = classifyTikTokScopeError(page.errorCode, page.error);
    report.videos = {
      ok: false,
      error: page.errorCode ? `${page.errorCode}: ${page.error}` : page.error,
      count: 0,
      sample: [],
      missingScope: cls.missingScope,
      permissionDenied: cls.permissionDenied,
    };
  }

  return report;
}

/** Redact secrets from any accidental log string. */
export function redactSecrets(text: string): string {
  return text
    .replace(/access_token=[^&\s"']+/gi, "access_token=REDACTED")
    .replace(/refresh_token=[^&\s"']+/gi, "refresh_token=REDACTED")
    .replace(/client_secret=[^&\s"']+/gi, "client_secret=REDACTED")
    .replace(/client_key=[^&\s"']+/gi, "client_key=REDACTED")
    .replace(/\bcode=[^&\s"']+/gi, "code=REDACTED")
    .replace(/\bact\.[A-Za-z0-9._-]+/g, "act.REDACTED")
    .replace(/\brft\.[A-Za-z0-9._-]+/g, "rft.REDACTED");
}

/** True when access token should be refreshed (missing expiry → refresh). Default skew 5 minutes. */
export function accessTokenNeedsRefresh(
  expiresAtIso: string | null | undefined,
  nowMs = Date.now(),
  skewSec = 300
): boolean {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (!Number.isFinite(t)) return true;
  return t <= nowMs + skewSec * 1000;
}

/** Postgres undefined_table / undefined_column (Phase 2 migration not applied). */
export function isMissingSchemaError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = (err.code || "").trim();
  if (code === "42P01" || code === "42703") return true;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("platform_user_id") ||
    msg.includes("encrypted_refresh_token") ||
    msg.includes("refresh_token_expires_at") ||
    msg.includes("granted_scopes") ||
    msg.includes("tiktok_oauth_used_nonces") ||
    (msg.includes("social_connections") && msg.includes("check"))
  );
}

export function schemaMissingResponseBody(context: string) {
  return {
    ok: false,
    error: "schema_not_ready",
    reason: "tiktok_phase2_migration_required",
    context,
  };
}

/** Client-safe spike summary — never includes tokens. */
export function sanitizeTikTokSpikeReport(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TikTokSpikeReport> & {
    scopesGranted?: string;
    profile?: {
      ok?: boolean;
      error?: string;
      user?: TikTokUserProfile;
    };
    videos?: {
      ok?: boolean;
      error?: string;
      count?: number;
      hasMore?: boolean;
      sample?: TikTokVideo[];
      missingScope?: boolean;
    };
  };
  const user = r.profile?.user;
  return {
    apiBase: r.apiBase || TIKTOK_API_BASE,
    scopesRequested: r.scopesRequested || null,
    scopesGranted: r.scopesGranted || null,
    demographicsSupported: false as const,
    profile: r.profile
      ? {
          ok: !!r.profile.ok,
          error: r.profile.error || null,
          openId: user?.open_id ?? null,
          unionId: user?.union_id ?? null,
          username: user?.username ?? null,
          displayName: user?.display_name ?? null,
          avatarUrl: user?.avatar_url ?? null,
          profileDeepLink: user?.profile_deep_link ?? null,
          bioDescription: user?.bio_description ?? null,
          isVerified: user?.is_verified ?? null,
          followerCount: user?.follower_count ?? null,
          followingCount: user?.following_count ?? null,
          likesCount: user?.likes_count ?? null,
          videoCount: user?.video_count ?? null,
        }
      : null,
    videos: r.videos
      ? {
          ok: !!r.videos.ok,
          error: r.videos.error || null,
          count: r.videos.count ?? 0,
          hasMore: r.videos.hasMore ?? null,
          missingScope: !!r.videos.missingScope,
          sample: Array.isArray(r.videos.sample)
            ? r.videos.sample.map((v) => ({
                id: v.id ?? null,
                title: v.title ?? null,
                shareUrl: v.share_url ?? null,
                embedLink: v.embed_link ?? null,
                coverImageUrl: v.cover_image_url ?? null,
                viewCount: v.view_count ?? null,
                likeCount: v.like_count ?? null,
                commentCount: v.comment_count ?? null,
                shareCount: v.share_count ?? null,
                duration: v.duration ?? null,
                createTime: v.create_time ?? null,
              }))
            : [],
        }
      : null,
  };
}

export function classifyTikTokScopeError(errorCode?: string, errorMessage?: string): {
  missingScope: boolean;
  permissionDenied: boolean;
} {
  const blob = `${errorCode || ""} ${errorMessage || ""}`.toLowerCase();
  const missingScope =
    blob.includes("scope_not_authorized") ||
    blob.includes("scope_not_granted") ||
    blob.includes("insufficient_scope");
  const permissionDenied =
    missingScope ||
    blob.includes("permission") ||
    blob.includes("not authorized") ||
    blob.includes("forbidden");
  return { missingScope, permissionDenied };
}

/** Build expiry ISO timestamps from TikTok token lifetimes (seconds). */
export function tokenExpiryIsoFromSeconds(expiresIn: number, nowMs = Date.now()): string {
  return new Date(nowMs + expiresIn * 1000).toISOString();
}

/** Parse TikTok `scope` response (comma-separated) into a stable string[]. */
export function parseGrantedScopes(scope: string | null | undefined): string[] {
  if (!scope || typeof scope !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of scope.split(/[,\s]+/)) {
    const s = part.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Prefer newly returned scopes from TikTok; if the refresh/token response omits them,
 * keep the previously stored list (never erase known scopes with empty data).
 */
export function mergeGrantedScopes(
  previous: string[] | null | undefined,
  incomingScope: string | null | undefined
): string[] | null {
  const incoming = parseGrantedScopes(incomingScope);
  if (incoming.length > 0) return incoming;
  if (Array.isArray(previous) && previous.length > 0) {
    return previous.filter((s) => typeof s === "string" && s.trim().length > 0);
  }
  return null;
}

export function formatGrantedScopes(scopes: string[] | null | undefined): string | null {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;
  return scopes.join(",");
}

/**
 * Validates token payload is complete enough to overwrite a stored connection.
 * Incomplete tokens must never replace a valid row.
 */
export function isCompleteTikTokTokenSet(token: {
  openId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
}): boolean {
  return !!(
    token.openId &&
    token.accessToken &&
    token.refreshToken &&
    typeof token.expiresIn === "number" &&
    token.expiresIn > 0 &&
    typeof token.refreshExpiresIn === "number" &&
    token.refreshExpiresIn > 0
  );
}
