/**
 * Minimal Zoho Campaigns API v1.1 client (EU data center by default).
 * Form-urlencoded POSTs; Authorization: Zoho-oauthtoken <access_token>.
 */

import {
  getZohoCampaignsEnv,
  type ZohoCampaignsEnv,
} from "@/lib/zohoCampaignsConfig";

type TokenCache = { accessToken: string; expiresAtMs: number };
let tokenCache: TokenCache | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

export function zohoResponseOk(payload: unknown): boolean {
  const root = asRecord(payload);
  const nested = asRecord(root.response);
  const code = pickString(root.code, nested.code, root.status, nested.status);
  const status = pickString(root.status, nested.status).toLowerCase();
  if (status === "success" || status === "ok") return true;
  if (code === "0" || code === "200" || code === "201") return true;
  const message = pickString(root.message, nested.message).toLowerCase();
  // Zoho sometimes returns success text with code 0 nested differently
  if (message.includes("success") || message.includes("successfully")) return true;
  return false;
}

export function extractZohoCampaignKey(payload: unknown): string {
  const root = asRecord(payload);
  const nested = asRecord(root.response);
  return pickString(
    root.campaignKey,
    root.campaignkey,
    nested.campaignKey,
    nested.campaignkey
  );
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text, httpStatus: res.status };
  }
}

export async function refreshZohoAccessToken(
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: env.refreshToken,
  });

  const res = await fetch(`${env.accountsBase}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = asRecord(await readJsonSafe(res));
  const accessToken = pickString(json.access_token);
  if (!res.ok || !accessToken) {
    const err = pickString(json.error, json.error_description, json.message) || `HTTP ${res.status}`;
    throw new Error(`Zoho OAuth refresh failed: ${err}`);
  }
  const expiresIn = Number(json.expires_in) || 3600;
  tokenCache = {
    accessToken,
    expiresAtMs: now + expiresIn * 1000,
  };
  return accessToken;
}

/** Test helper — clear cached token between cases. */
export function clearZohoAccessTokenCache(): void {
  tokenCache = null;
}

export async function zohoFormPost(
  path: string,
  params: Record<string, string>,
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<unknown> {
  const accessToken = await refreshZohoAccessToken(env);
  const qs = new URLSearchParams({ resfmt: "JSON", ...params });
  const url = `${env.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: qs,
  });
  const payload = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(`Zoho API HTTP ${res.status} on ${path}`);
  }
  return payload;
}

export async function zohoFormGet(
  path: string,
  params: Record<string, string>,
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<unknown> {
  const accessToken = await refreshZohoAccessToken(env);
  const qs = new URLSearchParams({ resfmt: "JSON", ...params });
  const url = `${env.apiBase}${path.startsWith("/") ? path : `/${path}`}?${qs.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });
  const payload = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(`Zoho API HTTP ${res.status} on ${path}`);
  }
  return payload;
}

export async function zohoListSubscribe(
  listKey: string,
  email: string,
  extra?: { firstName?: string; source?: string },
  env?: ZohoCampaignsEnv
): Promise<unknown> {
  const contactinfo = JSON.stringify({
    "Contact Email": email.trim().toLowerCase(),
    ...(extra?.firstName ? { "First Name": extra.firstName } : {}),
  });
  const params: Record<string, string> = {
    listkey: listKey,
    contactinfo,
  };
  if (extra?.source) params.source = extra.source;
  return zohoFormPost("/json/listsubscribe", params, env);
}

export async function zohoListUnsubscribe(
  listKey: string,
  email: string,
  env?: ZohoCampaignsEnv
): Promise<unknown> {
  const contactinfo = JSON.stringify({
    "Contact Email": email.trim().toLowerCase(),
  });
  return zohoFormPost("/json/listunsubscribe", paramsWith(listKey, contactinfo), env);
}

function paramsWith(listKey: string, contactinfo: string): Record<string, string> {
  return { listkey: listKey, contactinfo };
}

export async function zohoCreateCampaign(
  opts: {
    name: string;
    subject: string;
    listKey: string;
    contentUrl: string;
    fromEmail?: string;
    fromName?: string;
    topicId?: string;
  },
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<{ campaignKey: string; raw: unknown }> {
  const list_details = JSON.stringify({ [opts.listKey]: [] });
  const params: Record<string, string> = {
    campaignname: opts.name.slice(0, 180),
    subject: opts.subject.slice(0, 180),
    from_email: opts.fromEmail || env.fromEmail,
    from_name: opts.fromName || env.fromName,
    list_details,
    content_url: opts.contentUrl,
  };
  const topicId = opts.topicId || env.topicId;
  if (topicId) params.topicId = topicId;

  const raw = await zohoFormPost("/createCampaign", params, env);
  const campaignKey = extractZohoCampaignKey(raw);
  if (!campaignKey) {
    throw new Error(`Zoho createCampaign missing campaignKey: ${JSON.stringify(raw).slice(0, 400)}`);
  }
  return { campaignKey, raw };
}

export async function zohoSendCampaign(
  campaignKey: string,
  env?: ZohoCampaignsEnv
): Promise<unknown> {
  return zohoFormPost("/sendcampaign", { campaignkey: campaignKey }, env);
}

/** Collect emails from getlistcontacts-style payloads (active or unsub). */
export function extractEmailsFromZohoListContacts(payload: unknown): string[] {
  const root = asRecord(payload);
  const nested = asRecord(root.response);
  const list =
    (Array.isArray(root.list_of_details) && root.list_of_details) ||
    (Array.isArray(nested.list_of_details) && nested.list_of_details) ||
    (Array.isArray(root.contacts) && root.contacts) ||
    (Array.isArray(nested.contacts) && nested.contacts) ||
    [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    const rec = asRecord(row);
    const email = pickString(
      rec.contact_email,
      rec.Contact_Email,
      rec["Contact Email"],
      rec.email,
      rec.Email
    )
      .trim()
      .toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Page through list contacts for a status (e.g. "unsub", "active").
 * Zoho status labels vary by account; callers should tolerate empty pages.
 */
export async function zohoFetchListEmailsByStatus(
  listKey: string,
  status: string,
  opts?: { pageSize?: number; maxPages?: number },
  env?: ZohoCampaignsEnv
): Promise<string[]> {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 100, 1), 200);
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 30, 1), 100);
  const all: string[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page += 1) {
    const fromindex = String(page * pageSize + 1);
    const payload = await zohoFormGet(
      "/getlistcontacts",
      {
        listkey: listKey,
        status,
        sort: "asc",
        fromindex,
        range: String(pageSize),
      },
      env
    );
    const emails = extractEmailsFromZohoListContacts(payload);
    if (emails.length === 0) break;
    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      all.push(email);
    }
    if (emails.length < pageSize) break;
  }

  return all;
}
