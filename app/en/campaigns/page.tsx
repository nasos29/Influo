import type { Metadata } from "next";
import PublicCampaignsPage from "@/components/PublicCampaignsPage";
import { loadOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";
import { loadSocialProofStats } from "@/lib/loadSocialProofStats";
import { absoluteUrl, languageAlternates } from "@/lib/site";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedRecentCollaborations = unstable_cache(
  () => loadRecentCollaborations(12, { surface: "listing" }),
  ["en-campaigns-recent-collaborations", "listing-surface"],
  { revalidate: 3600, tags: ["recent-collaborations"] }
);

const cachedSocialProofStats = unstable_cache(
  () => loadSocialProofStats(),
  ["en-campaigns-social-proof-stats"],
  { revalidate: 86400, tags: ["social-proof-stats"] }
);

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
  const [initialCampaigns, recentCollaborations, socialProofStats] = await Promise.all([
    loadOpenCampaigns(),
    cachedRecentCollaborations(),
    cachedSocialProofStats(),
  ]);
  return (
    <PublicCampaignsPage
      initialCampaigns={initialCampaigns}
      recentCollaborations={recentCollaborations}
      socialProofStats={socialProofStats}
    />
  );
}
