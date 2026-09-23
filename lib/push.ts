/**
 * Web Push Notifications - send to subscribers
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Initialize VAPID (must be set in env)
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@influo.gr',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Admin receives web push under `user_type: brand` + ADMIN_EMAIL (see Admin PushNotificationPrompt). */
export function getAdminPushRecipient(): string | null {
  const e = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return e || null;
}

/** Notify admin (pending influencer signup). */
export async function sendPushAdminNewInfluencerPending(
  displayName: string,
  contactEmail: string
): Promise<{ sent: number; failed: number }> {
  const admin = getAdminPushRecipient();
  if (!admin) {
    console.warn('[Push] ADMIN_EMAIL not set, skip admin signup push');
    return { sent: 0, failed: 0 };
  }
  return sendPushToBrand(admin, {
    title: '🔔 Νέος influencer για έλεγχο',
    body: `${displayName} (${contactEmail}) — εγγραφή προς έγκριση`,
    url: '/admin',
    // Unique tag so each signup creates a new notification (same tag replaces previous on Android).
    tag: `admin-pending-influencer-${contactEmail.toLowerCase()}`,
  });
}

export async function sendPushInfluencerAccountApproved(
  influencerId: string,
  displayName: string
): Promise<{ sent: number; failed: number }> {
  return sendPushToInfluencer(String(influencerId), {
    title: '✅ Το προφίλ σου εγκρίθηκε',
    body: `Γεια σου ${displayName}! Το Influo δημοσίευσε το προφίλ σου στο directory.`,
    url: '/dashboard',
    tag: 'influencer-approved',
  });
}

/** Must be called before push_subscriptions for this influencer are deleted. */
export async function sendPushInfluencerAccountDeleted(
  influencerId: string,
  displayName: string
): Promise<{ sent: number; failed: number }> {
  const name = clipPushText(displayName || 'Influencer', 40);
  return sendPushToInfluencer(String(influencerId), {
    title: 'Ο λογαριασμός διαγράφηκε',
    body: `Ο λογαριασμός σας στο influo.gr (${name}) έχει διαγραφεί οριστικά.`,
    url: 'https://www.influo.gr',
    tag: 'influencer-account-deleted',
  });
}

export async function sendPushAdminInfluencerAccountDeleted(opts: {
  displayName: string;
  email: string;
  initiator?: 'admin' | 'self';
}): Promise<{ sent: number; failed: number }> {
  const admin = getAdminPushRecipient();
  if (!admin) return { sent: 0, failed: 0 };
  const who = clipPushText(opts.displayName || 'Influencer', 36);
  const how = opts.initiator === 'self' ? 'από τον ίδιο' : 'από admin';
  return sendPushToBrand(admin, {
    title: '🗑️ Διαγραφή influencer',
    body: `${who} διαγράφηκε οριστικά (${how}) · ${clipPushText(opts.email || '—', 40)}`,
    url: '/admin',
    tag: 'admin-influencer-deleted',
  });
}

export async function sendPushInfluencerAnnouncement(
  influencerId: string,
  title: string
): Promise<{ sent: number; failed: number }> {
  const short = title.length > 72 ? `${title.slice(0, 69)}…` : title;
  return sendPushToInfluencer(String(influencerId), {
    title: '📢 Νέα ανακοίνωση Influo',
    body: `Υπάρχει νέα ανακοίνωση: ${short}`,
    url: '/dashboard',
    tag: 'announcement',
  });
}

