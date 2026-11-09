/**
 * Sync Influo announcement audiences ↔ Zoho Campaigns mailing lists.
 * Opt-out is authoritative both ways when Zoho announcements are enabled.
 */

import { supabaseService } from "@/lib/apiAuth";
import {
  getZohoCampaignsEnv,
  zohoListKeyForAudience,
  type ZohoAudience,
  type ZohoCampaignsEnv,
} from "@/lib/zohoCampaignsConfig";
import {
  zohoFetchListEmailsByStatus,
  zohoListSubscribe,
  zohoListUnsubscribe,
  zohoResponseOk,
} from "@/lib/zohoCampaignsClient";

const OPT_OUT_COL = "announcements_email_opted_out";

export type AnnouncementContact = {
  email: string;
  displayName: string;
  optedOut: boolean;
};

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function isMissingOptOutColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code || ""} ${error.message || ""}`;
  return /announcements_email_opted_out|42703|PGRST204/i.test(msg);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function loadCreatorAnnouncementContacts(): Promise<AnnouncementContact[]> {
  const admin = supabaseService();
  const withOptOut = await admin
    .from("influencers")
    .select(`contact_email, display_name, ${OPT_OUT_COL}`)
    .eq("approved", true)
    .not("contact_email", "is", null);

  if (withOptOut.error && isMissingOptOutColumn(withOptOut.error)) {
    const fallback = await admin
      .from("influencers")
      .select("contact_email, display_name")
      .eq("approved", true)
      .not("contact_email", "is", null);
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data || [])
      .map((row) => ({
        email: normalizeEmail(row.contact_email as string | null),
        displayName: String(row.display_name || "").trim(),
        optedOut: false,
      }))
      .filter((c) => c.email.length > 0);
  }
  if (withOptOut.error) throw new Error(withOptOut.error.message);

  return (withOptOut.data || [])
    .map((row) => ({
      email: normalizeEmail(row.contact_email as string | null),
      displayName: String(row.display_name || "").trim(),
      optedOut: Boolean((row as Record<string, unknown>)[OPT_OUT_COL]),
    }))
    .filter((c) => c.email.length > 0);
}

export async function loadBrandAnnouncementContacts(): Promise<AnnouncementContact[]> {
  const admin = supabaseService();
  const withOptOut = await admin
    .from("brands")
    .select(`contact_email, brand_name, ${OPT_OUT_COL}`)
    .not("contact_email", "is", null);

  if (withOptOut.error && isMissingOptOutColumn(withOptOut.error)) {
    const fallback = await admin
      .from("brands")
      .select("contact_email, brand_name")
      .not("contact_email", "is", null);
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data || [])
      .map((row) => ({
        email: normalizeEmail(row.contact_email as string | null),
        displayName: String(row.brand_name || "").trim(),
        optedOut: false,
      }))
      .filter((c) => c.email.length > 0);
  }
  if (withOptOut.error) throw new Error(withOptOut.error.message);

  return (withOptOut.data || [])
    .map((row) => ({
      email: normalizeEmail(row.contact_email as string | null),
      displayName: String(row.brand_name || "").trim(),
      optedOut: Boolean((row as Record<string, unknown>)[OPT_OUT_COL]),
    }))
    .filter((c) => c.email.length > 0);
}

export async function markAnnouncementOptOutByEmails(
  audience: ZohoAudience,
  emails: string[]
): Promise<number> {
  const unique = Array.from(
    new Set(emails.map(normalizeEmail).filter((e) => e.length > 0))
  );
  if (unique.length === 0) return 0;

  const admin = supabaseService();
  const table = audience === "creators" ? "influencers" : "brands";
  let updated = 0;
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from(table)
      .update({ [OPT_OUT_COL]: true })
      .in("contact_email", chunk)
      .select("id");
    if (error) {
      if (isMissingOptOutColumn(error)) {
        console.warn("[zoho sync] opt-out column missing; skip local mark");
        return 0;
      }
      // contact_email may be mixed-case — try ilike one-by-one for small leftovers
      console.warn("[zoho sync] bulk opt-out update:", error.message);
      for (const email of chunk) {
        const one = await admin
          .from(table)
          .update({ [OPT_OUT_COL]: true })
          .ilike("contact_email", email)
          .select("id");
        if (!one.error) updated += (one.data || []).length;
      }
      continue;
    }
    updated += (data || []).length;
  }
  return updated;
}

export type ZohoSyncResult = {
  audience: ZohoAudience;
  subscribed: number;
  unsubscribed: number;
  pulledUnsubs: number;
  localOptOutMarked: number;
  errors: string[];
};

/**
 * 1) Pull Zoho unsubscribes → mark local opted_out
 * 2) Push local opted-in → listsubscribe
 * 3) Push local opted-out → listunsubscribe
 */
export async function syncAudienceToZoho(
  audience: ZohoAudience,
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<ZohoSyncResult> {
  const listKey = zohoListKeyForAudience(audience, env);
  const result: ZohoSyncResult = {
    audience,
    subscribed: 0,
    unsubscribed: 0,
    pulledUnsubs: 0,
    localOptOutMarked: 0,
    errors: [],
  };

  const contacts =
    audience === "creators"
      ? await loadCreatorAnnouncementContacts()
      : await loadBrandAnnouncementContacts();

  // Zoho → local (unsubscribe both ways)
  try {
    const zohoUnsubs = await zohoFetchListEmailsByStatus(listKey, "unsub", undefined, env);
    result.pulledUnsubs = zohoUnsubs.length;
    if (zohoUnsubs.length > 0) {
      result.localOptOutMarked = await markAnnouncementOptOutByEmails(audience, zohoUnsubs);
      const unsubSet = new Set(zohoUnsubs.map(normalizeEmail));
      for (const c of contacts) {
        if (unsubSet.has(c.email)) c.optedOut = true;
      }
    }
  } catch (err) {
    result.errors.push(
      `pull unsub: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const toSubscribe = contacts.filter((c) => !c.optedOut);
  const toUnsubscribe = contacts.filter((c) => c.optedOut);

  const subResults = await mapPool(toSubscribe, 4, async (c) => {
    try {
      const raw = await zohoListSubscribe(
        listKey,
        c.email,
        { firstName: c.displayName.slice(0, 80) || undefined, source: "influo-sync" },
        env
      );
      // Zoho often returns non-ok codes for "already subscribed" — treat as soft ok
      const msg = JSON.stringify(raw).toLowerCase();
      if (zohoResponseOk(raw) || msg.includes("already") || msg.includes("subscribed")) {
        return { ok: true as const };
      }
      return { ok: false as const, error: msg.slice(0, 200) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
  for (const r of subResults) {
    if (r.ok) result.subscribed += 1;
    else if (r.error) result.errors.push(`subscribe: ${r.error}`);
  }

  const unsubResults = await mapPool(toUnsubscribe, 4, async (c) => {
    try {
      const raw = await zohoListUnsubscribe(listKey, c.email, env);
      const msg = JSON.stringify(raw).toLowerCase();
      if (zohoResponseOk(raw) || msg.includes("unsubscribed") || msg.includes("success")) {
        return { ok: true as const };
      }
      return { ok: false as const, error: msg.slice(0, 200) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
  for (const r of unsubResults) {
    if (r.ok) result.unsubscribed += 1;
    else if (r.error) result.errors.push(`unsubscribe: ${r.error}`);
  }

  // Cap error noise
  if (result.errors.length > 20) {
    result.errors = [
      ...result.errors.slice(0, 20),
      `…and ${result.errors.length - 20} more`,
    ];
  }

  return result;
}

export async function syncAllAnnouncementAudiences(
  env: ZohoCampaignsEnv = getZohoCampaignsEnv()
): Promise<{ creators: ZohoSyncResult; brands: ZohoSyncResult }> {
  const creators = await syncAudienceToZoho("creators", env);
  const brands = await syncAudienceToZoho("brands", env);
  return { creators, brands };
}

/** Emails allowed to receive announcement mail when Zoho path is active. */
export async function loadOptedInAnnouncementEmails(
  audience: ZohoAudience
): Promise<string[]> {
  const contacts =
    audience === "creators"
      ? await loadCreatorAnnouncementContacts()
      : await loadBrandAnnouncementContacts();
  return contacts.filter((c) => !c.optedOut).map((c) => c.email);
}
