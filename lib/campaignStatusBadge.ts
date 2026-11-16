import { campaignClosesAt, type CampaignCloseOptions } from "./campaignLifecycle.ts";

export type StatusBadgeInput = {
  status?: string | null;
  deadline?: string | null;
  opened_at?: string | null;
  created_at?: string | null;
  slots?: number | null;
  slots_filled?: number | null;
};

/** One status badge for campaign covers: open = green, closed/full/expired = red, draft = amber. */
export function campaignStatusBadge(
  c: StatusBadgeInput,
  lang: "el" | "en",
  nowOrOpts: number | CampaignCloseOptions = Date.now(),
  maybeOpts?: CampaignCloseOptions
): { text: string; className: string } | null {
  const now = typeof nowOrOpts === "number" ? nowOrOpts : Date.now();
  const opts = typeof nowOrOpts === "number" ? maybeOpts : nowOrOpts;
  const el = lang === "el";
  // Semi-transparent fills — these badges sit on campaign cover images.
  const red = "bg-red-600/55 text-white backdrop-blur-sm border border-white/25";
  const outlined = "border-[1.5px] border-black/40";
  if (c.status === "draft")
    return {
      text: el ? "Πρόχειρο" : "Draft",
      className: "bg-amber-500/60 text-white backdrop-blur-sm border border-white/25",
    };
  if (c.status !== "open") return c.status ? { text: el ? "Κλειστή" : "Closed", className: `${red} ${outlined}` } : null;
  if (c.slots != null && c.slots > 0 && (c.slots_filled ?? 0) >= c.slots)
    return { text: el ? "Συμπληρώθηκαν οι θέσεις" : "All spots filled", className: red };
  try {
    if (c.deadline || c.opened_at || c.created_at) {
      const closes = campaignClosesAt(
        {
          deadline: c.deadline ?? null,
          opened_at: c.opened_at ?? null,
          created_at: c.created_at || new Date(now).toISOString(),
        },
        opts
      );
      if (closes.getTime() < now) return { text: el ? "Έληξε" : "Expired", className: red };
    }
  } catch {
    /* bad date: treat as open */
  }
  return {
    text: el ? "Ανοιχτή" : "Open",
    className: `bg-emerald-600/60 text-white backdrop-blur-sm ${outlined}`,
  };
}
