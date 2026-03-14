/**
 * Parse follower string (e.g. "15k", "1.5M", "14.600") to number.
 * Used for snapshots and growth calculation.
 */
export function parseFollowerString(str: string | number | null | undefined): number {
  if (str == null || str === '') return 0;
  const clean = String(str).toLowerCase().replace(/\s/g, '').replace(/,/g, '').trim();
  if (clean.includes('m')) return parseFloat(clean) * 1_000_000;
  if (clean.includes('k') || clean.includes('κ')) return parseFloat(clean) * 1000;
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1]))
      return parseInt(parts[0] + parts[1], 10) || 0;
  }
  const num = parseFloat(clean);
  return Number.isNaN(num) ? 0 : Math.round(num);
}

/** Sum followers from accounts array (e.g. influencer.accounts). */
export function totalFollowersFromAccounts(accounts: Array<{ followers?: string | number | null }> | null | undefined): number {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, acc) => sum + parseFollowerString(acc?.followers), 0);
}
