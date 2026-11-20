"use client";

import CountUp from "@/components/CountUp";
import type { SocialProofStats } from "@/lib/loadSocialProofStats";
import { Building2, Handshake, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Lang = "el" | "en";

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
  rating: Star,
};

const GRADIENT_NUMBER =
  "bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent";

function listLayoutClass(count: number): string {
  if (count === 1) {
    return "grid grid-cols-1 max-w-xs mx-auto sm:flex sm:max-w-md";
  }
  if (count === 2) {
    return "grid grid-cols-2 gap-3 max-w-lg mx-auto sm:flex sm:max-w-2xl sm:gap-0";
  }
  if (count === 3) {
    return "grid grid-cols-3 gap-2 sm:gap-3 max-w-4xl mx-auto sm:flex sm:gap-0";
  }
  return "grid grid-cols-2 gap-3 max-w-lg mx-auto sm:flex sm:max-w-5xl sm:gap-0";
}

export default function SocialProofStatsRow({
  stats,
  lang,
}: {
  stats: SocialProofStats;
  lang: Lang;
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
  if (typeof stats.averageRating === "number" && stats.averageRating > 0) {
    items.push({
      key: "rating",
      value: stats.averageRating,
      label: txt.rating,
      kind: "rating",
    });
  }

  if (items.length === 0) return null;

  return (
    <section
      className="w-full border-y border-slate-200/80 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/60 py-8 md:py-10"
      aria-label={lang === "el" ? "Στατιστικά πλατφόρμας" : "Platform statistics"}
    >
      <div className="w-full max-w-page mx-auto px-4 sm:px-6">
        <ul
          className={`w-full ${listLayoutClass(items.length)} sm:items-stretch sm:justify-center sm:divide-x sm:divide-slate-200/90`}
        >
          {items.map((item) => {
            const Icon = STAT_ICONS[item.key];

            return (
              <li
                key={item.key}
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-slate-100/90 bg-white/90 px-2 py-4 text-center shadow-sm sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 sm:py-1 sm:shadow-none md:px-8"
              >
                {Icon ? (
                  <div
                    className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600/10 to-purple-600/15"
                    aria-hidden
                  >
                    <Icon className="h-[1.125rem] w-[1.125rem] text-purple-600" strokeWidth={2.25} />
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
                <p className="mt-2 px-0.5 text-xs font-medium leading-snug text-slate-600 sm:px-0 sm:text-sm md:text-base">
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