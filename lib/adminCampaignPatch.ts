import { normalizeCategoryToken } from "@/lib/categories";

const STATUSES = new Set(["draft", "open", "closed"]);
const COMPENSATION = new Set(["money", "product", "both"]);
const MAX_BUDGET = 9_999_999_999.99;

export type AdminCampaignStatus = "draft" | "open" | "closed";
export type AdminCampaignCompensation = "money" | "product" | "both";

/** Fields that already exist on brand_campaigns. Never includes min_rate or brand_id. */
export type AdminCampaignPatch = {
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  status: AdminCampaignStatus;
  /** ISO timestamp, or null when the deadline is cleared. */
  deadline: string | null;
  starts_on: string | null;
  location: string | null;
  min_followers: number | null;
  platforms: string[];
  compensation_type: AdminCampaignCompensation | null;
  /** Undefined means "do not touch the column". */
  cover_url?: string | null;
};

export type AdminCampaignPatchResult =
  | { ok: true; campaignId: string; patch: AdminCampaignPatch }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseBudget(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!text) return 0;
  if (text.includes(",") && text.includes(".")) text = text.replace(/\./g, "").replace(",", ".");
  else if (text.includes(",")) text = text.replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseYmd(value: unknown): { ok: true; ymd: string | null } | { ok: false } {
  const text = asString(value).trim();
  if (!text) return { ok: true, ymd: null };
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!match) return { ok: false };
  const ymd = match[1];
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, ymd };
}

/** Store a calendar day at 12:00 UTC so the date does not shift across Europe/Athens. */
export function ymdToDeadlineIso(ymd: string): string {
  return new Date(`${ymd}T12:00:00.000Z`).toISOString();
}

function cleanPlatform(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 40) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}

/**
 * Validate an admin edit of an existing campaign.
 * Unknown keys (including min_rate and brand_id) are ignored.
 */
export function parseAdminCampaignPatch(body: unknown): AdminCampaignPatchResult {
  const record = asRecord(body);
  if (!record) return { ok: false, error: "invalid_request" };

  const campaignId = asString(record.campaignId).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId)) {
    return { ok: false, error: "missing_campaign_id" };
  }

  const title = asString(record.title).trim();
  if (!title) return { ok: false, error: "title_required" };
  if (title.length > 200) return { ok: false, error: "title_too_long" };

  const description = asString(record.description).trim();
  if (description.length > 20000) return { ok: false, error: "description_too_long" };

  const deliverables = asString(record.deliverables).trim();
  if (deliverables.length > 8000) return { ok: false, error: "deliverables_too_long" };

  const location = asString(record.location).trim();
  if (location.length > 200) return { ok: false, error: "location_too_long" };

  const status = asString(record.status).trim();
  if (!STATUSES.has(status)) return { ok: false, error: "invalid_status" };

  const compensationRaw = asString(record.compensation_type).trim();
  if (compensationRaw && !COMPENSATION.has(compensationRaw)) {
    return { ok: false, error: "invalid_compensation" };
  }
  const compensation = (compensationRaw || null) as AdminCampaignCompensation | null;

  const budget = parseBudget(record.budget);
  if (budget == null || budget < 0 || budget > MAX_BUDGET) return { ok: false, error: "invalid_budget" };
  const budgetRounded = Math.round(budget * 100) / 100;
  if ((compensation === "money" || compensation === "both") && !(budgetRounded > 0)) {
    return { ok: false, error: "budget_required" };
  }

  const starts = parseYmd(record.starts_on);
  if (!starts.ok) return { ok: false, error: "invalid_starts_on" };
  const deadlineYmd = parseYmd(record.deadline);
  if (!deadlineYmd.ok) return { ok: false, error: "invalid_deadline" };
  if (starts.ymd && deadlineYmd.ymd && deadlineYmd.ymd <= starts.ymd) {
    return { ok: false, error: "deadline_after_start" };
  }

  let minFollowers: number | null = null;
  const minRaw = asString(record.min_followers).trim();
  if (minRaw) {
    if (!/^\d+$/.test(minRaw)) return { ok: false, error: "invalid_min_followers" };
    const parsed = Number(minRaw);
    if (!Number.isSafeInteger(parsed) || parsed > 100_000_000) {
      return { ok: false, error: "invalid_min_followers" };
    }
    minFollowers = parsed;
  } else if (typeof record.min_followers === "number") {
    if (!Number.isInteger(record.min_followers) || record.min_followers < 0 || record.min_followers > 100_000_000) {
      return { ok: false, error: "invalid_min_followers" };
    }
    minFollowers = record.min_followers;
  }

  if (record.platforms != null && !Array.isArray(record.platforms)) {
    return { ok: false, error: "invalid_platforms" };
  }
  const platforms: string[] = [];
  for (const item of Array.isArray(record.platforms) ? record.platforms : []) {
    if (typeof item !== "string") return { ok: false, error: "invalid_platforms" };
    const cleaned = cleanPlatform(item);
    if (!cleaned) return { ok: false, error: "invalid_platforms" };
    if (!platforms.includes(cleaned)) platforms.push(cleaned);
  }
  if (platforms.length > 8) return { ok: false, error: "invalid_platforms" };

  const categoryRaw = asString(record.category).trim();
  const category = categoryRaw ? normalizeCategoryToken(categoryRaw) || categoryRaw : null;
  if (category && category.length > 120) return { ok: false, error: "invalid_category" };

  const patch: AdminCampaignPatch = {
    title,
    description,
    budget: budgetRounded,
    category,
    deliverables: emptyToNull(deliverables),
    status: status as AdminCampaignStatus,
    deadline: deadlineYmd.ymd ? ymdToDeadlineIso(deadlineYmd.ymd) : null,
    starts_on: starts.ymd,
    location: emptyToNull(location),
    min_followers: minFollowers,
    platforms,
    compensation_type: compensation,
  };

  if ("cover_url" in record) {
    if (record.cover_url == null || record.cover_url === "") {
      patch.cover_url = null;
    } else if (typeof record.cover_url === "string") {
      const url = record.cover_url.trim();
      let valid = false;
      try {
        valid = new URL(url).protocol === "https:" && url.length <= 1000;
      } catch {
        valid = false;
      }
      if (!valid) return { ok: false, error: "invalid_cover_url" };
      patch.cover_url = url;
    } else {
      return { ok: false, error: "invalid_cover_url" };
    }
  }

  return { ok: true, campaignId, patch };
}
