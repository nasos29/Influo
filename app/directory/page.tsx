import DirectoryPageView from "@/components/DirectoryPageView";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedDirectory = unstable_cache(
  () => loadPublicDirectoryCards(40),
  ["directory-cards-page"],
  { revalidate: 3600, tags: ["directory"] }
);

export default async function DirectoryPage() {
  const { influencers, total } = await cachedDirectory();
  return <DirectoryPageView initialInfluencers={influencers} initialTotal={total} />;
}
