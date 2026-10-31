/** Decorative faces for invite popups. Eight URLs, nothing else. */

/** Do not send the brand session. The list is public and must ignore RLS. */
export const GATE_AVATAR_FETCH: RequestInit = {
  credentials: "omit",
  cache: "force-cache",
};

const PLACEHOLDER = /placeholder|default-avatar|no-photo|ui-avatars\.com\/api/i;

export function pickGateAvatarUrls(rows: Array<{ avatar_url?: unknown }>, limit = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const url = typeof row.avatar_url === "string" ? row.avatar_url.trim() : "";
    if (!url || !/^https?:\/\//i.test(url) || PLACEHOLDER.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

export function showCampaignInviteButton(input: {
  sessionChecked: boolean;
  hasSession: boolean;
  isBrand: boolean;
  isAdmin: boolean;
}): boolean {
  if (!input.sessionChecked) return false;
  if (!input.hasSession) return true;
  return input.isBrand || input.isAdmin;
}

/** What the invite button opens. Logged-in creators never reach this. */
export function inviteOpenResult(input: {
  isBrand: boolean;
  hasBrandId: boolean;
  isAdmin: boolean;
}): "campaigns" | "login" | "admin-notice" {
  if (input.isBrand && input.hasBrandId) return "campaigns";
  if (input.isAdmin) return "admin-notice";
  return "login";
}
