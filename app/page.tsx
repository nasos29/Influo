import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { loadFeaturedCollaborations } from "@/lib/loadFeaturedCollaborations";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";
import { loadSocialProofStats } from "@/lib/loadSocialProofStats";
import { HOMEPAGE_FEATURED_COLLABORATION_VIEWS_CACHE_TAG } from "@/lib/homepageFeaturedCollaborationViews";
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
  {
    revalidate: 3600,
    tags: ["recent-collaborations", SITE_SETTINGS_CACHE_TAG, HOMEPAGE_FEATURED_COLLABORATION_VIEWS_CACHE_TAG],
  }
);

const cachedHomeRecentCollaborations = unstable_cache(
  () => loadRecentCollaborations(12, { surface: "homepage" }),
  ["home-recent-collaborations", "homepage-surface"],
  { revalidate: 3600, tags: ["recent-collaborations"] }
);

/** Daily social-proof numbers (DB cache inside loader + ISR). */
const cachedSocialProofStats = unstable_cache(
  () => loadSocialProofStats(),
  ["home-social-proof-stats"],
  { revalidate: 86400, tags: ["social-proof-stats"] }
);

export default async function Page() {
  const [settings, sectionOrderSetting] = await Promise.all([
    getSiteSettings(),
    getHomepageSectionOrderSetting(),
  ]);
  const creatorsLimit = settings.homepage_creators_count;
  const campaignsLimit = settings.homepage_campaigns_count;

  const [directoryPage, openCampaigns, trustStats, featuredCollaborations, recentCollaborations, socialProofStats] =
    await Promise.all([
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
      cachedHomeRecentCollaborations(),
      cachedSocialProofStats(),
    ]);
  return (
    <HomePage
      initialInfluencers={directoryPage.influencers}
      initialDirectoryTotal={directoryPage.total}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
      featuredCollaborations={featuredCollaborations}
      recentCollaborations={recentCollaborations}
      socialProofStats={socialProofStats}
      homeCreatorsLimit={creatorsLimit}
      homeNewlyApprovedLimit={settings.homepage_newly_approved_count}
      homeTopInfluencersLimit={settings.homepage_top_influencers_count}
      homeCampaignsLimit={campaignsLimit}
      sectionOrder={sectionOrderSetting.order}
      sectionHidden={sectionOrderSetting.hidden}
    />
  );
}
