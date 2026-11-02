import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { loadHomeOpenCampaigns } from "@/lib/loadHomeOpenCampaigns";
import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedHomeInfluencers = unstable_cache(
  () => loadPublicDirectoryCards(8),
  ["home-directory-cards-page"],
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

/** Preview branch only: read public data from a live site when no Supabase key is set locally. */
async function previewData() {
  const origin = process.env.PREVIEW_DATA_ORIGIN;
  if (!origin) return null;
  const res = await fetch(`${origin}/api/influencers/public?page=1`, { cache: "no-store" });
  const json = await res.json();
  const influencers = (json.data || []).slice(0, 8).map((inf: Record<string, unknown>) => ({
    id: inf.id, name: inf.display_name, avatar: inf.avatar_url || "", profile_slug: inf.profile_slug || null,
    bio: "", verified: false, socials: {}, followers: {}, categories: [], platforms: [],
  }));
  return { influencers, total: Number(json.total) || 0 };
}

export default async function Page() {
  const preview = await previewData();
  if (preview) {
    return (
      <HomePage
        initialInfluencers={preview.influencers}
        initialDirectoryTotal={preview.total}
        openCampaigns={[]}
        trustStats={{ approvedInfluencers: preview.total, openCampaigns: null } as never}
      />
    );
  }
  const [directoryPage, openCampaigns, trustStats] = await Promise.all([
    cachedHomeInfluencers(),
    cachedHomeCampaigns(),
    cachedHomeTrust(),
  ]);
  return (
    <HomePage
      initialInfluencers={directoryPage.influencers}
      initialDirectoryTotal={directoryPage.total}
      openCampaigns={openCampaigns}
      trustStats={trustStats}
    />
  );
}