function clipPushText(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Χρήστης άνοιξε ticket → ειδοποίηση admin (ίδιο ADMIN_EMAIL με push subscribe). */
export async function sendPushAdminNewSupportTicket(opts: {
  subject: string;
  userName: string;
  userType: string;
}): Promise<{ sent: number; failed: number }> {
  const admin = getAdminPushRecipient();
  if (!admin) return { sent: 0, failed: 0 };
  const role = opts.userType === 'brand' ? 'Brand' : 'Influencer';
  return sendPushToBrand(admin, {
    title: '🎫 Νέο ticket Help Desk',
    body: `${clipPushText(opts.userName, 36)} (${role}): ${clipPushText(opts.subject, 72)}`,
    url: '/admin/support',
    tag: 'support-ticket-new',
  });
}

/** Χρήστης απάντησε σε ticket → ειδοποίηση admin. */
export async function sendPushAdminSupportTicketUserReply(opts: {
  subject: string;
  userName: string;
}): Promise<{ sent: number; failed: number }> {
  const admin = getAdminPushRecipient();
  if (!admin) return { sent: 0, failed: 0 };
  return sendPushToBrand(admin, {
    title: '💬 Νέα απάντηση στο ticket',
    body: `${clipPushText(opts.userName, 32)} — ${clipPushText(opts.subject, 78)}`,
    url: '/admin/support',
    tag: 'support-ticket-user-reply',
  });
}

/** Admin απάντησε στο ticket → ειδοποίηση χρήστη (influencer id ή brand email). */
export async function sendPushUserHelpDeskAdminReply(ticket: {
  user_type: string;
  user_id: string;
  user_email: string;
  subject: string;
}): Promise<{ sent: number; failed: number }> {
  const subj = clipPushText(ticket.subject, 78);
  if (ticket.user_type === 'brand') {
    const email = String(ticket.user_email || '').trim().toLowerCase();
    if (!email) return { sent: 0, failed: 0 };
    return sendPushToBrand(email, {
      title: '✅ Απάντηση στο ticket σου',
      body: `Θέμα: ${subj}`,
      url: '/help-desk',
      tag: 'support-ticket-admin-reply',
    });
  }
  if (ticket.user_type === 'influencer' && ticket.user_id) {
    return sendPushToInfluencer(String(ticket.user_id), {
      title: '✅ Απάντηση στο ticket σου',
      body: `Θέμα: ${subj}`,
      url: '/help-desk',
      tag: 'support-ticket-admin-reply',
    });
  }
  return { sent: 0, failed: 0 };
}

/** Admin δημιούργησε ticket για χρήστη → ειδοποίηση χρήστη. */
export async function sendPushUserHelpDeskTicketFromAdmin(opts: {
  user_type: string;
  user_id: string;
  user_email: string;
  subject: string;
}): Promise<{ sent: number; failed: number }> {
  const subj = clipPushText(opts.subject, 75);
  if (opts.user_type === 'brand') {
    const email = String(opts.user_email || '').trim().toLowerCase();
    if (!email) return { sent: 0, failed: 0 };
    return sendPushToBrand(email, {
      title: '📧 Νέο ticket από το Influo',
      body: `Θέμα: ${subj}`,
      url: '/help-desk',
      tag: 'support-ticket-from-admin',
    });
  }
  if (opts.user_type === 'influencer' && opts.user_id) {
    return sendPushToInfluencer(String(opts.user_id), {
      title: '📧 Νέο ticket από το Influo',
      body: `Θέμα: ${subj}`,
      url: '/help-desk',
      tag: 'support-ticket-from-admin',
    });
  }
  return { sent: 0, failed: 0 };
}

async function getSubscriptions(
  userType: 'influencer' | 'brand',
  userIdentifier: string
): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
  const id = String(userIdentifier || '').trim().toLowerCase();
  if (!id) return [];
  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_type', userType)
    .ilike('user_identifier', id);

  if (error || !data?.length) return [];
  return data;
}

export async function sendPushToInfluencer(
  influencerId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not set, skipping');
    return { sent: 0, failed: 0 };
  }

  const subs = await getSubscriptions('influencer', String(influencerId));
  if (!subs.length) return { sent: 0, failed: 0 };

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag || 'influo-notification',
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 86400 } // 24h
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired - remove from DB
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      } else {
        console.error('[Push] Failed to send:', err.message);
      }
    }
  }

  return { sent, failed };
}

/** Όταν ένα verified brand δημοσιεύει ανοιχτή καμπάνια — ειδοποίηση όλων των εγκεκριμένων influencers. */
export async function sendPushNewOpenCampaignToAllApprovedInfluencers(opts: {
  campaignTitle: string;
  brandName: string;
  campaignId: string;
}): Promise<{ sent: number; failed: number }> {
  const { data: influencers, error } = await supabaseAdmin
    .from("influencers")
    .select("id")
    .eq("approved", true);
  if (error) {
    console.error("[Push] sendPushNewOpenCampaignToAllApprovedInfluencers", error);
    return { sent: 0, failed: 0 };
  }
  if (!influencers?.length) return { sent: 0, failed: 0 };

  const title = "📣 Νέα καμπάνια";
  const body = `${clipPushText(opts.brandName, 28)}: ${clipPushText(opts.campaignTitle, 90)}`;
  let sent = 0;
  let failed = 0;

  const chunkSize = 25;
  for (let i = 0; i < influencers.length; i += chunkSize) {
    const chunk = influencers.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map((row) =>
        sendPushToInfluencer(String(row.id), {
          title,
          body,
          url: "/dashboard",
          tag: `campaign-open-${opts.campaignId}`,
        })
      )
    );
    for (const r of results) {
      sent += r.sent;
      failed += r.failed;
    }
  }
  return { sent, failed };
}

/** Influencer υπέβαλε αίτηση σε καμπάνια — ειδοποίηση brand (web push με email ως user_identifier). */
export async function sendPushBrandNewCampaignApplication(opts: {
  brandEmail: string;
  campaignTitle: string;
  influencerName: string;
  applicationId: string;
}): Promise<{ sent: number; failed: number }> {
  const email = String(opts.brandEmail || "")
    .trim()
    .toLowerCase();
  if (!email) return { sent: 0, failed: 0 };
  return sendPushToBrand(email, {
    title: "📩 Νέα αίτηση καμπάνιας",
    body: `${clipPushText(opts.influencerName, 36)} — «${clipPushText(opts.campaignTitle, 56)}»`,
    url: "/brand/dashboard?tab=campaigns",
    tag: `campaign-app-${opts.applicationId}`,
  });
}

export async function sendPushToBrand(
  brandEmail: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not set, skipping');
    return { sent: 0, failed: 0 };
  }

  const subs = await getSubscriptions('brand', brandEmail.toLowerCase().trim());
  if (!subs.length) return { sent: 0, failed: 0 };

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/brand/dashboard',
    tag: payload.tag || 'influo-notification',
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
        { TTL: 86400 }
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      } else {
        console.error('[Push] Failed to send:', err.message);
      }
    }
  }

  return { sent, failed };
}
