import type { Metadata } from "next";
import PublicCampaignsPage from "@/components/PublicCampaignsPage";
import { loadOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";
import { loadSocialProofStats } from "@/lib/loadSocialProofStats";
import { absoluteUrl, languageAlternates } from "@/lib/site";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedOpenCampaigns = unstable_cache(
  () => loadOpenCampaigns(),
  ["public-open-campaigns"],
  { revalidate: 3600, tags: ["public-campaigns"] }
);

const cachedRecentCollaborations = unstable_cache(
  () => loadRecentCollaborations(12),
  ["campaigns-recent-collaborations"],
  { revalidate: 3600, tags: ["recent-collaborations"] }
);

const cachedSocialProofStats = unstable_cache(
  () => loadSocialProofStats(),
  ["campaigns-social-proof-stats"],
  { revalidate: 86400, tags: ["social-proof-stats"] }
);

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
  const [initialCampaigns, recentCollaborations, socialProofStats] = await Promise.all([
    cachedOpenCampaigns(),
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
