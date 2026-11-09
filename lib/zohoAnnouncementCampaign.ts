/**
 * Send a site announcement as a Zoho Campaigns campaign.
 * - Bulk (all creators / all brands): sync permanent list, then send.
 * - Selected recipients: temporary private list → subscribe → send → delete list.
 */

import {
  getZohoCampaignsEnv,
  zohoListKeyForAudience,
  type ZohoAudience,
  type ZohoCampaignsEnv,
} from "@/lib/zohoCampaignsConfig";
import {
  zohoCreateCampaign,
  zohoCreateListWithContacts,
  zohoDeleteMailingList,
  zohoListSubscribe,
  zohoResponseOk,
  zohoSendCampaign,
} from "@/lib/zohoCampaignsClient";
import { syncAudienceToZoho } from "@/lib/zohoCampaignsSync";
import {
  ANNOUNCEMENT_EMAIL_SUBJECT,
  announcementContentUrl,
} from "@/lib/zohoAnnouncementContent";

export {
  ANNOUNCEMENT_EMAIL_SUBJECT,
  announcementContentUrl,
  announcementEmailHtml,
  dashboardPathForAudience,
} from "@/lib/zohoAnnouncementContent";

export type ZohoAnnouncementSendResult = {
  ok: boolean;
  campaignKey?: string;
  listKey?: string;
  listDeleted?: boolean;
  subscribed?: number;
  skippedOptOut?: number;
  syncErrors: string[];
  error?: string;
};

export type ZohoSelectedContact = {
  email: string;
  displayName?: string;
};

function normalizeEmail(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
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

function uniqueContacts(contacts: ZohoSelectedContact[]): ZohoSelectedContact[] {
  const out: ZohoSelectedContact[] = [];
  const seen = new Set<string>();
  for (const c of contacts) {
    const email = normalizeEmail(c.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      displayName: String(c.displayName || "").trim() || undefined,
    });
  }
  return out;
}

