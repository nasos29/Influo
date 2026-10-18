export type ApplicantProfile = {
  display_name: string;
  avatar_url: string | null;
  profile_slug: string | null;
  category: string | null;
  accounts: unknown;
  engagement_rate: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function accountsValue(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return value ?? null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

/** Prefer a direct influencers row, and unwrap a PostgREST embed that came back as an array. */
export function mergeApplicantProfile(embedded: unknown, direct: unknown): ApplicantProfile | null {
  const fromEmbed = asRecord(embedded);
  const fromDirect = asRecord(direct);
  if (!fromEmbed && !fromDirect) return null;
  const row = { ...(fromEmbed || {}), ...(fromDirect || {}) };
  const accounts = fromDirect && "accounts" in fromDirect ? fromDirect.accounts : row.accounts;
  return {
    display_name: typeof row.display_name === "string" ? row.display_name : "",
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    profile_slug: typeof row.profile_slug === "string" ? row.profile_slug : null,
    category: typeof row.category === "string" ? row.category : null,
    accounts: accountsValue(accounts),
    engagement_rate: row.engagement_rate ?? null,
  };
}
