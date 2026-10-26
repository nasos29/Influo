import type { Metadata } from "next";
import CampaignPublicView from "@/components/CampaignPublicView";
import { loadCampaignApplicationsCount } from "@/lib/loadHomeOpenCampaigns";

export const metadata: Metadata = {
  title: { absolute: "Καμπάνια | Influo" },
  description: "Λεπτομέρειες ανοιχτής καμπάνιας brand στο Influo.",
};

type Params = Promise<{ id: string }>;

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  const applicationsCount = await loadCampaignApplicationsCount(id);
  return <CampaignPublicView id={id} applicationsCount={applicationsCount} />;
}
