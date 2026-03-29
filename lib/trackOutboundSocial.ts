import { getVisitorId } from '@/lib/visitorId';

/**
 * Reliable client-side tracking for outbound social clicks (new tab).
 * sendBeacon survives navigation better than fetch alone; fetch with keepalive is the fallback.
 */
export function trackOutboundSocialClick(influencerId: string, platform: string): void {
  if (typeof window === 'undefined') return;
  const payload = {
    influencerId: String(influencerId),
    eventType: 'profile_click' as const,
    visitorId: getVisitorId() || undefined,
    metadata: { source: 'social_outbound', platform: String(platform).toLowerCase() },
  };
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: 'application/json' });
    const url = `${window.location.origin}/api/analytics/track`;
    if (navigator.sendBeacon(url, blob)) return;
  } catch {
    /* fall through */
  }
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}
