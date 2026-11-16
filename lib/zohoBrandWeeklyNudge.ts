/**
 * Weekly brand “no open campaign” nudge via Zoho Campaigns (temp private list → send → deferred cleanup).
 * Opted-out brands are never subscribed. Zoho list unsubs → brands.reminders_email_opted_out when feasible.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getZohoCampaignsEnv,
  zohoCampaignsCredentialsReady,
  type ZohoCampaignsEnv,
} from "@/lib/zohoCampaignsConfig";
import {
  resolveZohoTopicId,
  zohoCreateCampaign,
  zohoCreateListWithContacts,
  zohoDeleteMailingList,
  zohoFetchListEmailsByStatus,
  zohoListSubscribe,
  zohoResponseOk,
  zohoSendCampaign,
} from "@/lib/zohoCampaignsClient";
import {
  enqueueZohoTempListCleanup,
  processZohoTempListCleanup,
} from "@/lib/zohoTempListCleanup";
import {
  BRAND_WEEKLY_NUDGE_SUBJECT,
  brandWeeklyNudgeContentUrl,
} from "@/lib/zohoBrandNudgeContent";

export type ZohoBrandNudgeContact = {
  email: string;
  displayName?: string;
  brandId?: string;
};

export type ZohoBrandWeeklyNudgeResult = {
  ok: boolean;
  campaignKey?: string;
  listKey?: string;
  subscribed?: number;
  localOptOutMarked?: number;
  syncErrors: string[];
  error?: string;
};

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || "").trim().toLowerCase();
}

function uniqueContacts(contacts: ZohoBrandNudgeContact[]): ZohoBrandNudgeContact[] {
  const out: ZohoBrandNudgeContact[] = [];
  const seen = new Set<string>();
  for (const c of contacts) {
    const email = normalizeEmail(c.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      displayName: String(c.displayName || "").trim() || undefined,
      brandId: c.brandId,
    });
  }
  return out;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

/** Mark brands.reminders_email_opted_out for emails that unsubscribed in Zoho. */
export async function markReminderOptOutByEmails(
  admin: SupabaseClient,
  emails: string[]
): Promise<number> {
  const unique = Array.from(new Set(emails.map(normalizeEmail).filter((e) => e.includes("@"))));
  if (unique.length === 0) return 0;
  let updated = 0;
  const { upsertNotificationPreferences } = await import("@/lib/notificationPreferences");
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data, error } = await admin
      .from("brands")
      .update({ reminders_email_opted_out: true })
      .in("contact_email", chunk)
      .select("id");
    if (error) {
      if (/reminders_email_opted_out|PGRST204|42703/i.test(error.message || "")) {
        console.warn("[zoho brand nudge] reminders_email_opted_out column missing");
        return 0;
      }
      for (const email of chunk) {
        const one = await admin
          .from("brands")
          .update({ reminders_email_opted_out: true })
          .ilike("contact_email", email)
          .select("id");
        if (!one.error) {
          updated += (one.data || []).length;
          for (const row of one.data || []) {
            await upsertNotificationPreferences(admin, "brand", String(row.id), {
              reminders_email: false,
            });
          }
        }
      }
      continue;
    }
    updated += (data || []).length;
    for (const row of data || []) {
      await upsertNotificationPreferences(admin, "brand", String(row.id), {
        reminders_email: false,
      });
    }
  }
  return updated;
}

/**
 * Pull Zoho unsubscribes from a list key and mirror to reminders_email_opted_out.
 * Best-effort — Zoho status labels vary; empty pages are tolerated.
 */
