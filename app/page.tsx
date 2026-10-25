import HomePage from "@/components/HomePage";
import { loadPublicDirectoryCards } from "@/lib/directoryCards";

export const revalidate = 300;

export default async function Page() {
  const initialInfluencers = await loadPublicDirectoryCards(24);
  return <HomePage initialInfluencers={initialInfluencers} />;
}
