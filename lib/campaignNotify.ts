import { supabaseService } from "@/lib/apiAuth";
import {
  isUuid,
  outreachBudgetLeft,
  OUTREACH_BATCH_SIZE,
  OUTREACH_BUDGET_MS,
  OUTREACH_GAP_MS,
  rankCampaignAlerts,
  type AlertCandidate,
  type RankedAlert,
} from "@/lib/campaignAlert";
import { sendPushToInfluencer } from "@/lib/push";
import { escapeHtml, sendTransactional } from "@/lib/transactionalEmail";

const SEND_TIMEOUT_MS = 8000;
const PAGE = 1000;
const MAX_PAGES = 50;
const INSERT_BATCH = 80;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      }
    );
  });
}

type Contact = { id: string; name: string; email: string | null; category: string | null; authUserId: string };

const IN_CHUNK = 100;

async function contactsFor(ids: string[]): Promise<Contact[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Contact[] = [];
  for (let index = 0; index < unique.length; index += IN_CHUNK) {
    out.push(...(await contactsChunk(unique.slice(index, index + IN_CHUNK))));
  }
  return out;
}

async function contactsChunk(ids: string[]): Promise<Contact[]> {
  const admin = supabaseService();
  const { data: people } = await admin
    .from("influencers")
    .select("id, display_name, category, contact_email")
    .in("id", ids);
  const { data: priv } = await admin
    .from("influencer_private")
    .select("influencer_id, contact_email")
    .in("influencer_id", ids);
  const emailById = new Map<string, string>();
  for (const row of priv || []) {
    if (row.contact_email) emailById.set(String(row.influencer_id), String(row.contact_email));
  }
  return (people || []).map((row) => ({
    id: String(row.id),
    name: row.display_name || "Influencer",
    email: emailById.get(String(row.id)) || (row.contact_email ? String(row.contact_email) : null),
    category: row.category || null,
    authUserId: "",
  }));
}

function campaignLink(id: string): string {
  const host = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.influo.gr").replace(/\/$/, "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return `${host}/campaigns`;
  }
  return `${host}/campaigns/${id}`;
}

