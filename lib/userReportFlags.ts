/**
 * User report email notifications. Default OFF (same env truthiness as emailDigestFlags).
 */

function envOn(raw: string | undefined | null): boolean {
  return /^(1|true|yes|on)$/i.test(String(raw || "").trim());
}

export function isUserReportEmailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.USER_REPORT_EMAILS_ENABLED);
}