async function sendCampaignToListKey(
  opts: {
    audience: ZohoAudience;
    listKey: string;
    namePrefix: string;
    siteUrl: string;
  },
  env: ZohoCampaignsEnv
): Promise<{ campaignKey: string }> {
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const name = `${opts.namePrefix} ${stamp}`.slice(0, 180);
  const { campaignKey } = await zohoCreateCampaign(
    {
      name,
      subject: ANNOUNCEMENT_EMAIL_SUBJECT,
      listKey: opts.listKey,
      contentUrl: announcementContentUrl(opts.audience, opts.siteUrl),
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
  return { campaignKey };
}

/**
 * Sync permanent list, create campaign from public content URL, send immediately.
 * Free Zoho plan has no scheduling — send is immediate.
 */
export async function sendAnnouncementViaZoho(opts: {
  audience: ZohoAudience;
  title: string;
  siteUrl?: string;
}): Promise<ZohoAnnouncementSendResult> {
  const env = getZohoCampaignsEnv();
  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const listKey = zohoListKeyForAudience(opts.audience, env);

  const sync = await syncAudienceToZoho(opts.audience, env);
  const syncErrors = sync.errors.slice(0, 10);

  try {
    const { campaignKey } = await sendCampaignToListKey(
      {
        audience: opts.audience,
        listKey,
        namePrefix: `Influo announcement (${opts.audience})`,
        siteUrl,
      },
      env
    );
    return { ok: true, campaignKey, listKey, syncErrors };
  } catch (err) {
    return {
      ok: false,
      listKey,
      syncErrors,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Selected influencers/brands: create a temporary private Zoho list with only
 * those contacts, send one campaign, then delete the temp list (contacts stay
 * in the org so permanent lists / free-plan caps are not disrupted).
 *
 * Caller must already filter opted-out / empty emails. This still de-dupes.
 */
export async function sendAnnouncementViaZohoToSelected(opts: {
  audience: ZohoAudience;
  contacts: ZohoSelectedContact[];
  title: string;
  siteUrl?: string;
}): Promise<ZohoAnnouncementSendResult> {
  const env = getZohoCampaignsEnv();
  const siteUrl = (opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const contacts = uniqueContacts(opts.contacts);
  const syncErrors: string[] = [];

  if (contacts.length === 0) {
    return {
      ok: false,
      syncErrors,
      error: "no selected contacts to send via Zoho",
    };
  }

  let listKey = "";
  let listDeleted = false;
  let subscribed = 0;

  try {
    const stamp = Date.now().toString(36);
    const listName = `Influo tmp ${opts.audience} ${stamp}`.slice(0, 100);
    const created = await zohoCreateListWithContacts(
      {
        listName,
        emails: contacts.map((c) => c.email),
        description: `Temporary selected-recipient announcement (${opts.audience}). Safe to delete.`,
      },
      env
    );
    listKey = created.listKey;
    subscribed = created.acceptedEmails.length;
    if (created.ignoredEmails.length > 0) {
      syncErrors.push(
        `ignored_contacts: ${created.ignoredEmails.slice(0, 5).join(",")}${
          created.ignoredEmails.length > 5 ? "…" : ""
        }`
      );
    }

    const handled = new Set(created.requestedEmails);
    const remaining = contacts.filter((c) => !handled.has(c.email));
    if (remaining.length > 0) {
      const subResults = await mapPool(remaining, 4, async (c) => {
        try {
          const raw = await zohoListSubscribe(
            listKey,
            c.email,
            {
              firstName: c.displayName?.slice(0, 80),
              source: "influo-selected-announcement",
            },
            env
          );
          const msg = JSON.stringify(raw).toLowerCase();
          // Zoho 2005 = group/role address (e.g. support@) — treat as hard skip.
          if (msg.includes('"code":"2005"') || msg.includes("group email")) {
            return { ok: false as const, error: `ignored group/role email: ${c.email}` };
          }
          if (zohoResponseOk(raw) || msg.includes("already") || msg.includes("subscribed")) {
            return { ok: true as const };
          }
          return { ok: false as const, error: msg.slice(0, 200) };
        } catch (err) {
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      for (const r of subResults) {
        if (r.ok) subscribed += 1;
        else if (r.error) syncErrors.push(`subscribe: ${r.error}`);
      }
    }

    if (subscribed === 0) {
      throw new Error(
        `no contacts on temporary Zoho list (requested=${contacts.length}, ignored=${created.ignoredEmails.length})`
      );
    }

    const { campaignKey } = await sendCampaignToListKey(
      {
        audience: opts.audience,
        listKey,
        namePrefix: `Influo selected (${opts.audience}, ${subscribed})`,
        siteUrl,
      },
      env
    );

    try {
      const delRaw = await zohoDeleteMailingList(listKey, { deleteContacts: false }, env);
      listDeleted = zohoResponseOk(delRaw) || JSON.stringify(delRaw).toLowerCase().includes("deleted");
      if (!listDeleted) {
        syncErrors.push(`temp list delete soft-fail: ${JSON.stringify(delRaw).slice(0, 200)}`);
      }
    } catch (delErr) {
      syncErrors.push(
        `temp list delete failed: ${delErr instanceof Error ? delErr.message : String(delErr)}`
      );
    }

    return {
      ok: true,
      campaignKey,
      listKey,
      listDeleted,
      subscribed,
      syncErrors: syncErrors.slice(0, 10),
    };
  } catch (err) {
    if (listKey) {
      try {
        await zohoDeleteMailingList(listKey, { deleteContacts: false }, env);
        listDeleted = true;
      } catch (delErr) {
        syncErrors.push(
          `temp list cleanup failed: ${
            delErr instanceof Error ? delErr.message : String(delErr)
          }`
        );
      }
    }
    return {
      ok: false,
      listKey: listKey || undefined,
      listDeleted,
      subscribed,
      syncErrors: syncErrors.slice(0, 10),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
