import { readFileSync, existsSync } from "node:fs";
import { athensYmdFromIso, addAthensYmdDays, buildStatsPeriodBounds, type PeriodKpi } from "@/lib/adminPlatformStats";
import { buildServiceAccountJwt } from "@/lib/ga4Jwt";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CACHE_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_SEC = 120;

export type Ga4TrafficResponse = {
  configured: boolean;
  error?: string;
  users?: PeriodKpi;
  sessions?: PeriodKpi;
  newUsers?: PeriodKpi;
  signUp?: PeriodKpi;
  topChannels?: { channel: string; sessions: number }[];
  topLandingPages?: { path: string; sessions: number }[];
};

type ServiceAccountKey = { client_email?: string; private_key?: string };

type TokenCache = { accessToken: string; expiresAtSec: number };
type PayloadCache = { payload: Ga4TrafficResponse; fetchedAt: number };

let tokenCache: TokenCache | null = null;
let payloadCache: PayloadCache | null = null;

function readServiceAccount(): { client_email: string; private_key: string } | null {
  const keyPath = process.env.GA4_SA_KEY_FILE?.trim();
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  if (!keyPath || !propertyId) return null;
  try {
    if (!existsSync(keyPath)) return null;
    const raw = readFileSync(keyPath, "utf8");
    const json = JSON.parse(raw) as ServiceAccountKey;
    const client_email = json.client_email?.trim();
    const private_key = json.private_key?.trim();
    if (!client_email || !private_key) return null;
    return { client_email, private_key };
  } catch {
    return null;
  }
}

function propertyId(): string | null {
  const id = process.env.GA4_PROPERTY_ID?.trim();
  return id || null;
}

async function fetchAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAtSec - TOKEN_REFRESH_BUFFER_SEC > now) {
    return tokenCache.accessToken;
  }
  const assertion = buildServiceAccountJwt(clientEmail, privateKey, now);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !json.access_token) return null;
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
    tokenCache = { accessToken: json.access_token, expiresAtSec: now + expiresIn };
    return json.access_token;
  } catch {
    return null;
  }
}

type DateRangeSpec = { name: string; startDate: string; endDate: string };

type RunReportResponse = {
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
  metadata?: {
    currencyCode?: string;
  };
  propertyQuota?: unknown;
};

function parseMetricInt(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

async function runReport(
  accessToken: string,
  propId: string,
  body: Record<string, unknown>
): Promise<RunReportResponse | null> {
  try {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as RunReportResponse;
  } catch {
    return null;
  }
}

function periodBoundsToYmd(): {
  today: DateRangeSpec;
  d7: DateRangeSpec;
  prev7: DateRangeSpec;
  d30: DateRangeSpec;
  prev30: DateRangeSpec;
} {
  const bounds = buildStatsPeriodBounds();
  const todayYmd = bounds.todayYmd;
  const d7StartYmd = athensYmdFromIso(bounds.d7Start) ?? addAthensYmdDays(todayYmd, -7);
  const d30StartYmd = athensYmdFromIso(bounds.d30Start) ?? addAthensYmdDays(todayYmd, -30);
  const prev7StartYmd = athensYmdFromIso(bounds.prev7Start) ?? addAthensYmdDays(todayYmd, -14);
  const prev7EndYmd = addAthensYmdDays(d7StartYmd, -1);
  const prev30StartYmd = athensYmdFromIso(bounds.prev30Start) ?? addAthensYmdDays(todayYmd, -60);
  const prev30EndYmd = addAthensYmdDays(d30StartYmd, -1);

  const mk = (name: string, startDate: string, endDate: string): DateRangeSpec => ({ name, startDate, endDate });
  return {
    today: mk("today", todayYmd, todayYmd),
    d7: mk("d7", d7StartYmd, todayYmd),
    prev7: mk("prev7", prev7StartYmd, prev7EndYmd),
    d30: mk("d30", d30StartYmd, todayYmd),
    prev30: mk("prev30", prev30StartYmd, prev30EndYmd),
  };
}

function periodKpiFromRowValues(vals: { value?: string }[]): PeriodKpi {
  return {
    today: parseMetricInt(vals[0]?.value),
    d7: parseMetricInt(vals[1]?.value),
    prev7: parseMetricInt(vals[2]?.value),
    d30: parseMetricInt(vals[3]?.value),
    prev30: parseMetricInt(vals[4]?.value),
  };
}

function kpiFromMetricReports(
  reports: Record<string, RunReportResponse | null>
): { users: PeriodKpi; sessions: PeriodKpi; newUsers: PeriodKpi } | null {
  const ranges = periodBoundsToYmd();
  const rangeList = [ranges.today, ranges.d7, ranges.prev7, ranges.d30, ranges.prev30];

  const extract = (metricName: string): PeriodKpi | null => {
    const report = reports[metricName];
    if (!report?.rows?.[0]?.metricValues) return null;
    const vals = report.rows[0].metricValues;
    if (vals.length < rangeList.length) return null;
    return periodKpiFromRowValues(vals);
  };

  const users = extract("activeUsers");
  const sessions = extract("sessions");
  const newUsers = extract("newUsers");
  if (!users || !sessions || !newUsers) return null;
  return { users, sessions, newUsers };
}

async function fetchKpiMetrics(accessToken: string, propId: string): Promise<{
  users: PeriodKpi;
  sessions: PeriodKpi;
  newUsers: PeriodKpi;
} | null> {
  const ranges = periodBoundsToYmd();
  const dateRanges = [ranges.today, ranges.d7, ranges.prev7, ranges.d30, ranges.prev30].map((r) => ({
    startDate: r.startDate,
    endDate: r.endDate,
  }));

  const runForMetric = (name: string) =>
    runReport(accessToken, propId, {
      dateRanges,
      metrics: [{ name }],
    });

  const [activeUsers, sessions, newUsers] = await Promise.all([
    runForMetric("activeUsers"),
    runForMetric("sessions"),
    runForMetric("newUsers"),
  ]);

  return kpiFromMetricReports({ activeUsers, sessions, newUsers });
}

async function fetchSignUpKpi(accessToken: string, propId: string): Promise<PeriodKpi | null> {
  const ranges = periodBoundsToYmd();
  const dateRanges = [ranges.today, ranges.d7, ranges.prev7, ranges.d30, ranges.prev30].map((r) => ({
    startDate: r.startDate,
    endDate: r.endDate,
  }));
  const report = await runReport(accessToken, propId, {
    dateRanges,
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT", value: "sign_up" },
      },
    },
  });
  const vals = report?.rows?.[0]?.metricValues;
  if (!vals || vals.length < dateRanges.length) return null;
  return periodKpiFromRowValues(vals);
}

