import type { Metadata } from "next";
import CampaignPublicView from "@/components/CampaignPublicView";
import { loadCampaignApplicationsCount } from "@/lib/loadHomeOpenCampaigns";
import { campaignSlotInfo } from "@/lib/campaignSlots";
import { supabaseService } from "@/lib/apiAuth";
import { loadPublicCampaignById } from "@/lib/publicCampaignVisibility";

export const metadata: Metadata = {
  title: { absolute: "Καμπάνια | Influo" },
  description: "Λεπτομέρειες ανοιχτής καμπάνιας brand στο Influo.",
};

type Params = Promise<{ id: string }>;

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  const [applicationsCount, initialCampaign, slotMap] = await Promise.all([
    loadCampaignApplicationsCount(id),
    loadPublicCampaignById(id),
    campaignSlotInfo(supabaseService(), [id]).catch(() => ({} as Awaited<ReturnType<typeof campaignSlotInfo>>)),
  ]);
  const slot = slotMap[id];
  return (
    <CampaignPublicView
      id={id}
      applicationsCount={applicationsCount}
      slots={slot?.slots ?? null}
      slotsFilled={slot?.filled ?? 0}
      initialCampaign={initialCampaign}
    />
  );
}
