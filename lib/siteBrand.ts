import { lookup } from "node:dns/promises";
import net from "node:net";

/** SSRF-safe fetch of a brand website / public Instagram page, extracting text, logo and colors. */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const UA = "Mozilla/5.0 (compatible; InfluoBot/1.0; +https://influo.gr)";

export type SiteBrand = {
  source: "website" | "instagram";
  url: string;
  name: string | null;
  text: string;
  logo: string | null;
  colors: string[];
  blocked?: boolean;
};

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
  if (url.username || url.password) throw new Error("credentials");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("host");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error("private");
  return url;
}

/** GET with manual redirects (each hop re-checked), timeout and byte cap. */
export async function safeFetchText(raw: string): Promise<{ url: string; status: number; body: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!loc) throw new Error("redirect");
      current = new URL(loc, url).toString();
      continue;
    }
    const type = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(type)) {
      await res.body?.cancel().catch(() => {});
      return { url: url.toString(), status: res.status, body: "" };
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        size += value.length;
        chunks.push(value);
        if (size >= MAX_BYTES) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { url: url.toString(), status: res.status, body };
  }
  throw new Error("too_many_redirects");
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content).trim() : null;
}

function abs(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(decode(href.trim()), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function pageText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normHex(h: string): string | null {
  let v = h.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v.slice(1).split("").map((c) => c + c).join("");
  if (!/^#[0-9a-f]{6}$/.test(v)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return null; // skip whites/blacks/greys
  return v;
}

function brandColors(html: string): string[] {
  const out: string[] = [];
  const add = (c: string | null | undefined) => {
    const h = c ? normHex(c.trim()) : null;
    if (h && !out.includes(h)) out.push(h);
  };
  add(meta(html, "theme-color"));
  add(meta(html, "msapplication-TileColor"));
  // CSS custom properties that look like brand colors.
  for (const m of html.matchAll(/--[\w-]*(?:primary|brand|accent|main|secondary)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)) add(m[1]);
  if (out.length < 3) {
    // Most frequent saturated hex in inline styles.
    const freq = new Map<string, number>();
    for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
      const h = normHex(m[0]);
      if (h) freq.set(h, (freq.get(h) || 0) + 1);
    }
    for (const [h] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) add(h);
  }
  return out.slice(0, 3);
}

function logoFrom(html: string, base: string): string | null {
  const link = (rel: string) => {
    const tag = [...html.matchAll(/<link[^>]+>/gi)].map((m) => m[0]).find((t) => new RegExp(`rel=["'][^"']*${rel}[^"']*["']`, "i").test(t));
    return abs(tag?.match(/href=["']([^"']+)["']/i)?.[1], base);
  };
  const imgLogo = [...html.matchAll(/<img[^>]+>/gi)]
    .map((m) => m[0])
    .find((t) => /(class|id|alt|src)=["'][^"']*logo/i.test(t));
  return (
    abs(imgLogo?.match(/src=["']([^"']+)["']/i)?.[1], base) ||
    link("apple-touch-icon") ||
    abs(meta(html, "og:image"), base) ||
    link("icon") ||
    abs("/favicon.ico", base)
  );
}

export function normalizeWebsite(input: string): string | null {
  const v = input.trim();
  if (!v || v.length > 300) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /\./.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeInstagram(input: string): string | null {
  const v = input.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export async function fetchWebsiteBrand(url: string): Promise<SiteBrand> {
  const page = await safeFetchText(url);
  const html = page.body;
  const name = meta(html, "og:site_name") || decode(html.match(/<title[^>]*>([^<]{1,120})/i)?.[1] || "").trim() || null;
  const desc = meta(html, "description") || meta(html, "og:description") || "";
  const text = `${desc} ${pageText(html)}`.replace(/\s+/g, " ").trim().slice(0, 4000);
  return { source: "website", url: page.url, name, text, logo: logoFrom(html, page.url), colors: brandColors(html) };
}

/** Best effort: Instagram usually redirects anonymous server requests to login. */
export async function fetchInstagramBrand(handle: string): Promise<SiteBrand> {
  const url = `https://www.instagram.com/${handle}/`;
  try {
    const page = await safeFetchText(url);
    const blocked = /accounts\/login/.test(page.url) || page.status >= 400;
    const bio = meta(page.body, "og:description") || meta(page.body, "description") || "";
    const title = meta(page.body, "og:title");
    if (blocked || !bio) return { source: "instagram", url, name: null, text: "", logo: null, colors: [], blocked: true };
    return { source: "instagram", url, name: title, text: bio.slice(0, 1500), logo: abs(meta(page.body, "og:image"), url), colors: [] };
  } catch {
    return { source: "instagram", url, name: null, text: "", logo: null, colors: [], blocked: true };
  }
}
