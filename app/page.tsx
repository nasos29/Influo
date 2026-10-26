import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";

export const revalidate = 300;

export default async function Page() {
  const [initialInfluencers, openCampaigns, trustStats] = await Promise.all([
    loadPublicDirectoryCards(24),
    loadHomeOpenCampaigns(3),
    loadHomeTrustStats(),
  ]);
  return (
    <HomePage
      initialInfluencers={initialInfluencers}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
    />
  );
}
