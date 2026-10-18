import { supabaseService } from "@/lib/apiAuth";
import { sharedCategoryKeys } from "@/lib/recommendations";
import { sendPushToInfluencer } from "@/lib/push";
import { escapeHtml, sendTransactional } from "@/lib/transactionalEmail";

const MATCH_LIMIT = 25;

type Contact = { id: string; name: string; email: string | null; category: string | null };

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
  }));
}

function campaignLink(id: string): string {
  const host = process.env.NEXT_PUBLIC_SITE_URL || "https://www.influo.gr";
  return `${host.replace(/\/$/, "")}/campaigns/${id}`;
}

export async function matchingInfluencerIds(category: string | null | undefined): Promise<string[]> {
  if (!category) return [];
  const admin = supabaseService();
  const { data, error } = await admin
    .from("influencers")
    .select("id, category")
    .eq("approved", true)
    .limit(400);
  if (error || !data) return [];
  return data
    .filter((row) => sharedCategoryKeys(category, row.category).length > 0)
    .slice(0, MATCH_LIMIT)
    .map((row) => String(row.id));
}

export async function notifyMatchingOpenCampaign(opts: {
  campaignId: string;
  title: string;
  category: string | null;
  brandName: string;
}): Promise<{ emailed: number; pushed: number }> {
  const ids = await matchingInfluencerIds(opts.category);
  if (!ids.length) return { emailed: 0, pushed: 0 };
  const people = await contactsFor(ids);
  const link = campaignLink(opts.campaignId);
  const safeTitle = escapeHtml(opts.title);
  const safeBrand = escapeHtml(opts.brandName);
  let emailed = 0;
  let pushed = 0;
  for (const person of people) {
    const mail = await sendTransactional(
      person.email,
      `Νέα καμπάνια: ${opts.title}`,
      `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;max-width:560px">
        <p>Γεια σου ${escapeHtml(person.name)},</p>
        <p>Η επιχείρηση <strong>${safeBrand}</strong> δημοσίευσε την καμπάνια <strong>${safeTitle}</strong> σε κατηγορία που ταιριάζει με το προφίλ σου.</p>
        <p><a href="${link}">Δες την καμπάνια και κάνε αίτηση</a></p>
      </div>`
    );
    if (mail.ok) emailed += 1;
    const push = await sendPushToInfluencer(person.id, {
      title: "Νέα καμπάνια",
      body: `${opts.brandName}: ${opts.title}`.slice(0, 120),
      url: `/campaigns/${opts.campaignId}`,
      tag: `campaign-open-${opts.campaignId}`,
    });
    pushed += push.sent;
  }
  return { emailed, pushed };
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
