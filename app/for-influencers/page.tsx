import ForInfluencersPage from "@/components/ForInfluencersPage";
import { loadPlatformMarketingStats } from "@/lib/loadPlatformMarketingStats";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedStats = unstable_cache(
  () => loadPlatformMarketingStats(),
  ["marketing-platform-stats"],
  { revalidate: 3600, tags: ["marketing-stats"] }
);

export default async function Page() {
  const stats = await cachedStats();
  return <ForInfluencersPage stats={stats} />;
}
