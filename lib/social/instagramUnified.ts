/**
 * Instagram API with Unified Login (Facebook Login for Business + config_id).
 * Tokens and app secret stay server-side only. Host: graph.facebook.com.
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

export function metaAppId(): string {
  return process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID || "1085701814491082";
}

export function metaAppSecret(): string {
  const s = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || "";
  if (!s) throw new Error("META_APP_SECRET is not configured");
  return s;
}

export function metaIgConfigId(): string {
  return process.env.META_IG_CONFIG_ID || "1647951953401160";
}

export function metaIgRedirectUri(): string {
  return (
    process.env.META_IG_REDIRECT_URI ||
    "https://www.influo.gr/api/social/instagram/callback"
  );
}

export function graphBase(): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}`;
}

/** Facebook Login for Business authorize URL — permissions come from config_id. */
export function buildUnifiedAuthorizeUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", metaIgRedirectUri());
  url.searchParams.set("config_id", metaIgConfigId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export type TokenExchangeResult = {
  accessToken: string;
  expiresIn: number | null;
  tokenType: string | null;
};

export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const url = new URL(`${graphBase()}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("redirect_uri", metaIgRedirectUri());
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(20_000) });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: { message?: string; type?: string; code?: number };
  };
  if (!res.ok || body.error || !body.access_token) {
    const msg = body.error?.message || `token exchange HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : null,
    tokenType: body.token_type || null,
  };
}

