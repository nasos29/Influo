import { detectErFlag, type ErFlagReason } from '@/lib/engagementFlags';

export type AccountTrustInput = {
  platform?: string;
  engagement_rate?: string | null;
  posts_count?: number | string | null;
  avg_likes?: string | number | null;
  is_private?: boolean | null;
  er_suspicious?: boolean | null;
  er_flag_reason?: string | null;
};

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
  let privateFound = false;
  let erFound = false;

  for (const acc of accounts) {
    if (!privateFound && acc.is_private === true) {
      privateFound = true;
      chips.push({
        kind: 'private',
        labelEl: 'Ιδιωτικό',
        labelEn: 'Private',
        titleEl: 'Τουλάχιστον ένας λογαριασμός είναι ιδιωτικός.',
        titleEn: 'At least one account is private.',
      });
    }
    if (!erFound) {
      const flag =
        detectErFlag({
          engagement_rate: acc.engagement_rate,
          posts_count: acc.posts_count,
          avg_likes: acc.avg_likes,
          suspected_fake_penalty: acc.er_flag_reason === 'quality_adjusted',
          engagement_hidden:
            acc.er_flag_reason === 'estimated' ||
            String(acc.engagement_rate || '').startsWith('~'),
        }) ||
        (acc.er_suspicious && acc.er_flag_reason
          ? { reason: acc.er_flag_reason as ErFlagReason, suspicious: true }
          : null);
      if (flag) {
        erFound = true;
        chips.push({
          kind: 'er',
          labelEl: 'Ύποπτο ER',
          labelEn: 'ER flag',
          titleEl: 'Το engagement φαίνεται ύποπτο ή μη αξιόπιστο.',
          titleEn: 'Engagement looks suspicious or unreliable.',
        });
      }
    }
    if (privateFound && erFound) break;
  }
  return chips;
}

export function isAvailableStatus(status?: string | null): boolean {
  return !status || status === 'available';
}
