/**
 * Signed tokens for creator «add published post URL» links (HMAC-SHA256).
 * Mirrors showcase opt-out token shape; party is always influencer.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "@/lib/proposalMail";
import type { ShowcaseSource } from "@/lib/showcaseOptOut";

export type ShowcaseAddPostPayload = {
  source: ShowcaseSource;
  id: string;
  party: "influencer";
};

function addPostSecret(): string {
  return (
    process.env.SHOWCASE_OPTOUT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "influo-showcase-optout-dev"
  ).trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Signed token: base64url("addpost:source:id:influencer:sig32") */
export function showcaseAddPostToken(source: ShowcaseSource, id: string): string {
  const payload = `addpost:${source}:${String(id).trim()}:influencer`;
  const sig = createHmac("sha256", addPostSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function parseShowcaseAddPostToken(token: string): ShowcaseAddPostPayload | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length !== 5) return null;
    const [kind, source, id, party, sig] = parts;
    if (kind !== "addpost") return null;
    if (source !== "proposal" && source !== "campaign") return null;
    if (party !== "influencer") return null;
    if (!isUuid(id) || !/^[0-9a-f]{32}$/i.test(sig || "")) return null;
    const expected = showcaseAddPostToken(source, id);
    const a = Buffer.from(String(token));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { source, id, party: "influencer" };
  } catch {
    return null;
  }
}

export function showcaseAddPostUrl(
  source: ShowcaseSource,
  id: string,
  lang: "el" | "en" = "el"
): string {
  const t = showcaseAddPostToken(source, id);
  const base = `${siteUrl()}/showcase/add-post`;
  const qs = new URLSearchParams({ t });
  if (lang === "en") qs.set("lang", "en");
  return `${base}?${qs.toString()}`;
}
