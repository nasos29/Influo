import type { Metadata } from "next";
import CollaborationsListingPage from "@/components/CollaborationsListingPage";
import { loadRecentCollaborations } from "@/lib/loadRecentCollaborations";

export const runtime = "nodejs";
/** Runtime fetch — build cannot reach internal Supabase; avoid baking an empty list at build time. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Συνεργασίες | Influo",
  description: "Πρόσφατες ολοκληρωμένες συνεργασίες brands και creators στο Influo.",
};

export default async function CollaborationsPage() {
  const items = await loadRecentCollaborations(24, { surface: "listing" });
  return <CollaborationsListingPage items={items} lang="el" />;
}