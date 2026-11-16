/**
 * Showcase appearance notification flags. Default OFF — no emails until enabled.
 */

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(String(value || "").trim());
}

/** Notify both parties when a deliverable is submitted/approved that it may appear in Πρόσφατες συνεργασίες. */
export function isShowcaseAppearanceNotifyEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return truthy(env.SHOWCASE_APPEARANCE_NOTIFY_ENABLED);
}

/** When notify is on, LIVE sends to real recipients; otherwise redirect to test inbox if configured. */
export function isShowcaseAppearanceNotifyLive(
  env: Record<string, string | undefined> = process.env
): boolean {
  return truthy(env.SHOWCASE_APPEARANCE_NOTIFY_LIVE);
}