async function fetchTopChannels(
  accessToken: string,
  propId: string,
  startDate: string,
  endDate: string
): Promise<{ channel: string; sessions: number }[]> {
  const report = await runReport(accessToken, propId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  if (!report?.rows) return [];
  return report.rows.map((row) => ({
    channel: row.dimensionValues?.[0]?.value?.trim() || "(not set)",
    sessions: parseMetricInt(row.metricValues?.[0]?.value),
  }));
}

async function fetchTopLandingPages(
  accessToken: string,
  propId: string,
  startDate: string,
  endDate: string
): Promise<{ path: string; sessions: number }[]> {
  const report = await runReport(accessToken, propId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });
  if (!report?.rows) return [];
  return report.rows.map((row) => ({
    path: row.dimensionValues?.[0]?.value?.trim() || "/",
    sessions: parseMetricInt(row.metricValues?.[0]?.value),
  }));
}

async function fetchGa4TrafficUncached(): Promise<Ga4TrafficResponse> {
  const sa = readServiceAccount();
  const propId = propertyId();
  if (!sa || !propId) {
    return { configured: false };
  }

  const accessToken = await fetchAccessToken(sa.client_email, sa.private_key);
  if (!accessToken) {
    return { configured: false, error: "Could not obtain GA4 access token." };
  }

  const ranges = periodBoundsToYmd();

  const [kpi, signUp, topChannels, topLandingPages] = await Promise.all([
    fetchKpiMetrics(accessToken, propId),
    fetchSignUpKpi(accessToken, propId),
    fetchTopChannels(accessToken, propId, ranges.d30.startDate, ranges.d30.endDate),
    fetchTopLandingPages(accessToken, propId, ranges.d30.startDate, ranges.d30.endDate),
  ]);

  if (!kpi) {
    return { configured: false, error: "Could not load traffic from GA4." };
  }

  return {
    configured: true,
    users: kpi.users,
    sessions: kpi.sessions,
    newUsers: kpi.newUsers,
    signUp: signUp ?? undefined,
    topChannels,
    topLandingPages,
  };
}

/** Server-side GA4 traffic snapshot for admin (10-minute in-memory cache on success). */
export async function getGa4TrafficPayload(): Promise<Ga4TrafficResponse> {
  const now = Date.now();
  if (payloadCache && now - payloadCache.fetchedAt < CACHE_MS && payloadCache.payload.configured) {
    return payloadCache.payload;
  }
  const fresh = await fetchGa4TrafficUncached();
  if (fresh.configured) {
    payloadCache = { payload: fresh, fetchedAt: now };
  }
  return fresh;
}