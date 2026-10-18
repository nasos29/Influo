import { supabaseService } from "@/lib/apiAuth";
import { campaignAlertTarget, type AlertCandidate } from "@/lib/campaignAlert";
import { sendPushToInfluencer } from "@/lib/push";
import { escapeHtml, sendTransactional } from "@/lib/transactionalEmail";

const MATCH_LIMIT = 25;
const SEND_TIMEOUT_MS = 8000;

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

async function contactsFor(ids: string[]): Promise<Contact[]> {
  if (!ids.length) return [];
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

export async function matchingInfluencerIds(category: string | null | undefined): Promise<Array<{ id: string; authUserId: string }>> {
  if (!category) return [];
  const admin = supabaseService();
  const { data, error } = await admin
    .from("influencers")
    .select("id, category, approved, availability_status, auth_user_id")
    .eq("approved", true)
    .limit(400);
  if (error || !data) return [];
  const matched: Array<{ id: string; authUserId: string }> = [];
  for (const row of data) {
    const target = campaignAlertTarget(row as AlertCandidate, category);
    if (target) matched.push(target);
    if (matched.length >= MATCH_LIMIT) break;
  }
  return matched;
}

export async function notifyMatchingOpenCampaign(opts: {
  campaignId: string;
  title: string;
  category: string | null;
  brandName: string;
}): Promise<{ emailed: number; pushed: number; inApp: number }> {
  const targets = await matchingInfluencerIds(opts.category);
  if (!targets.length) return { emailed: 0, pushed: 0, inApp: 0 };
  const people = (await contactsFor(targets.map((row) => row.id))).map((person) => ({
    ...person,
    authUserId: targets.find((row) => row.id === person.id)?.authUserId || person.id,
  }));
  const link = campaignLink(opts.campaignId);
  const safeTitle = escapeHtml(opts.title);
  const safeBrand = escapeHtml(opts.brandName);
  const deliveries = await Promise.all(
    people.map(async (person) => {
      const mail = await withTimeout(
        sendTransactional(
          person.email,
          `Νέα καμπάνια: ${opts.title}`,
          `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
        <p>Γεια σου ${escapeHtml(person.name)},</p>
        <p>Η επιχείρηση <strong>${safeBrand}</strong> δημοσίευσε την καμπάνια <strong>${safeTitle}</strong> σε κατηγορία που ταιριάζει με το προφίλ σου.</p>
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
    })
  );
  const inApp = await insertCampaignAnnouncements(
    people.map((person) => person.authUserId),
    opts.title,
    `${opts.brandName} δημοσίευσε «${opts.title}».\n${link}`
  );
  return {
    emailed: deliveries.reduce((sum, row) => sum + row.emailed, 0),
    pushed: deliveries.reduce((sum, row) => sum + row.pushed, 0),
    inApp,
  };
}

async function insertCampaignAnnouncements(authUserIds: string[], title: string, body: string): Promise<number> {
  const unique = [...new Set(authUserIds.filter(Boolean))];
  if (!unique.length) return 0;
  const admin = supabaseService();
  const { data, error } = await admin
    .from("announcements")
    .insert(unique.map((id) => ({
      title: `Νέα καμπάνια: ${title}`.slice(0, 180),
      body,
      target_type: "specific",
      target_influencer_id: id,
    })))
    .select("id");
  if (error) {
    console.error("[campaignNotify] in-app", error);
    return 0;
  }
  return data?.length || 0;
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
  const people = await contactsFor(opts.influencerIds.slice(0, MATCH_LIMIT));
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
