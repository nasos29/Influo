import { parseEuroNumber } from "@/lib/formatEuro";

export type BrandStatProposal = {
  id: string;
  influencerId: string;
  status: string;
  budget: unknown;
  counterBudget: unknown;
  counterStatus: string | null;
  agreementAcceptedAt: string | null;
  publishDeadline: string | null;
  createdAt: string;
};

export type BrandStatCampaign = { status: string };

export type BrandMonthStat = {
  key: string;
  proposals: number;
  amount: number;
};

export type BrandCollaborationStat = {
  id: string;
  influencerId: string;
  amount: number | null;
  status: string;
  date: string | null;
  deadline: string | null;
};

export type BrandStatistics = {
  sent: number;
  accepted: number;
  acceptanceRate: number | null;
  completedAgreements: number;
  spent: number;
  average: number | null;
  activeCampaigns: number;
  totalCampaigns: number;
  uniqueCreators: number;
  months: BrandMonthStat[];
  collaborations: BrandCollaborationStat[];
};

const ATHENS = "Europe/Athens";

function athensYearMonth(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) return null;
  return `${year}-${month}`;
}

export function lastSixAthensMonths(now = new Date()): string[] {
  const current = athensYearMonth(now.toISOString());
  if (!current) return [];
  const [yearText, monthText] = current.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  const keys: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return keys.reverse();
}

/** Agreed price: accepted counter-offer, otherwise the original budget. Integer euros. */
export function agreedProposalEuros(row: Pick<BrandStatProposal, "budget" | "counterBudget" | "counterStatus">): number | null {
  const useCounter = row.counterStatus === "accepted" && row.counterBudget;
  const amount = parseEuroNumber(useCounter ? row.counterBudget : row.budget);
  if (amount == null || !(amount > 0)) return null;
  return Math.round(amount);
}

function isAccepted(status: string): boolean {
  return status === "accepted" || status === "completed";
}

export function aggregateBrandStatistics(
  proposals: BrandStatProposal[],
  campaigns: BrandStatCampaign[],
  now = new Date()
): BrandStatistics {
  const months = lastSixAthensMonths(now).map((key) => ({ key, proposals: 0, amount: 0 }));
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));
  const creators = new Set<string>();
  let accepted = 0;
  let completedAgreements = 0;
  let spent = 0;
  let priced = 0;
  const collaborations: BrandCollaborationStat[] = [];

  for (const row of proposals) {
    if (row.influencerId) creators.add(row.influencerId);
    const price = agreedProposalEuros(row);
    if (isAccepted(row.status)) {
      accepted += 1;
      if (price != null) {
        spent += price;
        priced += 1;
      }
      collaborations.push({
        id: row.id,
        influencerId: row.influencerId,
        amount: price,
        status: row.status,
        date: row.agreementAcceptedAt || row.createdAt || null,
        deadline: row.publishDeadline,
      });
    }
    if (row.agreementAcceptedAt) completedAgreements += 1;
    const key = row.createdAt ? athensYearMonth(row.createdAt) : null;
    const index = key ? monthIndex.get(key) : undefined;
    if (index != null) {
      months[index].proposals += 1;
      if (price != null) months[index].amount += price;
    }
  }

  collaborations.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const sent = proposals.length;
  return {
    sent,
    accepted,
    acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : null,
    completedAgreements,
    spent,
    average: priced > 0 ? Math.round(spent / priced) : null,
    activeCampaigns: campaigns.filter((row) => row.status === "open").length,
    totalCampaigns: campaigns.length,
    uniqueCreators: creators.size,
    months,
    collaborations: collaborations.slice(0, 8),
  };
}
