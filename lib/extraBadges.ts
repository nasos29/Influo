/**
 * Behaviour badges (fast_responder, top_rated, active, complete_profile).
 * Computed once for every approved creator and cached in-process for 10 minutes,
 * so page requests only do a Map lookup. Test accounts never get them.
 */
import { supabaseService } from "@/lib/apiAuth";
import { selectApprovedInfluencers } from "@/lib/loadPublicInfluencers";
import { packagesForViewer } from "@/lib/servicePackages";
import { listedPriceMin } from "@/lib/parsePrice";
import { parseStoredCategories } from "@/lib/categories";
import { TEST_CREATOR_IDS } from "@/lib/testBrandIds";
import type { ExtraBadgeType } from "@/lib/badges";

const TTL_MS = 10 * 60_000;
/** Criteria (also described in the guides / FAQ). */
export const FAST_RESPONSE_MAX_HOURS = 4;
export const FAST_RESPONSE_MIN_CONVERSATIONS = 3;
export const TOP_RATED_MIN_AVG = 4.8;
export const TOP_RATED_MIN_REVIEWS = 3;
export const ACTIVE_MAX_DAYS = 7;

let cache: { at: number; value: Map<string, ExtraBadgeType[]> } | null = null;
let inflight: Promise<Map<string, ExtraBadgeType[]>> | null = null;

const COLUMNS = [
  "id", "avatar_url", "videos", "hidden_videos", "category", "min_rate", "service_packages",
  "rate_card", "accounts", "avg_response_time", "avg_rating", "total_reviews", "birth_date",
] as const;

async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

function hasPortfolio(row: Record<string, unknown>): boolean {
  const hidden = new Set(Array.isArray(row.hidden_videos) ? row.hidden_videos.map(String) : []);
  return (Array.isArray(row.videos) ? row.videos : []).some((v) => typeof v === "string" && v.trim() && !hidden.has(v));
}

function hasPrices(row: Record<string, unknown>): boolean {
  try {
    if (packagesForViewer(row.service_packages, row.rate_card, row.accounts).length > 0) return true;
  } catch {
    /* fall through */
  }
  return (listedPriceMin(row.min_rate as string | undefined) ?? 0) > 0;
}

async function compute(): Promise<Map<string, ExtraBadgeType[]>> {
  const admin = supabaseService();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { rows: part } = await selectApprovedInfluencers(COLUMNS, (cols) =>
      admin.from("influencers").select(cols).eq("approved", true).order("id", { ascending: true }).range(from, from + 999)
    );
    rows.push(...part);
    if (part.length < 1000) break;
  }
  const [presence, convs] = await Promise.all([
    allRows<{ influencer_id: string; last_seen: string | null }>((a, b) =>
      admin.from("influencer_presence").select("influencer_id, last_seen").order("influencer_id").range(a, b)
    ),
    allRows<{ influencer_id: string }>((a, b) =>
      admin.from("conversations").select("influencer_id").order("id").range(a, b)
    ),
  ]);
  const lastSeen = new Map(presence.map((p) => [String(p.influencer_id), p.last_seen ? Date.parse(p.last_seen) : NaN]));
  const convCount = new Map<string, number>();
  for (const c of convs) {
    const k = String(c.influencer_id);
    convCount.set(k, (convCount.get(k) || 0) + 1);
  }
  const now = Date.now();
  const map = new Map<string, ExtraBadgeType[]>();
  for (const row of rows) {
    const id = String(row.id ?? "");
    if (!id || TEST_CREATOR_IDS.has(id.toLowerCase())) continue;
    const out: ExtraBadgeType[] = [];
    const avg = Number(row.avg_rating) || 0;
    const reviews = Number(row.total_reviews) || 0;
    if (reviews >= TOP_RATED_MIN_REVIEWS && avg >= TOP_RATED_MIN_AVG) out.push("top_rated");
    const rt = row.avg_response_time == null ? NaN : Number(row.avg_response_time);
    if (Number.isFinite(rt) && rt < FAST_RESPONSE_MAX_HOURS && (convCount.get(id) || 0) >= FAST_RESPONSE_MIN_CONVERSATIONS) {
      out.push("fast_responder");
    }
    const seen = lastSeen.get(id);
    if (seen != null && Number.isFinite(seen) && now - seen <= ACTIVE_MAX_DAYS * 86_400_000) out.push("active");
    const hasPhoto = typeof row.avatar_url === "string" && row.avatar_url.trim() !== "";
    const hasBirthDate = typeof row.birth_date === "string" && row.birth_date.trim() !== "";
    if (hasPhoto && hasBirthDate && hasPortfolio(row) && hasPrices(row) && parseStoredCategories(row.category).length > 0) {
      out.push("complete_profile");
    }
    if (out.length) map.set(id, out);
  }
  return map;
}

/** id → behaviour badges for every approved creator (cached). Never throws. */
export async function getExtraBadgeMap(): Promise<Map<string, ExtraBadgeType[]>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = compute()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((err) => {
      console.error("getExtraBadgeMap", err);
      return cache?.value || new Map<string, ExtraBadgeType[]>();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function extraBadgesFor(id: string): Promise<ExtraBadgeType[]> {
  return (await getExtraBadgeMap()).get(String(id)) || [];
}
