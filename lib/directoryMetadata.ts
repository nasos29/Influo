import type { Metadata } from "next";
import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

const OG_ALT_EL = "Influo — Influencers και ψηφιακοί δημιουργοί στην Ελλάδα";
const OG_ALT_EN = "Influo — influencers and content creators in Greece";

export const directoryElMetadata: Metadata = pageMetadata({
  title: "Κατάλογος Δημιουργών – Influencers στην Ελλάδα | Influo",
  description:
    "Δες 400+ verified Έλληνες influencers σε Instagram, TikTok και YouTube. Φίλτρα ανά κατηγορία, πόλη, engagement και τιμή. Δωρεάν αναζήτηση.",
  path: "/directory",
  enPath: "/en/directory",
  keywords: ["influencers Ελλάδα", "κατάλογος influencers", ...categorySeoKeywords()],
  imageAlt: OG_ALT_EL,
});

export const directoryEnMetadata: Metadata = pageMetadata({
  title: "Greek Influencer Directory: Instagram, TikTok, YouTube | Influo",
  description:
    "Browse 400+ verified Greek influencers on Instagram, TikTok and YouTube. Filter by category, city, engagement and price.",
  path: "/en/directory",
  elPath: "/directory",
  enPath: "/en/directory",
  locale: "en_US",
  keywords: ["Greek influencers", "influencer directory", ...categorySeoKeywords()],
  imageAlt: OG_ALT_EN,
});

/** Faceted directory search (?q=): align with middleware X-Robots-Tag noindex, follow. */
export function directoryPageMetadata(lang: "el" | "en", q?: string): Metadata {
  const base = lang === "en" ? directoryEnMetadata : directoryElMetadata;
  const qTrim = (q || "").trim();
  if (!qTrim) return base;

  const path = lang === "en" ? "/en/directory" : "/directory";
  const canonical = `${path}?q=${encodeURIComponent(qTrim)}`;
  const title =
    typeof base.title === "object" && base.title && "absolute" in base.title
      ? base.title.absolute
      : "Influo";
  const description = base.description ?? "";

  return {
    title: { absolute: title },
    description,
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}