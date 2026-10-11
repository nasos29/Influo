import { presenceOnline, PRESENCE_STALE_MS } from "@/lib/presenceStatus";

/** Structured Vercel log. Types are fixed tokens; never pass an address, name, or body. */
export function emailLogLine(type: string, ok: boolean): string {
  return `email sent type=${type} ok=${ok}`;
}

export function pushLogLine(type: string, count: number, skippedOnline = false): string {
  if (skippedOnline) return `push sent type=${type} count=0 skipped=online`;
  return `push sent type=${type} count=${count}`;
}

export function logEmail(type: string, ok: boolean): void {
  console.log(emailLogLine(type, ok));
}

export function logPush(type: string, count: number, skippedOnline = false): void {
  console.log(pushLogLine(type, count, skippedOnline));
}

/**
 * The recipient is in this thread when their conversation activity stamp is fresh.
 * Account-wide presence is not used: that flag is not tied to one conversation.
 */
export function activityInThread(stamp: string | null | undefined, now = Date.now()): boolean {
  return presenceOnline({ is_online: true, last_seen: stamp ?? null }, now, PRESENCE_STALE_MS);
}
