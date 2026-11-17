import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import CollaborationsListingPage from "@/components/CollaborationsListingPage";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Συνεργασίες | Influo",
  description: "Πρόσφατες ολοκληρωμένες συνεργασίες brands και creators στο Influo.",
};

const cached = unstable_cache(
  () => loadRecentCollaborations(24, { surface: "listing" }),
  ["collaborations-listing-el", "listing-surface"],
  { revalidate: 3600, tags: ["recent-collaborations"] }
);

export default async function CollaborationsPage() {
  const items = await cached();
  return <CollaborationsListingPage items={items} lang="el" />;
}
