import ForInfluencersPage from "@/components/ForInfluencersPage";
import { loadPlatformMarketingStats } from "@/lib/loadPlatformMarketingStats";
import { loadSocialProofStats } from "@/lib/loadSocialProofStats";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedStats = unstable_cache(
  () => loadPlatformMarketingStats(),
  ["marketing-platform-stats"],
  { revalidate: 3600, tags: ["marketing-stats"] }
);

const cachedSocialProofStats = unstable_cache(
  () => loadSocialProofStats(),
  ["home-social-proof-stats"],
  { revalidate: 86400, tags: ["social-proof-stats"] }
);

export default async function Page() {
  const [platformStats, socialProofStats] = await Promise.all([
    cachedStats(),
    cachedSocialProofStats(),
  ]);
  return (
    <ForInfluencersPage
      socialProofStats={socialProofStats}
      openCampaignsCount={platformStats.openCampaigns}
    />
  );
}