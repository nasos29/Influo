import type { AccountFetchResult } from '@/lib/socialRefresh';

export type RefreshInfluencerResult = {
  id: string;
  name: string;
  accounts: number;
  errors?: string[];
};

export type DueInfluencer = {
  id: number | string;
  display_name: string;
  accounts?: { platform?: string; username?: string }[];
};

type InfluencerReportRow = {
  id: string;
  name: string;
  status: string;
  socialAccounts: number;
  auditprSuccess: number;
  auditprFailed: number;
  saveErrors: string;
  notes: string;
};

function normalizeKey(platform: string, username: string): string {
  return `${platform.toLowerCase()}:${username.replace(/^@+/, '').trim().toLowerCase()}`;
}

function accountFetchMap(results: AccountFetchResult[]): Map<string, AccountFetchResult> {
  const map = new Map<string, AccountFetchResult>();
  for (const r of results) {
    map.set(normalizeKey(r.platform, r.username), r);
  }
  return map;
}

function buildInfluencerRows(
  dueList: DueInfluencer[],
  refreshResults: RefreshInfluencerResult[],
  accountResults: AccountFetchResult[],
  lang: 'el' | 'en'
): InfluencerReportRow[] {
  const fetchByKey = accountFetchMap(accountResults);
  const refreshById = new Map(refreshResults.map((r) => [String(r.id), r]));

  return dueList.map((inf) => {
    const id = String(inf.id);
    const name = inf.display_name || id;
    const accounts = (inf.accounts ?? []).filter((a) => (a.platform || '').trim() && (a.username || '').trim());
    const trackable = accounts.filter((a) => {
      const p = (a.platform || '').toLowerCase();
      return p === 'instagram' || p === 'tiktok' || p === 'youtube';
    });

    let auditprSuccess = 0;
    let auditprFailed = 0;
    const auditFailReasons: string[] = [];

    for (const acc of trackable) {
      const key = normalizeKey(acc.platform || '', acc.username || '');
      const fetched = fetchByKey.get(key);
      if (!fetched) {
        auditprFailed += 1;
        auditFailReasons.push(
          lang === 'el'
            ? `${acc.platform} @${acc.username}: δεν ελήφθησαν δεδομένα από Auditpr`
            : `${acc.platform} @${acc.username}: no Auditpr data received`
        );
        continue;
      }
      if (fetched.status === 'success') auditprSuccess += 1;
      else {
        auditprFailed += 1;
        auditFailReasons.push(`${acc.platform} @${acc.username}: ${fetched.error || '—'}`);
      }
    }

    const saveResult = refreshById.get(id);
    const saveErrors = (saveResult?.errors ?? []).join('; ');
    const hasSaveErrors = saveErrors.length > 0;

    let status: string;
    if (trackable.length === 0) {
      status = lang === 'el' ? 'Χωρίς IG/TikTok/YouTube' : 'No IG/TikTok/YouTube';
    } else if (auditprFailed === 0 && !hasSaveErrors) {
      status = lang === 'el' ? 'Επιτυχία' : 'Success';
    } else if (auditprSuccess > 0 || (!hasSaveErrors && auditprFailed < trackable.length)) {
      status = lang === 'el' ? 'Μερική επιτυχία' : 'Partial success';
    } else {
      status = lang === 'el' ? 'Αποτυχία' : 'Failed';
    }

    const notes = [...auditFailReasons].filter(Boolean).join(' | ');

    return {
      id,
      name,
      status,
      socialAccounts: trackable.length,
      auditprSuccess,
      auditprFailed,
      saveErrors,
      notes,
    };
  });
}

function buildAccountRows(
  dueList: DueInfluencer[],
  accountResults: AccountFetchResult[],
  lang: 'el' | 'en'
): Array<Record<string, string | number>> {
  const fetchByKey = accountFetchMap(accountResults);
  const rows: Array<Record<string, string | number>> = [];

  for (const inf of dueList) {
    const influencerName = inf.display_name || String(inf.id);
    for (const acc of inf.accounts ?? []) {
      const platform = (acc.platform || '').trim();
      const username = (acc.username || '').trim();
      if (!platform || !username) continue;
      const pLower = platform.toLowerCase();
      if (pLower !== 'instagram' && pLower !== 'tiktok' && pLower !== 'youtube') continue;

      const fetched = fetchByKey.get(normalizeKey(platform, username));
      rows.push({
        [lang === 'el' ? 'Influencer' : 'Influencer']: influencerName,
        [lang === 'el' ? 'ID' : 'ID']: String(inf.id),
        [lang === 'el' ? 'Πλατφόρμα' : 'Platform']: platform,
        [lang === 'el' ? 'Username' : 'Username']: username,
        [lang === 'el' ? 'Κατάσταση' : 'Status']:
          fetched?.status === 'success'
            ? lang === 'el'
              ? 'Επιτυχία'
              : 'Success'
            : lang === 'el'
              ? 'Αποτυχία'
              : 'Failed',
        Followers: fetched?.followers ?? '—',
        [lang === 'el' ? 'Engagement rate' : 'Engagement rate']: fetched?.engagement_rate ?? '—',
        [lang === 'el' ? 'Μ.Ο. likes' : 'Avg likes']: fetched?.avg_likes ?? '—',
        [lang === 'el' ? 'Posts' : 'Posts']: fetched?.posts_count != null ? String(fetched.posts_count) : '—',
        [lang === 'el' ? 'Μ.Ο. views' : 'Avg views']: fetched?.avg_views != null ? String(fetched.avg_views) : '—',
        [lang === 'el' ? 'Λόγος αποτυχίας' : 'Failure reason']: fetched?.error ?? (fetched ? '—' : lang === 'el' ? 'Δεν ελήφθησαν δεδομένα' : 'No data received'),
      });
    }
  }

  return rows;
}

