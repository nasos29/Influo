/**
 * One avatar/logo lookup per contact_email per browser session.
 */

type CachePayload = { url: string | null; name?: string | null };

const PREFIX = "influo:avatar:";

function key(kind: "influencer" | "brand", email: string): string {
  return `${PREFIX}${kind}:${email.toLowerCase().trim()}`;
}

export function readSessionAvatar(
  kind: "influencer" | "brand",
  email: string
): CachePayload | null {
  if (typeof sessionStorage === "undefined") return null;
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  try {
    const raw = sessionStorage.getItem(key(kind, normalized));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      url: typeof parsed.url === "string" || parsed.url === null ? parsed.url : null,
      name: typeof parsed.name === "string" || parsed.name == null ? parsed.name : null,
    };
  } catch {
    return null;
  }
}

export function writeSessionAvatar(
  kind: "influencer" | "brand",
  email: string,
  payload: CachePayload
): void {
  if (typeof sessionStorage === "undefined") return;
  const normalized = email.toLowerCase().trim();
  if (!normalized) return;
  try {
    sessionStorage.setItem(key(kind, normalized), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}
