/**
 * Bulk category/related campaign emails via Zoho Campaigns (temp list + deferred cleanup),
 * same pattern as selected announcements. Caller filters opt-outs / empty emails.
 */

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
  zohoListSubscribe,
  zohoResponseOk,
  zohoSendCampaign,
} from "@/lib/zohoCampaignsClient";
import {
  enqueueZohoTempListCleanup,
  processZohoTempListCleanup,
} from "@/lib/zohoTempListCleanup";
import {
  campaignCategoryContentUrl,
  campaignCategoryEmailSubject,
} from "@/lib/zohoCampaignCategoryContent";

export type ZohoCampaignCategoryContact = { email: string; displayName?: string };

export type ZohoCampaignCategorySendResult = {
  ok: boolean;
  campaignKey?: string;
  listKey?: string;
  subscribed?: number;
  syncErrors: string[];
  error?: string;
};

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || "").trim().toLowerCase();
}

function uniqueContacts(contacts: ZohoCampaignCategoryContact[]): ZohoCampaignCategoryContact[] {
  const out: ZohoCampaignCategoryContact[] = [];
  const seen = new Set<string>();
  for (const c of contacts) {
    const email = normalizeEmail(c.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, displayName: String(c.displayName || "").trim() || undefined });
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

export async function sendCampaignCategoryViaZoho(opts: {
  campaignId: string;
  title: string;
  brandName: string;
  contacts: ZohoCampaignCategoryContact[];
  siteUrl?: string;
  env?: ZohoCampaignsEnv;
}): Promise<ZohoCampaignCategorySendResult> {
  const env = opts.env || getZohoCampaignsEnv();
  const syncErrors: string[] = [];
  if (!zohoCampaignsCredentialsReady(env)) {
    return { ok: false, syncErrors, error: "zoho_credentials_missing" };
  }

  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  const contacts = uniqueContacts(opts.contacts);
  if (!contacts.length) {
    return { ok: false, syncErrors, error: "no contacts" };
  }

  try {
    await processZohoTempListCleanup({ env });
  } catch (err) {
    console.warn("[zoho campaign category] prior cleanup failed", err instanceof Error ? err.message : err);
  }

  let listKey = "";
  let subscribed = 0;
  let sendQueued = false;

  try {
    const stamp = Date.now().toString(36);
    const listName = `Influo tmp campaign ${stamp}`.slice(0, 100);
    const created = await zohoCreateListWithContacts(
      {
        listName,
        emails: contacts.map((c) => c.email),
        description: `Temporary campaign category recipients (${opts.campaignId}). Safe to delete.`,
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
            source: "influo-campaign-category",
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

    const subject = campaignCategoryEmailSubject(opts.title);
    const contentUrl = campaignCategoryContentUrl(opts.campaignId, siteUrl);
    const { campaignKey } = await zohoCreateCampaign(
      {
        name: `Influo campaign (${subscribed}) ${stamp}`.slice(0, 180),
        subject,
        listKey,
        contentUrl,
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
      audience: "creators",
    });
    syncErrors.push("temp list delete deferred until campaign Sent");

    return {
      ok: true,
      campaignKey,
      listKey,
      subscribed,
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
      syncErrors: syncErrors.slice(0, 10),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