export async function pullZohoUnsubsToReminderOptOut(
  admin: SupabaseClient,
  listKey: string,
  env?: ZohoCampaignsEnv
): Promise<{ pulled: number; marked: number; error?: string }> {
  try {
    const emails = await zohoFetchListEmailsByStatus(listKey, "unsub", undefined, env);
    const marked = await markReminderOptOutByEmails(admin, emails);
    return { pulled: emails.length, marked };
  } catch (err) {
    return {
      pulled: 0,
      marked: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Create temp Zoho list with contacts, create+send one campaign with weekly nudge content.
 * Defers list delete until Sent (same pattern as announcements / category bulk).
 */
export async function sendBrandWeeklyNudgeViaZoho(opts: {
  contacts: ZohoBrandNudgeContact[];
  siteUrl?: string;
  env?: ZohoCampaignsEnv;
  admin?: SupabaseClient;
}): Promise<ZohoBrandWeeklyNudgeResult> {
  const env = opts.env || getZohoCampaignsEnv();
  const syncErrors: string[] = [];
  if (!zohoCampaignsCredentialsReady(env)) {
    return { ok: false, syncErrors, error: "zoho_credentials_missing" };
  }

  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const contacts = uniqueContacts(opts.contacts);
  if (!contacts.length) {
    return { ok: false, syncErrors, error: "no contacts" };
  }

  try {
    await processZohoTempListCleanup({ env });
  } catch (err) {
    console.warn(
      "[zoho brand nudge] prior cleanup failed",
      err instanceof Error ? err.message : err
    );
  }

  let listKey = "";
  let subscribed = 0;
  let sendQueued = false;
  let localOptOutMarked = 0;

  try {
    const stamp = Date.now().toString(36);
    const listName = `Influo tmp brand-nudge ${stamp}`.slice(0, 100);
    const created = await zohoCreateListWithContacts(
      {
        listName,
        emails: contacts.map((c) => c.email),
        description: "Temporary weekly brand no-campaign nudge recipients. Safe to delete.",
      },
      env
    );
    listKey = created.listKey;
    if (created.ignoredEmails.length > 0) {
      syncErrors.push(
        `ignored_contacts: ${created.ignoredEmails.slice(0, 5).join(",")}${
          created.ignoredEmails.length > 5 ? "…" : ""
        }`
      );
    }

    const topicId = await resolveZohoTopicId(env);
    const toSubscribe = contacts.filter((c) => !created.ignoredEmails.includes(c.email));
    const subResults = await mapPool(toSubscribe, 4, async (c) => {
      try {
        const raw = await zohoListSubscribe(
          listKey,
          c.email,
          {
            firstName: c.displayName?.slice(0, 80),
            source: "influo-brand-weekly-nudge",
            topicId,
          },
          env
        );
        const msg = JSON.stringify(raw).toLowerCase();
        if (msg.includes('"code":"2005"') || msg.includes("group email")) {
          return { ok: false as const, error: `ignored group/role email: ${c.email}` };
        }
        if (zohoResponseOk(raw) || msg.includes("already") || msg.includes("subscribed")) {
          return { ok: true as const };
        }
        return { ok: false as const, error: msg.slice(0, 200) };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    });
    for (const r of subResults) {
      if (r.ok) subscribed += 1;
      else if (r.error) syncErrors.push(`subscribe: ${r.error}`);
    }

    if (subscribed === 0) {
      throw new Error(
        `no contacts on temporary Zoho list (requested=${contacts.length}, ignored=${created.ignoredEmails.length})`
      );
    }

    // Best-effort: if anyone already unsubscribed on this list before send, mirror locally.
    if (opts.admin) {
      const pull = await pullZohoUnsubsToReminderOptOut(opts.admin, listKey, env);
      localOptOutMarked += pull.marked;
      if (pull.error) syncErrors.push(`pull unsub: ${pull.error}`);
    }

    const { campaignKey } = await zohoCreateCampaign(
      {
        name: `Influo brand weekly nudge (${subscribed}) ${stamp}`.slice(0, 180),
        subject: BRAND_WEEKLY_NUDGE_SUBJECT,
        listKey,
        contentUrl: brandWeeklyNudgeContentUrl(siteUrl),
      },
      env
    );

    const sendRaw = await zohoSendCampaign(campaignKey, env);
    if (!zohoResponseOk(sendRaw)) {
      const msg = JSON.stringify(sendRaw).slice(0, 300);
      const lower = msg.toLowerCase();
      if (!lower.includes("inprogress") && !lower.includes("success")) {
        throw new Error(`sendcampaign unexpected: ${msg}`);
      }
    }
    sendQueued = true;

    enqueueZohoTempListCleanup({
      listKey,
      campaignKey,
      expectedEmails: subscribed,
      createdAt: new Date().toISOString(),
      audience: "brands",
    });
    syncErrors.push("temp list delete deferred until campaign Sent");

    return {
      ok: true,
      campaignKey,
      listKey,
      subscribed,
      localOptOutMarked,
      syncErrors: syncErrors.slice(0, 10),
    };
  } catch (err) {
    if (listKey && !sendQueued) {
      try {
        await zohoDeleteMailingList(listKey, { deleteContacts: false }, env);
      } catch (delErr) {
        syncErrors.push(
          `temp list cleanup failed: ${delErr instanceof Error ? delErr.message : String(delErr)}`
        );
      }
    }
    return {
      ok: false,
      listKey: listKey || undefined,
      subscribed,
      localOptOutMarked,
      syncErrors: syncErrors.slice(0, 10),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
