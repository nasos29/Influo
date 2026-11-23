import type { Metadata } from "next";
import CollaborationsListingPage from "@/components/CollaborationsListingPage";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collaborations | Influo",
  description: "Recent completed brand–creator collaborations on Influo.",
};

export default async function CollaborationsPageEn() {
  const items = await loadRecentCollaborations(24, { surface: "listing" });
  return <CollaborationsListingPage items={items} lang="en" />;
}