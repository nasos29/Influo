/**
 * Showcase flags. Live appearance-notify emails were removed (inline notice instead).
 * Flags kept so existing env docs / tests stay stable; they no longer gate sends.
 */

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(String(value || "").trim());
}

/** @deprecated Separate showcase appearance emails are disabled; always false for send paths. */
export function isShowcaseAppearanceNotifyEnabled(
  _env: Record<string, string | undefined> = process.env
): boolean {
  return false;
}

/** @deprecated Separate showcase appearance emails are disabled. */
export function isShowcaseAppearanceNotifyLive(
  env: Record<string, string | undefined> = process.env
): boolean {
  return truthy(env.SHOWCASE_APPEARANCE_NOTIFY_LIVE);
}
