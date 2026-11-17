/**
 * Email digest feature flags. Default OFF.
 */

function envOn(raw: string | undefined | null): boolean {
  return /^(1|true|yes|on)$/i.test(String(raw || "").trim());
}

/**
 * Brand: first application per campaign stays instant; later ones queue for ~3h digest.
 * Default OFF → all brand application emails stay 1:1.
 */
export function isBrandApplicationDigestEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.BRAND_APPLICATION_DIGEST_ENABLED);
}

/**
 * Admin daily digest (~09:30 Europe/Athens) for applications, signups, profile edits,
 * unapproved alerts, proposals. When ON, those stop sending 1:1.
 * Also respects legacy ADMIN_APPLICATION_DIGEST_ENABLED (applications only) via merge in queue layer.
 */
export function isAdminDailyDigestEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.ADMIN_DAILY_DIGEST_ENABLED);
}

/** Hours between brand application digest flushes per campaign. */
export const BRAND_APPLICATION_DIGEST_HOURS = 3;
