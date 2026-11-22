"use client";

import CountUp from "@/components/CountUp";
import type { SocialProofStats } from "@/lib/loadSocialProofStats";
import { openCampaignsLabel } from "@/lib/pluralize";
import { Building2, Handshake, Megaphone, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";

type Lang = "el" | "en";

const STATS_SECTION_BG = "/images/athos-food-falling.webp";

const COPY = {
  el: {
    completed: "ολοκληρωμένες συνεργασίες",
    creators: "ενεργοί creators",
    brands: "brands",
    rating: "μέση αξιολόγηση",
  },
  en: {
    completed: "completed collaborations",
    creators: "active creators",
    brands: "brands",
    rating: "average rating",
  },
} as const;

const STAT_ICONS: Record<string, LucideIcon> = {
  completed: Handshake,
  creators: Users,
  brands: Building2,
  openCampaigns: Megaphone,
  rating: Star,
};

const GRADIENT_NUMBER =
  "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent";

function gridLayoutClass(count: number): string {
  if (count === 1) {
    return "grid grid-cols-1 max-w-sm mx-auto";
  }
  if (count === 2) {
    return "grid grid-cols-2 gap-4 max-w-xl mx-auto lg:max-w-3xl lg:gap-5";
  }
  if (count === 3) {
    return "grid grid-cols-1 gap-4 max-w-sm mx-auto sm:grid-cols-3 sm:max-w-4xl sm:gap-5";
  }
  if (count === 4) {
    return "grid grid-cols-2 gap-4 max-w-2xl mx-auto lg:grid-cols-4 lg:max-w-6xl lg:gap-5";
  }
  return "grid grid-cols-2 gap-4 max-w-2xl mx-auto sm:grid-cols-3 lg:grid-cols-5 lg:max-w-6xl lg:gap-4";
}

export default function SocialProofStatsRow({
  stats,
  lang,
  openCampaignsCount,
  showAverageRating = true,
}: {
  stats: SocialProofStats;
  lang: Lang;
  openCampaignsCount?: number | null;
  /** When false, never show the rating stat (e.g. marketing pages matching homepage’s four metrics). */
  showAverageRating?: boolean;
}) {
  const txt = COPY[lang];
  const items: Array<{ key: string; value: number; label: string; kind: "int" | "rating" }> = [];

  if (typeof stats.completedCollaborations === "number" && stats.completedCollaborations > 0) {
    items.push({
      key: "completed",
      value: stats.completedCollaborations,
      label: txt.completed,
      kind: "int",
    });
  }
  if (typeof stats.activeCreators === "number" && stats.activeCreators > 0) {
    items.push({ key: "creators", value: stats.activeCreators, label: txt.creators, kind: "int" });
  }
  if (typeof stats.brandsCount === "number" && stats.brandsCount > 0) {
    items.push({ key: "brands", value: stats.brandsCount, label: txt.brands, kind: "int" });
  }
  if (typeof openCampaignsCount === "number" && openCampaignsCount > 0) {
    items.push({
      key: "openCampaigns",
      value: openCampaignsCount,
      label: openCampaignsLabel(openCampaignsCount, lang),
      kind: "int",
    });
  }
  if (
    showAverageRating &&
    typeof stats.averageRating === "number" &&
    stats.averageRating > 0
  ) {
    items.push({
      key: "rating",
      value: stats.averageRating,
      label: txt.rating,
      kind: "rating",
    });
  }

  if (items.length === 0) return null;

  const fifthAloneOnMobile = items.length === 5;

  return (
    <section
      className="relative w-full overflow-hidden border-y border-purple-900/10 py-10 md:py-12"
      aria-label={lang === "el" ? "Στατιστικά πλατφόρμας" : "Platform statistics"}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={STATS_SECTION_BG}
          alt=""
          fill
          className="object-cover object-center scale-105 blur-[3px] brightness-[0.5] saturate-90"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/80 via-violet-950/70 to-slate-950/75" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/15 via-transparent to-purple-900/20" />
      </div>

      <div className="relative w-full max-w-page mx-auto px-4 sm:px-6">
        <ul className={`w-full ${gridLayoutClass(items.length)}`}>
          {items.map((item, index) => {
            const Icon = STAT_ICONS[item.key];
            const centerFifthOnMobile = fifthAloneOnMobile && index === 4;

            return (
              <li
                key={item.key}
                className={`flex min-w-0 flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/92 px-3 py-5 text-center shadow-lg shadow-purple-950/10 backdrop-blur-md ring-1 ring-white/50 sm:px-5 sm:py-6 md:px-6 ${
                  centerFifthOnMobile ? "col-span-2 max-w-xs justify-self-center sm:col-span-1 sm:max-w-none" : ""
                }`}
              >
                {Icon ? (
                  <div
                    className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/15 via-violet-600/12 to-purple-600/20 ring-1 ring-purple-200/60 sm:h-14 sm:w-14"
                    aria-hidden
                  >
                    <Icon
                      className="h-6 w-6 text-purple-600 sm:h-7 sm:w-7"
                      strokeWidth={2.25}
                    />
                  </div>
                ) : null}
                <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl md:text-[2.75rem] md:leading-none">
                  {item.kind === "rating" ? (
                    <>
                      <span className={GRADIENT_NUMBER}>{item.value.toFixed(1)}</span>
                      <span className="ml-0.5 text-2xl text-amber-500 sm:text-3xl" aria-hidden>
                        ★
                      </span>
                    </>
                  ) : (
                    <CountUp value={item.value} className={GRADIENT_NUMBER} />
                  )}
                </p>
                <p className="mt-2 px-0.5 text-xs font-medium leading-snug text-slate-600 sm:text-sm md:text-base">
                  {item.label}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}