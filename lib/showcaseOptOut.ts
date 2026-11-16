/**
 * Signed one-click showcase opt-out tokens (HMAC-SHA256).
 * Pattern mirrors brand campaign reminder unsubscribe.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "@/lib/proposalMail";

export type ShowcaseSource = "proposal" | "campaign";
export type ShowcaseParty = "brand" | "influencer";

export type ShowcaseOptOutPayload = {
  source: ShowcaseSource;
  id: string;
  party: ShowcaseParty;
};

function optOutSecret(): string {
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

/** Signed token: base64url("source:id:party:sig32") */
export function showcaseOptOutToken(
  source: ShowcaseSource,
  id: string,
  party: ShowcaseParty
): string {
  const payload = `${source}:${String(id).trim()}:${party}`;
  const sig = createHmac("sha256", optOutSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function parseShowcaseOptOutToken(token: string): ShowcaseOptOutPayload | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length !== 4) return null;
    const [source, id, party, sig] = parts;
    if (source !== "proposal" && source !== "campaign") return null;
    if (party !== "brand" && party !== "influencer") return null;
    if (!isUuid(id) || !/^[0-9a-f]{32}$/i.test(sig || "")) return null;
    const expected = showcaseOptOutToken(source, id, party);
    const a = Buffer.from(String(token));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { source, id, party };
  } catch {
    return null;
  }
}

export function showcaseOptOutUrl(
  source: ShowcaseSource,
  id: string,
  party: ShowcaseParty,
  lang: "el" | "en" = "el"
): string {
  const t = showcaseOptOutToken(source, id, party);
  const base = `${siteUrl()}/showcase/opt-out`;
  const qs = new URLSearchParams({ t });
  if (lang === "en") qs.set("lang", "en");
  return `${base}?${qs.toString()}`;
}

export function consentColumnForParty(party: ShowcaseParty): "brand_showcase_consent" | "influencer_showcase_consent" {
  return party === "brand" ? "brand_showcase_consent" : "influencer_showcase_consent";
}

export function optedOutColumnForParty(
  party: ShowcaseParty
): "brand_showcase_opted_out" | "influencer_showcase_opted_out" {
  return party === "brand" ? "brand_showcase_opted_out" : "influencer_showcase_opted_out";
}
