/**
 * Admin broadcast of web push to influencer subscriptions keyed by email.
 * No schema changes: matches push_subscriptions.user_identifier case-insensitively.
 */

/** Creator dashboard tab that opens profile editing (`DashboardContent`). */
export const CREATOR_PROFILE_EDIT_PATH = "/dashboard?tab=profile";

export const MAX_INFLUENCER_PUSH_EMAILS = 50;

export type InfluencerPushBroadcastInput = {
  emails?: unknown;
  title?: unknown;
  body?: unknown;
  url?: unknown;
};

export type ParsedInfluencerPushBroadcast =
  | { ok: true; emails: string[]; title: string; body: string; url: string }
  | { ok: false; status: 400; error: string };

export type InfluencerPushSubscriptionRow = {
  user_type?: string | null;
  user_identifier?: string | null;
};

/**
 * Normalize `{ emails, title, body, url }`.
 * At most 50 emails per call (raw array length). Blank emails are dropped.
 * Missing or blank `url` becomes the creator profile editor.
 */
export function parseInfluencerPushBroadcast(input: unknown): ParsedInfluencerPushBroadcast {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, error: "Invalid body" };
  }
  const body = input as InfluencerPushBroadcastInput;
  if (!Array.isArray(body.emails)) {
    return { ok: false, status: 400, error: "emails must be an array" };
  }
  if (body.emails.length > MAX_INFLUENCER_PUSH_EMAILS) {
    return {
      ok: false,
      status: 400,
      error: `At most ${MAX_INFLUENCER_PUSH_EMAILS} emails per call`,
    };
  }

  const emails: string[] = [];
  const seen = new Set<string>();
  for (const item of body.emails) {
    if (typeof item !== "string") {
      return { ok: false, status: 400, error: "emails must be strings" };
    }
    const email = item.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  if (!emails.length) {
    return { ok: false, status: 400, error: "emails required" };
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return { ok: false, status: 400, error: "title is required" };
  }
  if (typeof body.body !== "string" || !body.body.trim()) {
    return { ok: false, status: 400, error: "body is required" };
  }

  let url = CREATOR_PROFILE_EDIT_PATH;
  if (body.url != null && body.url !== "") {
    if (typeof body.url !== "string") {
      return { ok: false, status: 400, error: "url must be a string" };
    }
    const trimmed = body.url.trim();
    if (trimmed) url = trimmed;
  }

  return {
    ok: true,
    emails,
    title: body.title.trim(),
    body: body.body.trim(),
    url,
  };
}

/**
 * Escape a value for a PostgREST `.or()` ilike clause.
 * `_` is left as-is (SQL ILIKE wildcard). Callers must exact-match in JS
 * so a `_` in an email cannot notify a different address.
 */
export function escapeInfluencerEmailIlike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/\*/g, "\\*")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** `user_identifier.ilike.a@b.com,user_identifier.ilike.c@d.com` */
export function influencerSubscriptionOrFilter(emails: readonly string[]): string {
  return emails
    .map((email) => `user_identifier.ilike.${escapeInfluencerEmailIlike(email)}`)
    .join(",");
}

/** Keep influencer rows whose identifier is exactly one of `emails` (case-insensitive). */
export function filterInfluencerEmailSubscriptions<T extends InfluencerPushSubscriptionRow>(
  rows: readonly T[],
  emails: readonly string[]
): T[] {
  const wanted = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  return rows.filter((row) => {
    if (row.user_type != null && row.user_type !== "influencer") return false;
    const id = String(row.user_identifier || "").trim().toLowerCase();
    return id !== "" && wanted.has(id);
  });
}

export function countMatchedPushUsers(rows: readonly InfluencerPushSubscriptionRow[]): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row.user_identifier || "").trim().toLowerCase();
    if (id) seen.add(id);
  }
  return seen.size;
}
