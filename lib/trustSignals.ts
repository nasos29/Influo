import { erFlagHint, erFlagLabel, pickDisplayErFlag, type ErCheckInput } from '@/lib/engagementFlags';

export type AccountTrustInput = ErCheckInput;

export type TrustChip = {
  kind: 'private' | 'er';
  labelEl: string;
  labelEn: string;
  titleEl: string;
  titleEn: string;
};

/** Derive compact trust chips for Directory / cards from account rows. */
export function trustChipsFromAccounts(accounts: AccountTrustInput[] | null | undefined): TrustChip[] {
  if (!Array.isArray(accounts) || accounts.length === 0) return [];
  const chips: TrustChip[] = [];

  if (accounts.some((acc) => acc?.is_private === true)) {
    chips.push({
      kind: 'private',
      labelEl: 'Ιδιωτικό',
      labelEn: 'Private',
      titleEl: 'Τουλάχιστον ένας λογαριασμός είναι ιδιωτικός.',
      titleEn: 'At least one account is private.',
    });
  }

  const flag = pickDisplayErFlag(accounts);
  if (flag) {
    chips.push({
      kind: 'er',
      labelEl: erFlagLabel(flag, 'el'),
      labelEn: erFlagLabel(flag, 'en'),
      titleEl: erFlagHint(flag, 'el'),
      titleEn: erFlagHint(flag, 'en'),
    });
  }
  return chips;
}

export function isAvailableStatus(status?: string | null): boolean {
  return !status || status === 'available';
}
