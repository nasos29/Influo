import DirectoryPageView from "@/components/DirectoryPageView";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";

export const revalidate = 300;

export default async function DirectoryPage() {
  const initialInfluencers = await loadPublicDirectoryCards(24);
  return <DirectoryPageView initialInfluencers={initialInfluencers} />;
}
