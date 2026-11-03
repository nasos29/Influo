"use client";

import { bestFollowersFor } from "@/lib/campaignAlert";
import { formatFollowerCount } from "@/lib/platformStats";

/** Soft, non-blocking notice when the creator is below the campaign's follower minimum. */
export default function FollowerGapNotice({
  accounts,
  platforms,
  minFollowers,
  lang,
}: {
  accounts: unknown;
  platforms?: string[] | null;
  minFollowers?: number | null;
  lang: "el" | "en";
}) {
  const minimum = Number(minFollowers) || 0;
  if (minimum <= 0 || accounts == null) return null;
  const mine = bestFollowersFor(accounts, platforms);
  if (mine >= minimum) return null;
  const need = formatFollowerCount(minimum);
  const have = formatFollowerCount(mine) || "0";
  const text =
    lang === "el"
      ? `Το brand ζητάει από ${need} ακολούθους, εσύ έχεις ${have}. Μπορείς να κάνεις αίτηση, αλλά οι πιθανότητες είναι μικρότερες.`
      : `The brand asks for ${need}+ followers; you have ${have}. You can still apply, but your chances are lower.`;
  return (
    <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {text}
    </p>
  );
}
