import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";

export const revalidate = 300;

export default async function Page() {
  const [initialInfluencers, openCampaigns] = await Promise.all([
    loadPublicDirectoryCards(24),
    loadHomeOpenCampaigns(3),
  ]);
  return <HomePage initialInfluencers={initialInfluencers} openCampaigns={openCampaigns} />;
}
