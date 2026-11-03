export type TextPart = { type: "text" | "link"; value: string };
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

export function splitLinks(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", value: text.slice(last, i) });
    out.push({ type: "link", value: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export const firstLink = (text: string) => splitLinks(text).find((p) => p.type === "link")?.value ?? null;

/** True for hosts we must never fetch server-side (SSRF guard). */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (h.includes(":")) return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  return false;
}

export function parseMeta(html: string): { title?: string; description?: string; image?: string } {
  const meta = (key: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    return tag?.match(/content=["']([^"']*)["']/i)?.[1];
  };
  const dec = (s?: string) => s?.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim().slice(0, 300) || undefined;
  return {
    title: dec(meta("og:title") || meta("twitter:title") || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
    description: dec(meta("og:description") || meta("description")),
    image: dec(meta("og:image") || meta("twitter:image")),
  };
}
