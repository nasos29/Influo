import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";

/** Anonymous platform activity: only a count, no names or prices. Cached 10 minutes in memory. */
const store = globalThis as unknown as { __influoActivity?: { at: number; month: string; count: number } };

function athensMonthStartIso(): { month: string; iso: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value || "1970";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  // Month start in Athens ≈ previous day 22:00 UTC; a 3h margin is irrelevant for a coarse indicator.
  return { month: `${y}-${m}`, iso: new Date(`${y}-${m}-01T00:00:00+02:00`).toISOString() };
}

export async function GET() {
  const { month, iso } = athensMonthStartIso();
  const cached = store.__influoActivity;
  if (cached && cached.month === month && Date.now() - cached.at < 600_000) {
    return NextResponse.json({ collaborationsThisMonth: cached.count });
  }
  const { count, error } = await supabaseService()
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .gte("agreement_accepted_at", iso);
  const value = error ? 0 : count || 0;
  store.__influoActivity = { at: Date.now(), month, count: value };
  return NextResponse.json({ collaborationsThisMonth: value });
}
