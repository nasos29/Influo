"use client";

import CountUp from "@/components/CountUp";
import { floorToTens, type HomeTrustStats } from "@/lib/loadHomeTrustStats";
import { openCampaignsLabel } from "@/lib/pluralize";

type Lang = "el" | "en";

const copy = {
  el: {
    influencers: "influencers",
  },
  en: {
    influencers: "influencers",
  },
} as const;

export default function HomeTrustStatsRow({
  stats,
  lang,
}: {
  stats: HomeTrustStats;
  lang: Lang;
}) {
  const txt = copy[lang];
  const influencerFloor =
    typeof stats.approvedInfluencers === "number"
      ? floorToTens(stats.approvedInfluencers)
      : null;
  const showInfluencers = influencerFloor != null && influencerFloor > 0;
  const showCampaigns =
    typeof stats.openCampaigns === "number" && stats.openCampaigns > 0;

  if (!showInfluencers && !showCampaigns) return null;

  const items: Array<{ key: string; value: number; suffix: string; label: string }> = [];
  if (showInfluencers && influencerFloor != null) {
    items.push({
      key: "influencers",
      value: influencerFloor,
      suffix: "+",
      label: txt.influencers,
    });
  }
  if (showCampaigns && typeof stats.openCampaigns === "number") {
    items.push({
      key: "campaigns",
      value: stats.openCampaigns,
      suffix: "",
      label: openCampaignsLabel(stats.openCampaigns, lang),
    });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 mt-10 md:mt-12">
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-14">
        {items.map((item) => (
          <li key={item.key} className="text-center min-w-0">
            <p className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
              {/* Final value is in the HTML via CountUp's initial/SSR render; client animates. */}
              <CountUp value={item.value} className="tabular-nums" />
              {item.suffix}
            </p>
            <p className="mt-1 text-sm md:text-base text-slate-600 font-medium">
              {item.label}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
