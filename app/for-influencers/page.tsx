import ForInfluencersPage from "@/components/ForInfluencersPage";
import { loadPlatformMarketingStats } from "@/lib/loadPlatformMarketingStats";

export const revalidate = 3600;

export default async function Page() {
  const stats = await loadPlatformMarketingStats();
  return <ForInfluencersPage stats={stats} />;
}
