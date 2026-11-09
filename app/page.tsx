import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { getSiteSettings } from "@/lib/siteSettingsServer";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedHomeTrust = unstable_cache(
  () => loadHomeTrustStats(),
  ["home-trust-stats"],
  { revalidate: 3600, tags: ["home-trust"] }
);

export default async function Page() {
  const settings = await getSiteSettings();
  const creatorsLimit = settings.homepage_creators_count;
  const campaignsLimit = settings.homepage_campaigns_count;

  const [directoryPage, openCampaigns, trustStats] = await Promise.all([
    unstable_cache(
      () => loadPublicDirectoryCards(creatorsLimit),
      ["home-directory-cards-page", String(creatorsLimit)],
      { revalidate: 3600, tags: ["home-directory"] }
    )(),
    unstable_cache(
      () => loadHomeOpenCampaigns(campaignsLimit),
      ["home-open-campaigns", String(campaignsLimit)],
      { revalidate: 3600, tags: ["home-campaigns"] }
    )(),
    cachedHomeTrust(),
  ]);
  return (
    <HomePage
      initialInfluencers={directoryPage.influencers}
      initialDirectoryTotal={directoryPage.total}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
      homeCreatorsLimit={creatorsLimit}
      homeNewlyApprovedLimit={settings.homepage_newly_approved_count}
      homeTopInfluencersLimit={settings.homepage_top_influencers_count}
    />
  );
}
