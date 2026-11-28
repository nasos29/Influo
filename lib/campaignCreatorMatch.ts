import { directoryEngagement } from "@/lib/directoryQuery";
import { normalizeGender, type GenderValue } from "@/lib/gender";
import { bestFollowersFor } from "@/lib/campaignAlert";

export type CampaignCreatorRequirements = {
  min_followers?: number | null;
  required_gender?: string | null;
  min_engagement_rate?: number | null;
  max_engagement_rate?: number | null;
  platforms?: string[] | null;
};

export type CreatorMatchInput = {
  gender?: string | null;
  accounts?: unknown;
  engagement_rate?: string | Record<string, string> | null;
};

export type CreatorMatchResult =
  | { ok: true }
  | { ok: false; reason: "gender" | "followers" | "engagement_min" | "engagement_max" };

export function creatorMeetsCampaignRequirements(
  campaign: CampaignCreatorRequirements,
  creator: CreatorMatchInput
): CreatorMatchResult {
  const reqGender = campaign.required_gender?.trim();
  if (reqGender && reqGender !== "All") {
    const g = normalizeGender(typeof creator.gender === "string" ? creator.gender : null);
    if (g !== reqGender) return { ok: false, reason: "gender" };
  }

  const minF = Number(campaign.min_followers) || 0;
  if (minF > 0) {
    const mine = bestFollowersFor(creator.accounts, campaign.platforms);
    if (mine < minF) return { ok: false, reason: "followers" };
  }

  const er = directoryEngagement(creator.engagement_rate);
  const minEr = Number(campaign.min_engagement_rate);
  const maxEr = Number(campaign.max_engagement_rate);
  if (Number.isFinite(minEr) && minEr > 0 && er < minEr) return { ok: false, reason: "engagement_min" };
  if (Number.isFinite(maxEr) && maxEr > 0 && er > maxEr) return { ok: false, reason: "engagement_max" };

  return { ok: true };
}

export function parseOptionalEr(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseCampaignGender(value: unknown): GenderValue | null {
  const v = String(value || "").trim();
  if (v === "Female" || v === "Male" || v === "AI") return v;
  return null;
}