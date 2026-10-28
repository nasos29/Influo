import ForBrandsPage from "@/components/ForBrandsPage";
import { loadPlatformMarketingStats } from "@/lib/loadPlatformMarketingStats";

export const revalidate = 3600;

export default async function Page() {
  const stats = await loadPlatformMarketingStats();
  return <ForBrandsPage stats={stats} />;
}
