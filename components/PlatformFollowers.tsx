"use client";

import {
  formatFollowerCount,
  parseFollowerNumber,
  statsFromAccounts,
  type PlatformStat,
} from "@/lib/platformStats";

export type { PlatformStat };
export { parseFollowerNumber, formatFollowerCount, statsFromAccounts };

const LABEL: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  facebook: "FB",
  twitter: "X",
};

function Icon({ platform }: { platform: string }) {
  const common = "w-3.5 h-3.5 shrink-0";
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-pink-600`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-slate-900`} fill="currentColor" aria-hidden>
        <path d="M14 3h2.2a5.2 5.2 0 0 0 3.6 2.1v2.3a7.4 7.4 0 0 1-3.6-1v6.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.4a3.2 3.2 0 1 0 2.5 3.1V3z" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-red-600`} fill="currentColor" aria-hidden>
        <path d="M23 12.2s0-3.2-.4-4.6a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.5a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.6a3 3 0 0 0 2.1 2.1C5.1 19.4 12 19.4 12 19.4s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.4.4-4.6.4-4.6zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-blue-600`} fill="currentColor" aria-hidden>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
      </svg>
    );
  }
  return <span className="text-[10px] font-bold text-slate-500">{LABEL[platform] || platform.slice(0, 2).toUpperCase()}</span>;
}

export default function PlatformFollowers({
  accounts,
  className = "",
  showTotal = true,
  lang = "el",
}: {
  accounts: unknown;
  className?: string;
  showTotal?: boolean;
  lang?: "el" | "en";
}) {
  const stats = statsFromAccounts(accounts);
  if (!stats.length) return null;
  const total = stats.reduce((sum, row) => sum + parseFollowerNumber(row.followers), 0);
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stats.map((row) => (
          <span key={row.platform} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
            <Icon platform={row.platform} />
            <span className="text-slate-500 font-medium">{LABEL[row.platform] || row.platform.slice(0, 2).toUpperCase()}</span>
            {row.followers}
          </span>
        ))}
      </div>
      {showTotal && stats.length > 1 && total > 0 ? (
        <p className="text-[11px] text-slate-500 mt-1">
          {lang === "el" ? "Σύνολο" : "Total"} {formatFollowerCount(total)}
        </p>
      ) : null}
    </div>
  );
}
