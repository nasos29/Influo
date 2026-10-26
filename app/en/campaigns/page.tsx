import type { Metadata } from "next";
import PublicCampaignsPage from "@/components/PublicCampaignsPage";
import { loadOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { absoluteUrl, languageAlternates } from "@/lib/site";

export const revalidate = 300;

const copy = {
  title: "Open brand campaigns | Influo",
  description:
    "Open campaigns from verified brands in Greece. See budget and deliverables, and apply as a creator.",
} as const;

export const metadata: Metadata = {
  title: { absolute: copy.title },
  description: copy.description,
  openGraph: {
    title: copy.title,
    description: copy.description,
    url: absoluteUrl("/en/campaigns"),
  },
  alternates: {
    canonical: absoluteUrl("/en/campaigns"),
    languages: languageAlternates("/campaigns", "/en/campaigns"),
  },
};

export default async function EnPublicCampaignsRoute() {
  const initialCampaigns = await loadOpenCampaigns();
  return <PublicCampaignsPage initialCampaigns={initialCampaigns} />;
}