async function loadApprovedCreators(): Promise<AlertCandidate[]> {
  const admin = supabaseService();
  const rows: AlertCandidate[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await admin
      .from("influencers")
      .select("id, category, approved, availability_status, auth_user_id, location, accounts")
      .eq("approved", true)
      .range(from, from + PAGE - 1);
    if (error || !data?.length) {
      if (error) console.error("[campaignNotify] creators", error);
      break;
    }
    rows.push(...(data as AlertCandidate[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function alreadyNotified(campaignId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!isUuid(campaignId)) return ids;
  const admin = supabaseService();
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await admin
      .from("announcements")
      .select("target_influencer_id")
      .eq("target_type", "specific")
      .ilike("body", `%${campaignId}%`)
      .range(from, from + PAGE - 1);
    if (error || !data?.length) {
      if (error) console.error("[campaignNotify] existing", error);
      break;
    }
    for (const row of data) {
      if (row.target_influencer_id) ids.add(String(row.target_influencer_id));
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

function announcementBody(brandName: string, title: string, campaignId: string): string {
  return `${brandName} δημοσίευσε «${title}».\n${campaignLink(campaignId)}\ncampaign-id:${campaignId}`;
}

export async function notifyMatchingOpenCampaign(opts: {
  campaignId: string;
  title: string;
  category: string | null;
  brandName: string;
  location?: string | null;
  minFollowers?: number | null;
  platforms?: string[] | null;
}): Promise<{ emailed: number; pushed: number; inApp: number }> {
  const started = Date.now();
  const ranked = rankCampaignAlerts(await loadApprovedCreators(), {
    category: opts.category,
    location: opts.location,
    minFollowers: opts.minFollowers,
    platforms: opts.platforms,
  });
  if (!ranked.length) return { emailed: 0, pushed: 0, inApp: 0 };
  const already = await alreadyNotified(opts.campaignId);
  const fresh = ranked.filter((row) => !already.has(row.authUserId));
  const inApp = await insertCampaignAnnouncements(
    fresh.map((row) => row.authUserId),
    opts.title,
    announcementBody(opts.brandName, opts.title, opts.campaignId)
  );
  if (inApp < fresh.length) {
    console.warn("[campaignNotify] in-app insert incomplete", inApp, "of", fresh.length);
    return { emailed: 0, pushed: 0, inApp };
  }
  const outreach = await deliverStrongMatches(fresh.filter((row) => row.strong), opts, started);
  return { emailed: outreach.emailed, pushed: outreach.pushed, inApp };
}

async function deliverStrongMatches(
  targets: RankedAlert[],
  opts: { campaignId: string; title: string; brandName: string },
  started: number
): Promise<{ emailed: number; pushed: number }> {
  if (!targets.length) return { emailed: 0, pushed: 0 };
  const order = new Map(targets.map((row, index) => [row.id, index]));
  const people = await contactsFor(targets.map((row) => row.id));
  people.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  let emailed = 0;
  let pushed = 0;
  for (let index = 0; index < people.length; index += OUTREACH_BATCH_SIZE) {
    if (!outreachBudgetLeft(started, Date.now(), OUTREACH_BUDGET_MS)) {
      console.warn("[campaignNotify] outreach budget", index, "of", people.length);
      break;
    }
    const slice = people.slice(index, index + OUTREACH_BATCH_SIZE);
    const counts = await Promise.all(slice.map((person) => sendCampaignOutreach(person, opts)));
    for (const count of counts) {
      emailed += count.emailed;
      pushed += count.pushed;
    }
    const more = index + OUTREACH_BATCH_SIZE < people.length;
    if (more && outreachBudgetLeft(started, Date.now(), OUTREACH_BUDGET_MS)) {
      await sleep(OUTREACH_GAP_MS);
    }
  }
  return { emailed, pushed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendCampaignOutreach(
  person: Contact,
  opts: { campaignId: string; title: string; brandName: string }
): Promise<{ emailed: number; pushed: number }> {
  const link = campaignLink(opts.campaignId);
  const mail = await withTimeout(
    sendTransactional(
      person.email,
      `Νέα καμπάνια: ${opts.title}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
        <p>Γεια σου ${escapeHtml(person.name)},</p>
        <p>Η επιχείρηση <strong>${escapeHtml(opts.brandName)}</strong> δημοσίευσε την καμπάνια <strong>${escapeHtml(opts.title)}</strong> σε κατηγορία που ταιριάζει με το προφίλ σου.</p>
        <p><a href="${link}">Δες την καμπάνια και κάνε αίτηση</a></p>
      </div>`
    ),
    SEND_TIMEOUT_MS
  );
  const push = await withTimeout(
    sendPushToInfluencer(person.id, {
      title: "Νέα καμπάνια",
      body: `${opts.brandName}: ${opts.title}`.slice(0, 120),
      url: `/campaigns/${opts.campaignId}`,
      tag: `campaign-open-${opts.campaignId}`,
    }),
    SEND_TIMEOUT_MS
  );
  return { emailed: mail?.ok ? 1 : 0, pushed: push?.sent || 0 };
}

async function insertCampaignAnnouncements(authUserIds: string[], title: string, body: string): Promise<number> {
  const unique = [...new Set(authUserIds.filter(Boolean))];
  if (!unique.length) return 0;
  const admin = supabaseService();
  const announcementTitle = `Νέα καμπάνια: ${title}`.slice(0, 180);
  let inserted = 0;
  for (let index = 0; index < unique.length; index += INSERT_BATCH) {
    const slice = unique.slice(index, index + INSERT_BATCH);
    const { data, error } = await admin
      .from("announcements")
      .insert(slice.map((id) => ({
        title: announcementTitle,
        body,
        target_type: "specific",
        target_influencer_id: id,
      })))
      .select("id");
    if (error) {
      console.error("[campaignNotify] in-app", error);
      break;
    }
    inserted += data?.length || 0;
  }
  return inserted;
}

export async function notifyApplicationStatus(opts: {
  influencerId: string;
  campaignTitle: string;
  status: "shortlisted" | "accepted" | "rejected";
  campaignId: string;
}): Promise<void> {
  const [person] = await contactsFor([opts.influencerId]);
  if (!person) return;
  const labels = {
    shortlisted: "μπήκε στη λίστα",
    accepted: "έγινε αποδεκτή",
    rejected: "δεν προχώρησε",
  };
  const line = labels[opts.status];
  await sendTransactional(
    person.email,
    `Η αίτησή σου ${line}`,
    `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
      <p>Γεια σου ${escapeHtml(person.name)},</p>
      <p>Η αίτησή σου για «${escapeHtml(opts.campaignTitle)}» ${line}.</p>
      <p><a href="${campaignLink(opts.campaignId)}">Άνοιγμα καμπάνιας</a></p>
    </div>`
  );
  await sendPushToInfluencer(person.id, {
    title: "Ενημέρωση αίτησης",
    body: `${opts.campaignTitle}: ${line}`.slice(0, 120),
    url: "/dashboard?tab=campaigns",
    tag: `campaign-app-${opts.campaignId}-${opts.status}`,
  });
}

export async function notifyApplicantsCampaignRemoved(opts: {
  influencerIds: string[];
  campaignTitle: string;
}): Promise<number> {
  const people = await contactsFor(opts.influencerIds.slice(0, 25));
  let sent = 0;
  for (const person of people) {
    const mail = await sendTransactional(
      person.email,
      `Η καμπάνια «${opts.campaignTitle}» αφαιρέθηκε`,
      `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
        <p>Γεια σου ${escapeHtml(person.name)},</p>
        <p>Η καμπάνια «${escapeHtml(opts.campaignTitle)}», στην οποία είχες κάνει αίτηση, αφαιρέθηκε από την επιχείρηση. Η αίτησή σου δεν είναι πλέον ενεργή.</p>
      </div>`
    );
    if (mail.ok) sent += 1;
    await sendPushToInfluencer(person.id, {
      title: "Η καμπάνια αφαιρέθηκε",
      body: opts.campaignTitle.slice(0, 120),
      url: "/dashboard?tab=campaigns",
      tag: `campaign-removed-${person.id}`,
    });
  }
  return sent;
}
