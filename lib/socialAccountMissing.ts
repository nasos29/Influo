import { isSessionDeadError } from "@/lib/socialRefreshLogs";
import { parseFollowerString } from "@/lib/parseFollowers";

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

/** Missing-account email: clear not-found only (not private, not zero-stats / ambiguous username). */
export function isClearAccountNotFoundForEmail(message: string): boolean {
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
  if (/πιθανό λάθος username|μηδενικά|zero stats|0\/0\/0/i.test(msg)) return false;
  return /not found|does not exist|doesn.?t exist|δεν υπάρχει|user banned|no social profiles|404/i.test(msg);
}

/** Wrong-username hold: not-found, private, zero-stats, or ambiguous username hints. */
export function isWrongUsernameHoldError(message: string): boolean {
  const msg = (message || "").trim();
  if (!msg || isSessionDeadError(msg)) return false;
  if (
    /getaddrinfo|timeout|timed out|network|errno|rate.?limit|429|5\d\d|service unavailable|econnreset|enotfound|auditpr request failed/i.test(
      msg
    )
  ) {
    return false;
  }
  if (/private|ιδιωτικό/i.test(msg)) return true;
  if (/πιθανό λάθος username|μηδενικά|zero stats|0\/0\/0/i.test(msg)) return true;
  if (isClearAccountNotFoundForEmail(msg)) return true;
  if (/λάθος username/i.test(msg)) return true;
  return false;
}

export function isScrapedAccountZeroStats(account: {
  ok?: boolean;
  followers?: string;
  avg_likes?: string;
  posts_count?: number;
}): boolean {
  if (account.ok === false) return false;
  const followers = parseFollowerString(account.followers);
  const likes = parseFollowerString(account.avg_likes);
  const posts = Number(account.posts_count ?? 0);
  return followers === 0 && likes === 0 && posts === 0;
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