import type { Metadata } from "next";
import CampaignPublicView from "@/components/CampaignPublicView";
import { loadCampaignApplicationsCount } from "@/lib/loadHomeOpenCampaigns";
import { loadPublicCampaignById } from "@/lib/publicCampaignVisibility";

export const metadata: Metadata = {
  title: { absolute: "Καμπάνια | Influo" },
  description: "Λεπτομέρειες ανοιχτής καμπάνιας brand στο Influo.",
};

type Params = Promise<{ id: string }>;

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  const [applicationsCount, initialCampaign] = await Promise.all([
    loadCampaignApplicationsCount(id),
    loadPublicCampaignById(id),
  ]);
  return (
    <CampaignPublicView
      id={id}
      applicationsCount={applicationsCount}
      initialCampaign={initialCampaign}
    />
  );
}