async function graphGet<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code?: number }> {
  const url = new URL(`${graphBase()}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || body.error) {
    return {
      ok: false,
      status: res.status,
      error: body.error?.message || `HTTP ${res.status}`,
      code: body.error?.code,
    };
  }
  return { ok: true, data: body };
}

export type AssignedIgAccount = { id: string; username?: string };

export async function listAssignedInstagramAccounts(
  accessToken: string
): Promise<{ ok: true; accounts: AssignedIgAccount[] } | { ok: false; error: string }> {
  const accounts: AssignedIgAccount[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = { fields: "id,username", limit: "50" };
    if (after) params.after = after;
    const result = await graphGet<{
      data?: Array<{ id?: string | number; username?: string }>;
      paging?: { cursors?: { after?: string } };
    }>("me/assigned_instagram_accounts", accessToken, params);
    if (!result.ok) return { ok: false, error: result.error };
    const rows = Array.isArray(result.data.data) ? result.data.data : [];
    for (const row of rows) {
      if (row.id == null) continue;
      accounts.push({ id: String(row.id), username: row.username });
    }
    const next = result.data.paging?.cursors?.after;
    if (!rows.length || !next || next === after) break;
    after = next;
  }
  return { ok: true, accounts };
}

export async function fetchIgProfile(
  igUserId: string,
  accessToken: string
): Promise<{ ok: true; profile: Record<string, unknown> } | { ok: false; error: string }> {
  const result = await graphGet<Record<string, unknown>>(igUserId, accessToken, {
    fields: "id,username,name,profile_picture_url,followers_count,media_count,biography",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, profile: result.data };
}

export async function fetchClientBusinessId(
  accessToken: string
): Promise<{ ok: true; clientBusinessId: string | null } | { ok: false; error: string }> {
  const result = await graphGet<{ client_business_id?: string }>("me", accessToken, {
    fields: "client_business_id",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, clientBusinessId: result.data.client_business_id ?? null };
}

/** Safe spike probes — never returns the access token. */
export type DayInsightsGroupKind = "reach_time_series" | "engagement_totals";

export type DayInsightsGroupResult = {
  kind: DayInsightsGroupKind;
  metrics: string;
  period: "day";
  /** Omitted for reach so Meta returns the default daily time series. */
  metricType: "total_value" | null;
  /** How consumers must interpret `data` — never treat totals as daily series. */
  representation: "time_series" | "total_value";
  ok: boolean;
  error?: string;
  data?: unknown;
};

export type DayInsightsStatus = "complete" | "partial" | "failed";

/**
 * Day insights aggregate.
 * `ok` is true only for complete success (all required groups ok) — backward-compatible
 * with status consumers that treat ok as full success.
 */
export type InsightsDayReport = {
  ok: boolean;
  status: DayInsightsStatus;
  error?: string;
  metricTried?: string;
  data?: unknown;
  groups: DayInsightsGroupResult[];
};

export type InsightsSpikeReport = {
  graphVersion: string;
  profile: { ok: boolean; error?: string; data?: Record<string, unknown> };
  insightsDay: InsightsDayReport;
  demographics: Array<{ ok: boolean; breakdown: string; error?: string; data?: unknown }>;
};

/** Required v21 day insight groups. `profile_views` is intentionally excluded (deprecated). */
export function buildDayInsightsRequestSpecs(): Array<{
  kind: DayInsightsGroupKind;
  metrics: string;
  period: "day";
  metricType: "total_value" | null;
  representation: "time_series" | "total_value";
  params: Record<string, string>;
}> {
  return [
    {
      kind: "reach_time_series",
      metrics: "reach",
      period: "day",
      metricType: null,
      representation: "time_series",
      params: { metric: "reach", period: "day" },
    },
    {
      kind: "engagement_totals",
      metrics: "views,accounts_engaged",
      period: "day",
      metricType: "total_value",
      representation: "total_value",
      params: {
        metric: "views,accounts_engaged",
        period: "day",
        metric_type: "total_value",
      },
    },
  ];
}

/** Unchanged demographics query params (working production path). */
export function buildDemographicsInsightsParams(breakdown: string): Record<string, string> {
  return {
    metric: "follower_demographics",
    period: "lifetime",
    metric_type: "total_value",
    timeframe: "last_90_days",
    breakdown,
  };
}

export function aggregateDayInsightsGroups(groups: DayInsightsGroupResult[]): InsightsDayReport {
  const required = groups.filter(
    (g) => g.kind === "reach_time_series" || g.kind === "engagement_totals"
  );
  const okCount = required.filter((g) => g.ok).length;
  const status: DayInsightsStatus =
    okCount === required.length && required.length > 0
      ? "complete"
      : okCount > 0
        ? "partial"
        : "failed";

  const metricTried = required.map((g) => g.metrics).join(" | ");
  const errors = required.filter((g) => !g.ok && g.error).map((g) => `${g.kind}: ${g.error}`);

  const data: Record<string, unknown> = {};
  for (const g of required) {
    if (!g.ok || g.data == null) continue;
    if (g.kind === "reach_time_series") {
      data.reach = { representation: "time_series", values: g.data };
    } else if (g.kind === "engagement_totals") {
      data.totals = { representation: "total_value", values: g.data };
    }
  }

  return {
    ok: status === "complete",
    status,
    metricTried,
    error: errors.length ? errors.join("; ") : undefined,
    data: Object.keys(data).length ? data : undefined,
    groups,
  };
}

export async function runInsightsSpike(
  igUserId: string,
  accessToken: string
): Promise<InsightsSpikeReport> {
  const report: InsightsSpikeReport = {
    graphVersion: META_GRAPH_VERSION,
    profile: { ok: false },
    insightsDay: { ok: false, status: "failed", groups: [] },
    demographics: [],
  };

  const profile = await fetchIgProfile(igUserId, accessToken);
  if (profile.ok) {
    report.profile = { ok: true, data: profile.profile };
  } else {
    report.profile = { ok: false, error: profile.error };
  }

  // Split v21-compatible day requests: reach time-series vs engagement totals.
  const dayGroups: DayInsightsGroupResult[] = [];
  for (const spec of buildDayInsightsRequestSpecs()) {
    const result = await graphGet<{ data?: unknown }>(
      `${igUserId}/insights`,
      accessToken,
      spec.params
    );
    const group: DayInsightsGroupResult = {
      kind: spec.kind,
      metrics: spec.metrics,
      period: spec.period,
      metricType: spec.metricType,
      representation: spec.representation,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      data: result.ok ? (result.data.data ?? result.data) : undefined,
    };
    dayGroups.push(group);
    console.info("[ig-oauth] day insights group", {
      igUserId,
      kind: group.kind,
      metrics: group.metrics,
      metricType: group.metricType,
      representation: group.representation,
      ok: group.ok,
      error: group.error ? redactSecrets(group.error) : undefined,
    });
  }
  report.insightsDay = aggregateDayInsightsGroups(dayGroups);
  console.info("[ig-oauth] day insights aggregate", {
    igUserId,
    status: report.insightsDay.status,
    ok: report.insightsDay.ok,
    metricTried: report.insightsDay.metricTried,
    error: report.insightsDay.error ? redactSecrets(report.insightsDay.error) : undefined,
  });

  for (const breakdown of ["age", "gender", "country", "city"]) {
    const demo = await graphGet<{ data?: unknown }>(
      `${igUserId}/insights`,
      accessToken,
      buildDemographicsInsightsParams(breakdown)
    );
    report.demographics.push(
      demo.ok
        ? { ok: true, breakdown, data: demo.data.data ?? demo.data }
        : { ok: false, breakdown, error: demo.error }
    );
  }

  return report;
}

/** Redact secrets from any accidental log string. */
export function redactSecrets(text: string): string {
  return text
    .replace(/access_token=[^&\s]+/gi, "access_token=REDACTED")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=REDACTED")
    .replace(/code=[^&\s]+/gi, "code=REDACTED");
}
