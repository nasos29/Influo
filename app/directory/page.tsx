import DirectoryPageView from "@/components/DirectoryPageView";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";

export const revalidate = 3600;

export default async function DirectoryPage() {
  const initialInfluencers = await loadPublicDirectoryCards(24);
  return <DirectoryPageView initialInfluencers={initialInfluencers} />;
}
