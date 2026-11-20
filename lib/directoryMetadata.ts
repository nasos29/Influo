import type { Metadata } from "next";
import { pageMetadata } from "@/lib/pageMetadata";
import { categorySeoKeywords } from "@/lib/categories";

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