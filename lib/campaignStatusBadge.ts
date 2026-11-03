import { campaignClosesAt } from "./campaignLifecycle.ts";

export type StatusBadgeInput = {
  status?: string | null;
  deadline?: string | null;
  opened_at?: string | null;
  created_at?: string | null;
  slots?: number | null;
  slots_filled?: number | null;
};

/** One status badge for campaign covers: open = green, closed/full/expired = red, draft = amber. */
export function campaignStatusBadge(c: StatusBadgeInput, lang: "el" | "en", now = Date.now()): { text: string; className: string } | null {
  const el = lang === "el";
  const red = "bg-red-600 text-white";
  if (c.status === "draft") return { text: el ? "Πρόχειρο" : "Draft", className: "bg-amber-500 text-white" };
  if (c.status !== "open") return c.status ? { text: el ? "Κλειστή" : "Closed", className: red } : null;
  if (c.slots != null && c.slots > 0 && (c.slots_filled ?? 0) >= c.slots) return { text: el ? "Πλήρης" : "Full", className: red };
  try {
    if (c.deadline || c.opened_at || c.created_at) {
      const closes = campaignClosesAt({ deadline: c.deadline ?? null, opened_at: c.opened_at ?? null, created_at: c.created_at || new Date(now).toISOString() });
      if (closes.getTime() < now) return { text: el ? "Έληξε" : "Expired", className: red };
    }
  } catch {
    /* bad date: treat as open */
  }
  return { text: el ? "Ανοιχτή" : "Open", className: "bg-emerald-600 text-white" };
}