export async function downloadSocialRefreshReportExcel(options: {
  lang: 'el' | 'en';
  dueList: DueInfluencer[];
  accountResults: AccountFetchResult[];
  refreshResults: RefreshInfluencerResult[];
  completedAt?: Date;
}): Promise<void> {
  const { lang, dueList, accountResults, refreshResults, completedAt = new Date() } = options;
  const influencerRows = buildInfluencerRows(dueList, refreshResults, accountResults, lang);
  const accountRows = buildAccountRows(dueList, accountResults, lang);

  const fullSuccess = influencerRows.filter((r) => r.status === (lang === 'el' ? 'Επιτυχία' : 'Success')).length;
  const partial = influencerRows.filter((r) => r.status === (lang === 'el' ? 'Μερική επιτυχία' : 'Partial success')).length;
  const failed = influencerRows.filter((r) => r.status === (lang === 'el' ? 'Αποτυχία' : 'Failed')).length;
  const noSocial = influencerRows.filter((r) => r.status === (lang === 'el' ? 'Χωρίς IG/TikTok/YouTube' : 'No IG/TikTok/YouTube')).length;

  const auditSuccess = accountResults.filter((r) => r.status === 'success').length;
  const auditFailed = accountResults.filter((r) => r.status === 'failed').length;

  const summaryRows = [
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Ημερομηνία' : 'Date',
      [lang === 'el' ? 'Τιμή' : 'Value']: completedAt.toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB'),
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Σύνολο influencers' : 'Total influencers',
      [lang === 'el' ? 'Τιμή' : 'Value']: dueList.length,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Πλήρης επιτυχία' : 'Full success',
      [lang === 'el' ? 'Τιμή' : 'Value']: fullSuccess,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Μερική επιτυχία' : 'Partial success',
      [lang === 'el' ? 'Τιμή' : 'Value']: partial,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Αποτυχία' : 'Failed',
      [lang === 'el' ? 'Τιμή' : 'Value']: failed,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Χωρίς IG/TikTok/YouTube' : 'No IG/TikTok/YouTube',
      [lang === 'el' ? 'Τιμή' : 'Value']: noSocial,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Accounts Auditpr OK' : 'Auditpr accounts OK',
      [lang === 'el' ? 'Τιμή' : 'Value']: auditSuccess,
    },
    {
      [lang === 'el' ? 'Μετρική' : 'Metric']: lang === 'el' ? 'Accounts Auditpr αποτυχία' : 'Auditpr accounts failed',
      [lang === 'el' ? 'Τιμή' : 'Value']: auditFailed,
    },
  ];

  const influencerSheetRows = influencerRows.map((r) => ({
    ID: r.id,
    [lang === 'el' ? 'Όνομα' : 'Name']: r.name,
    [lang === 'el' ? 'Κατάσταση' : 'Status']: r.status,
    [lang === 'el' ? 'Social accounts' : 'Social accounts']: r.socialAccounts,
    [lang === 'el' ? 'Auditpr OK' : 'Auditpr OK']: r.auditprSuccess,
    [lang === 'el' ? 'Auditpr αποτυχίες' : 'Auditpr failures']: r.auditprFailed,
    [lang === 'el' ? 'Σφάλματα αποθήκευσης' : 'Save errors']: r.saveErrors || '—',
    [lang === 'el' ? 'Λεπτομέρειες / λόγοι' : 'Details / reasons']: r.notes || '—',
  }));

  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  const wsInfluencers = XLSX.utils.json_to_sheet(influencerSheetRows);
  const wsAccounts = XLSX.utils.json_to_sheet(accountRows.length ? accountRows : [{ Info: lang === 'el' ? 'Δεν υπήρχαν accounts' : 'No accounts' }]);

  XLSX.utils.book_append_sheet(wb, wsSummary, lang === 'el' ? 'Σύνοψη' : 'Summary');
  XLSX.utils.book_append_sheet(wb, wsInfluencers, lang === 'el' ? 'Influencers' : 'Influencers');
  XLSX.utils.book_append_sheet(wb, wsAccounts, lang === 'el' ? 'Accounts' : 'Accounts');

  const stamp = completedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `influo-social-refresh-${stamp}.xlsx`);
}
