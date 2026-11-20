import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { loadFeaturedCollaborations } from "@/lib/loadFeaturedCollaborations";
import {
  getHomepageSectionOrderSetting,
  getSiteSettings,
  SITE_SETTINGS_CACHE_TAG,
} from "@/lib/siteSettingsServer";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedHomeTrust = unstable_cache(
  () => loadHomeTrustStats(),
  ["home-trust-stats"],
  { revalidate: 3600, tags: ["home-trust"] }
);

const cachedFeaturedCollaborations = unstable_cache(
  () => loadFeaturedCollaborations(),
  ["home-featured-collaborations-v1"],
  { revalidate: 3600, tags: ["recent-collaborations", SITE_SETTINGS_CACHE_TAG] }
);

export default async function Page() {
  const [settings, sectionOrderSetting] = await Promise.all([
    getSiteSettings(),
    getHomepageSectionOrderSetting(),
  ]);
  const creatorsLimit = settings.homepage_creators_count;
  const campaignsLimit = settings.homepage_campaigns_count;

  const [directoryPage, openCampaigns, trustStats, featuredCollaborations] = await Promise.all([
      unstable_cache(
        () => loadPublicDirectoryCards(creatorsLimit),
        ["home-directory-cards-page", String(creatorsLimit)],
        { revalidate: 3600, tags: ["home-directory"] }
      )(),
      // All open campaigns (newest first); client pages by homepage_campaigns_count.
      unstable_cache(
        () => loadHomeOpenCampaigns(),
        ["home-open-campaigns", "all"],
        { revalidate: 3600, tags: ["home-campaigns"] }
      )(),
      cachedHomeTrust(),
      cachedFeaturedCollaborations(),
    ]);
  return (
    <HomePage
      initialInfluencers={directoryPage.influencers}
      initialDirectoryTotal={directoryPage.total}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
      featuredCollaborations={featuredCollaborations}
      homeCreatorsLimit={creatorsLimit}
      homeNewlyApprovedLimit={settings.homepage_newly_approved_count}
      homeTopInfluencersLimit={settings.homepage_top_influencers_count}
      homeCampaignsLimit={campaignsLimit}
      sectionOrder={sectionOrderSetting.order}
      sectionHidden={sectionOrderSetting.hidden}
    />
  );
}
