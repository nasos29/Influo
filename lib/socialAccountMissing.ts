import { isSessionDeadError } from "@/lib/socialRefreshLogs";

/** Permanent “account does not exist” style errors from AuditPro / refresh (not transient or private). */
export function isPermanentAccountMissingError(message: string): boolean {
  const msg = (message || "").trim();
  if (!msg || isSessionDeadError(msg)) return false;
  if (/private|ιδιωτικό/i.test(msg)) return false;
  if (
    /getaddrinfo|timeout|timed out|network|errno|rate.?limit|429|5\d\d|service unavailable|econnreset|enotfound|auditpr request failed/i.test(
      msg
    )
  ) {
    return false;
  }
  return /not found|does not exist|doesn.?t exist|δεν υπάρχει|λάθος username|user banned|no social profiles|404/i.test(
    msg
  );
}

export function normalizeSocialHandle(username: string): string {
  return String(username || "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
}

export function isMissingAccountEmailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = String(env.MISSING_ACCOUNT_EMAIL_ENABLED || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Approve-new path only; independent of SocialRefresh MISSING_ACCOUNT_EMAIL_ENABLED. */
export function isMissingAccountEmailOnApproveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = String(env.MISSING_ACCOUNT_EMAIL_ON_APPROVE_ENABLED || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}