import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";

export const revalidate = 3600;

export default async function Page() {
  const initialInfluencers = await loadPublicDirectoryCards(24);
  return <HomePage initialInfluencers={initialInfluencers} />;
}
