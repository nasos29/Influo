/**
 * Signed tokens for review deep-links (star rating) and per-collab prompt decline.
 * Proposal ids are numeric; campaign application ids are UUIDs.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "@/lib/proposalMail";

export type ReviewParty = "brand" | "influencer";
export type ReviewSource = "proposal" | "campaign";

export type ReviewOpenPayload = {
  kind: "open";
  source: ReviewSource;
  id: string;
  party: ReviewParty;
  rating: number;
};

export type ReviewDeclinePayload = {
  kind: "decline";
  source: ReviewSource;
  id: string;
  party: ReviewParty;
};

function reviewSecret(): string {
  return (
    process.env.REVIEW_INVITE_SECRET ||
    process.env.SHOWCASE_OPTOUT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.RESEND_API_KEY ||
    "influo-review-invite-dev"
  ).trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isProposalId(value: string): boolean {
  return /^\d{1,12}$/.test(value);
}

export function isValidReviewCollabId(source: ReviewSource, id: string): boolean {
  if (source === "proposal") return isProposalId(id);
  return isUuid(id);
}

function sign(payload: string): string {
  return createHmac("sha256", reviewSecret()).update(payload).digest("hex").slice(0, 32);
}

function safeEqualToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Token: base64url("reviewopen:source:id:party:rating:sig32") */
export function reviewOpenToken(
  source: ReviewSource,
  id: string,
  party: ReviewParty,
  rating: number
): string {
  const r = Math.min(5, Math.max(1, Math.round(rating)));
  const payload = `reviewopen:${source}:${String(id).trim()}:${party}:${r}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function parseReviewOpenToken(token: string): ReviewOpenPayload | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length !== 6) return null;
    const [kind, source, id, party, ratingRaw, sig] = parts;
    if (kind !== "reviewopen") return null;
    if (source !== "proposal" && source !== "campaign") return null;
    if (party !== "brand" && party !== "influencer") return null;
    if (!isValidReviewCollabId(source, id || "")) return null;
    const rating = Number(ratingRaw);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
    if (!/^[0-9a-f]{32}$/i.test(sig || "")) return null;
    const expected = reviewOpenToken(source, id, party, rating);
    if (!safeEqualToken(String(token), expected)) return null;
    return { kind: "open", source, id, party, rating };
  } catch {
    return null;
  }
}

/** Token: base64url("reviewdecline:source:id:party:sig32") */
export function reviewDeclineToken(source: ReviewSource, id: string, party: ReviewParty): string {
  const payload = `reviewdecline:${source}:${String(id).trim()}:${party}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`, "utf8").toString("base64url");
}

export function parseReviewDeclineToken(token: string): ReviewDeclinePayload | null {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parts = raw.split(":");
    if (parts.length !== 5) return null;
    const [kind, source, id, party, sig] = parts;
    if (kind !== "reviewdecline") return null;
    if (source !== "proposal" && source !== "campaign") return null;
    if (party !== "brand" && party !== "influencer") return null;
    if (!isValidReviewCollabId(source, id || "")) return null;
    if (!/^[0-9a-f]{32}$/i.test(sig || "")) return null;
    const expected = reviewDeclineToken(source, id, party);
    if (!safeEqualToken(String(token), expected)) return null;
    return { kind: "decline", source, id, party };
  } catch {
    return null;
  }
}

export function reviewOpenUrl(
  source: ReviewSource,
  id: string,
  party: ReviewParty,
  rating: number,
  lang: "el" | "en" = "el"
): string {
  const t = reviewOpenToken(source, id, party, rating);
  const qs = new URLSearchParams({ t });
  if (lang === "en") qs.set("lang", "en");
  return `${siteUrl()}/reviews/open?${qs.toString()}`;
}

export function reviewDeclineUrl(
  source: ReviewSource,
  id: string,
  party: ReviewParty,
  lang: "el" | "en" = "el"
): string {
  const t = reviewDeclineToken(source, id, party);
  const qs = new URLSearchParams({ t });
  if (lang === "en") qs.set("lang", "en");
  return `${siteUrl()}/reviews/decline?${qs.toString()}`;
}

/** Login path when opening a signed review link without a session. */
export function reviewOpenLoginPath(party: ReviewParty, returnPath: string): string {
  const base = party === "brand" ? "/brand/login" : "/login";
  return `${base}?redirect=${encodeURIComponent(returnPath)}`;
}

/** Destination after auth for a validated open token. */
export function reviewOpenDestination(
  payload: ReviewOpenPayload,
  opts: { profileUrl?: string | null }
): string {
  const rating = payload.rating;
  const id = encodeURIComponent(payload.id);
  if (payload.party === "brand") {
    const base = (opts.profileUrl || "").split("?")[0] || "/";
    const qs = new URLSearchParams({
      tab: "reviews",
      review: "1",
      rating: String(rating),
      proposalId: payload.id,
    });
    return `${base}?${qs.toString()}`;
  }
  return `/dashboard?tab=proposals&reviewBrand=1&proposalId=${id}&rating=${rating}`;
}
