"use client";

import CountUp from "@/components/CountUp";
import type { SocialProofStats } from "@/lib/loadSocialProofStats";

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
    <div className="w-full max-w-page mx-auto px-6 pb-4">
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
        {items.map((item) => (
          <li key={item.key} className="text-center min-w-0">
            <p className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">
              {item.kind === "rating" ? (
                <>
                  {item.value.toFixed(1)}
                  <span className="ml-0.5 text-amber-500">★</span>
                </>
              ) : (
                <CountUp value={item.value} className="tabular-nums" />
              )}
            </p>
            <p className="mt-1 text-sm md:text-base text-slate-600 font-medium">{item.label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
