import DirectoryPageView from "@/components/DirectoryPageView";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";
import { unstable_cache } from "next/cache";

export const revalidate = 3600;

const cachedDirectory = unstable_cache(
  () => loadPublicDirectoryCards(24),
  ["directory-cards"],
  { revalidate: 3600, tags: ["directory"] }
);

export default async function DirectoryPage() {
  const initialInfluencers = await cachedDirectory();
  return <DirectoryPageView initialInfluencers={initialInfluencers} />;
}
