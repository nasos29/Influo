import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import CollaborationsListingPage from "@/components/CollaborationsListingPage";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Collaborations | Influo",
  description: "Recent completed brand–creator collaborations on Influo.",
};

const cached = unstable_cache(
  () => loadRecentCollaborations(24),
  ["collaborations-listing-en"],
  { revalidate: 3600, tags: ["recent-collaborations"] }
);

export default async function CollaborationsPageEn() {
  const items = await cached();
  return <CollaborationsListingPage items={items} lang="en" />;
}
