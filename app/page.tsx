import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedHomeInfluencers = unstable_cache(
  () => loadPublicDirectoryCards(16),
  ["home-directory-cards"],
  { revalidate: 3600, tags: ["home-directory"] }
);

const cachedHomeCampaigns = unstable_cache(
  () => loadHomeOpenCampaigns(3),
  ["home-open-campaigns"],
  { revalidate: 3600, tags: ["home-campaigns"] }
);

const cachedHomeTrust = unstable_cache(
  () => loadHomeTrustStats(),
  ["home-trust-stats"],
  { revalidate: 3600, tags: ["home-trust"] }
);

export default async function Page() {
  const [initialInfluencers, openCampaigns, trustStats] = await Promise.all([
    cachedHomeInfluencers(),
    cachedHomeCampaigns(),
    cachedHomeTrust(),
  ]);
  return (
    <HomePage
      initialInfluencers={initialInfluencers}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
    />
  );
}
