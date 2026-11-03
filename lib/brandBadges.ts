/**
 * Brand badges (new_brand, frequent_partner). Computed once for every brand and
 * cached in-process for 10 minutes. Test brands never get them.
 */
import { supabaseService } from "@/lib/apiAuth";
import { isTestBrandId } from "@/lib/testBrandIds";

export type BrandBadgeType = "new_brand" | "frequent_partner";
/** Criteria (also described in the guides / FAQ). */
export const NEW_BRAND_MAX_DAYS = 30;
export const FREQUENT_PARTNER_MIN_COLLABS = 3;
const TEST_BRAND_EMAILS = new Set(["thanosd1979@gmail.com"]);
const TTL_MS = 10 * 60_000;

let cache: { at: number; value: Map<string, BrandBadgeType[]> } | null = null;
let inflight: Promise<Map<string, BrandBadgeType[]>> | null = null;

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

async function compute(): Promise<Map<string, BrandBadgeType[]>> {
  const admin = supabaseService();
  const [brands, proposals, campaigns, apps] = await Promise.all([
    allRows<{ id: string; contact_email: string | null; created_at: string | null }>((a, b) =>
      admin.from("brands").select("id, contact_email, created_at").order("id").range(a, b)
    ),
    allRows<{ id: string; brand_id: string | null; brand_email: string | null }>((a, b) =>
      admin.from("proposals").select("id, brand_id, brand_email").eq("status", "completed").order("id").range(a, b)
    ),
    allRows<{ id: string; brand_id: string | null }>((a, b) =>
      admin.from("brand_campaigns").select("id, brand_id").order("id").range(a, b)
    ),
    allRows<{ id: string; campaign_id: string | null }>((a, b) =>
      admin.from("campaign_applications").select("id, campaign_id").eq("status", "accepted").order("id").range(a, b)
    ),
  ]);
  const byEmail = new Map<string, string>();
  for (const b of brands) if (b.contact_email) byEmail.set(b.contact_email.trim().toLowerCase(), String(b.id));
  const collabs = new Map<string, number>();
  const bump = (id: string | null | undefined) => {
    if (id) collabs.set(id, (collabs.get(id) || 0) + 1);
  };
  // Completed direct collaborations (proposals) + accepted creators on campaigns.
  for (const p of proposals) bump(p.brand_id || byEmail.get((p.brand_email || "").trim().toLowerCase()));
  const campaignBrand = new Map(campaigns.map((c) => [String(c.id), c.brand_id]));
  for (const a of apps) bump(campaignBrand.get(String(a.campaign_id)));
  const now = Date.now();
  const map = new Map<string, BrandBadgeType[]>();
  for (const b of brands) {
    const id = String(b.id);
    if (isTestBrandId(id) || TEST_BRAND_EMAILS.has((b.contact_email || "").trim().toLowerCase())) continue;
    const out: BrandBadgeType[] = [];
    if ((collabs.get(id) || 0) >= FREQUENT_PARTNER_MIN_COLLABS) out.push("frequent_partner");
    const created = b.created_at ? Date.parse(b.created_at) : NaN;
    if (Number.isFinite(created) && now - created <= NEW_BRAND_MAX_DAYS * 86_400_000) out.push("new_brand");
    if (out.length) map.set(id, out);
  }
  return map;
}

/** brand id → badges (cached). Never throws. */
export async function getBrandBadgeMap(): Promise<Map<string, BrandBadgeType[]>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = compute()
    .then((value) => {
      cache = { at: Date.now(), value };
      return value;
    })
    .catch((err) => {
      console.error("getBrandBadgeMap", err);
      return cache?.value || new Map<string, BrandBadgeType[]>();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
