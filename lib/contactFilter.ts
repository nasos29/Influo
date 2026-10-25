export type ContactInfoKind = "link" | "email" | "phone" | "messenger";

export const ALLOWED_WORK_LINK_HOSTS = [
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "fb.watch",
  "threads.net",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "twitch.tv",
  "pinterest.com",
  "snapchat.com",
] as const;

const MESSENGER_RE =
  /\b(whatsapp|viber|telegram|signal|skype|wa\.me|t\.me)\b/i;

const EMAIL_RE =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

/** Obfuscated: "name at gmail dot com" */
const EMAIL_OBFUSCATED_RE =
  /\b[a-z0-9._%+-]+\s+at\s+[a-z0-9.-]+\s+dot\s+[a-z]{2,}\b/i;

const URL_PROTOCOL_RE = /https?:\/\/[^\s<>"']+/i;
const URL_WWW_RE = /\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/i;
/** Bare domains like influo.gr / brand.com / app.io — not @handles */
const URL_BARE_DOMAIN_RE =
  /(?<![@\w./])\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:gr|com|io|net|org|eu|co|uk|de|fr|it|es|nl|app|dev|me|tv|info|biz)(?:\/[^\s<>"']*)?\b/i;

/**
 * Phones: +30 / separators / long digit runs.
 * Skips currency (€) and thousand-grouped figures like 10.000 / 1,500.
 */
const PHONE_CANDIDATE_RE =
  /(?:\+\s*30[\s.-]*)?(?:\(?0?\d{2,4}\)?[\s.-]+)+\d{3,}|\+\s*\d[\d\s./-]{7,}\d|(?<![\d€$])\b\d{8,15}\b/g;

function isLikelyPriceOrCount(match: string, full: string, index: number): boolean {
  const before = full.slice(Math.max(0, index - 12), index);
  const after = full.slice(index + match.length, index + match.length + 16);
  if (/[€$£]/.test(before) || /\beur\b|\beuro/i.test(before)) return true;
  if (/followers|ακόλουθ|views|προβολ|budget|τιμή|price|€/i.test(after)) return true;
  // Thousand separators: 10.000 or 1,500 (not phone-like grouping)
  if (/^\d{1,3}([.,]\d{3})+$/.test(match.trim())) return true;
  return false;
}

function findPhone(text: string): boolean {
  PHONE_CANDIDATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_CANDIDATE_RE.exec(text)) !== null) {
    const raw = m[0];
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8) continue;
    if (isLikelyPriceOrCount(raw, text, m.index)) continue;
    return true;
  }
  return false;
}

/**
 * Returns the contact-info kind found in free text, or null.
 * @username mentions are allowed. Work-link fields should use filterWorkLinks instead.
 */
export function findContactInfo(text: string): ContactInfoKind | null {
  if (!text || !text.trim()) return null;
  const t = text;

  if (MESSENGER_RE.test(t)) return "messenger";
  if (EMAIL_RE.test(t) || EMAIL_OBFUSCATED_RE.test(t)) return "email";
  if (URL_PROTOCOL_RE.test(t) || URL_WWW_RE.test(t) || URL_BARE_DOMAIN_RE.test(t)) return "link";
  if (findPhone(t)) return "phone";
  return null;
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  return ALLOWED_WORK_LINK_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

/**
 * Keeps only http(s) URLs whose host is an allowed social network (incl. subdomains).
 */
export function filterWorkLinks(raw: string): { ok: string[]; rejected: string[] } {
  const ok: string[] = [];
  const rejected: string[] = [];
  if (!raw?.trim()) return { ok, rejected };

  const tokens = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const token of tokens) {
    let urlStr = token;
    if (!/^https?:\/\//i.test(urlStr)) {
      // Only treat clear URL-like tokens as links to accept/reject
      if (/^www\./i.test(urlStr) || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(urlStr)) {
        urlStr = `https://${urlStr}`;
      } else {
        rejected.push(token);
        continue;
      }
    }
    try {
      const u = new URL(urlStr);
      if (!/^https?:$/i.test(u.protocol)) {
        rejected.push(token);
        continue;
      }
      if (hostAllowed(u.hostname)) ok.push(u.toString());
      else rejected.push(token);
    } catch {
      rejected.push(token);
    }
  }
  return { ok, rejected };
}
