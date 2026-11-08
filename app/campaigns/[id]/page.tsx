import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import CampaignPublicView from "@/components/CampaignPublicView";
import { loadCampaignApplicationsCount } from "@/lib/loadHomeOpenCampaigns";
import { campaignSlotInfo } from "@/lib/campaignSlots";
import { supabaseService } from "@/lib/apiAuth";
import { loadPublicCampaignById } from "@/lib/publicCampaignVisibility";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Καμπάνια | Influo" },
  description: "Λεπτομέρειες ανοιχτής καμπάνιας brand στο Influo.",
};

type Params = Promise<{ id: string }>;

const cachedPublicCampaign = (id: string) =>
  unstable_cache(() => loadPublicCampaignById(id), ["public-campaign", id], {
    revalidate: 3600,
    tags: ["public-campaigns", `campaign-${id}`],
  })();

export default async function CampaignPage({ params }: { params: Params }) {
  const { id } = await params;
  const [applicationsCount, initialCampaign, slotMap] = await Promise.all([
    loadCampaignApplicationsCount(id),
    cachedPublicCampaign(id),
    campaignSlotInfo(supabaseService(), [id]).catch(() => ({} as Awaited<ReturnType<typeof campaignSlotInfo>>)),
  ]);
  const slot = slotMap[id];
  return (
    <CampaignPublicView
      id={id}
      applicationsCount={applicationsCount}
      slots={slot?.slots ?? null}
      slotsFilled={slot?.filled ?? 0}
      requiresPresence={slot?.requiresPresence === true}
      initialCampaign={initialCampaign}
    />
  );
}
