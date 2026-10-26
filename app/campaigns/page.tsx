import type { Metadata } from "next";
import PublicCampaignsPage from "@/components/PublicCampaignsPage";
import { loadOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { absoluteUrl, languageAlternates } from "@/lib/site";

export const revalidate = 300;

const copy = {
  el: {
    title: "Ανοιχτές καμπάνιες brands | Influo",
    description:
      "Ανοιχτές καμπάνιες από επαληθευμένα brands στην Ελλάδα. Δείτε budget, deliverables και κάντε αίτηση ως creator.",
  },
  en: {
    title: "Open brand campaigns | Influo",
    description:
      "Open campaigns from verified brands in Greece. See budget and deliverables, and apply as a creator.",
  },
} as const;

export const metadata: Metadata = {
  title: { absolute: copy.el.title },
  description: copy.el.description,
  openGraph: {
    title: copy.el.title,
    description: copy.el.description,
    url: absoluteUrl("/campaigns"),
  },
  alternates: {
    canonical: absoluteUrl("/campaigns"),
    languages: languageAlternates("/campaigns", "/en/campaigns"),
  },
};

export default async function PublicCampaignsRoute() {
  const initialCampaigns = await loadOpenCampaigns();
  return <PublicCampaignsPage initialCampaigns={initialCampaigns} />;
}
