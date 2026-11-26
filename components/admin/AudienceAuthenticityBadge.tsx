"use client";

import type { AudienceAuthenticity } from "@/lib/audienceAuthenticity";

const STYLES: Record<string, string> = {
  clean: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  review: "bg-orange-100 text-orange-900 ring-orange-200",
  suspicious: "bg-red-100 text-red-900 ring-red-200",
  insufficient: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function AudienceAuthenticityBadge({
  auth,
  lang,
}: {
  auth?: AudienceAuthenticity | null;
  lang: "el" | "en";
}) {
  if (!auth) return null;
  const label = lang === "el" ? auth.labelEl : auth.labelEn;
  const tips = auth.reasons.map((r) => (lang === "el" ? r.el : r.en)).join("\n");
  const title = tips || (lang === "el" ? "Αυθεντικότητα κοινού" : "Audience authenticity");
  const score = auth.score != null ? ` ${auth.score}` : "";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STYLES[auth.status] || STYLES.insufficient}`}
    >
      {label}
      {score}
    </span>
  );
}