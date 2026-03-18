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
