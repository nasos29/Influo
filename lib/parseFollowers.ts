const FOLLOWER_DISPLAY = new Intl.NumberFormat("el-GR");

/** Full integer with Greek thousands grouping (el-GR): 1449 → «1.449». */
export function formatFollowerCompact(num: number): string {
  if (!Number.isFinite(num)) return "0";
  return FOLLOWER_DISPLAY.format(Math.round(num));
}

/**
 * Normalize any Auditpr/UI followers value for accounts JSON storage.
 * Always stores plain integer string (no k/M, no separators).
 */
export function normalizeFollowersForStorage(
  value: string | number | null | undefined
): string {
  const n = parseFollowerString(value);
  if (n <= 0) {
    const raw = value == null ? "" : String(value).trim();
    return raw;
  }
  return String(Math.round(n));
}

function parseDecimalToken(s: string): number {
  const t = s.trim();
  if (!t) return Number.NaN;
  if (/,/.test(t) && !/\./.test(t)) {
    const parts = t.split(",");
    if (parts.length === 2 && parts[1].length <= 2 && /^\d+$/.test(parts[1])) {
      return parseFloat(`${parts[0]}.${parts[1]}`);
    }
  }
  return parseFloat(t.replace(",", "."));
}

function parsePlainNumberToken(s: string): number {
  if (!/^[\d.,]+$/.test(s)) return Math.round(parseDecimalToken(s) || 0);
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep >= 0) {
    const after = s.slice(lastSep + 1);
    if (/^\d{3}$/.test(after)) {
      return parseInt(s.replace(/[.,]/g, ""), 10) || 0;
    }
  }
  const n = parseDecimalToken(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Parse follower strings (legacy k/M, Greek εκ., grouped thousands, plain ints).
 * Comma/dot + exactly 3 digits with no unit → thousands; comma + unit → decimal.
 */
export function parseFollowerString(str: string | number | null | undefined): number {
  if (str == null || str === "") return 0;
  if (typeof str === "number" && Number.isFinite(str)) return Math.round(str);

  let s = String(str).trim().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  if (!s || s === "-" || /^n\/a$/i.test(s)) return 0;

  let scale = 1;
  if (/εκ(ατ)?\.?/i.test(s)) {
    scale = 1_000_000;
    s = s.replace(/εκ(ατ)?\.?/gi, "").trim();
  } else if (/[kκ](?:\s*)$/i.test(s)) {
    scale = 1000;
    s = s.replace(/[kκ]\s*$/i, "").trim();
  } else if (/m\s*$/i.test(s)) {
    scale = 1_000_000;
    s = s.replace(/m\s*$/i, "").trim();
  }

  if (scale > 1) {
    const n = parseDecimalToken(s.replace(/\s/g, ""));
    return Number.isFinite(n) ? Math.round(n * scale) : 0;
  }

  return parsePlainNumberToken(s.replace(/\s/g, ""));
}

/** Sum followers from accounts array (e.g. influencer.accounts). */
export function totalFollowersFromAccounts(accounts: { followers?: string | number | null }[] | null | undefined): number {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, acc) => sum + parseFollowerString(acc?.followers), 0);
}

/** Sum posts_count from accounts array. */
export function totalPostsFromAccounts(
  accounts: { posts_count?: string | number | null }[] | null | undefined
): number {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, acc) => sum + parseFollowerString(acc?.posts_count), 0);
}

/** Factor (10/100/1000) if two totals look like a missing-k snapshot, else null. */
export function followerScaleFactor(lo: number, hi: number): number | null {
  if (!(lo > 0) || !(hi > 0) || lo >= hi) return null;
  for (const factor of [1000, 100, 10]) {
    if (Math.abs(lo * factor - hi) / hi < 0.25) return factor;
  }
  return null;
}

/** True when two totals look like a missing-k / extra-k snapshot bug (e.g. 18 vs 18.3k). */
export function looksLikeFollowerScaleTypo(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return followerScaleFactor(lo, hi) != null;
}

/**
 * Repair a snapshot total vs the current follower count.
 * 18 vs 18.3k → 18000 so 15-day growth still shows.
 */
export function alignFollowerSnapshotToCurrent(oldTotal: number, currentTotal: number): number | null {
  if (!Number.isFinite(oldTotal) || !Number.isFinite(currentTotal) || oldTotal <= 0 || currentTotal <= 0) {
    return null;
  }
  const ratio = currentTotal / oldTotal;
  if (ratio <= 8 && ratio >= 1 / 8) return Math.round(oldTotal);
  const lo = Math.min(oldTotal, currentTotal);
  const hi = Math.max(oldTotal, currentTotal);
  const factor = followerScaleFactor(lo, hi);
  if (!factor) return null;
  if (oldTotal < currentTotal) return Math.round(oldTotal * factor);
  return Math.round(oldTotal / factor);
}

/** Baseline usable for a 15-day growth card vs current total. */
export function isPlausibleFollowerBaseline(oldTotal: number, currentTotal: number): boolean {
  return alignFollowerSnapshotToCurrent(oldTotal, currentTotal) != null;
}

/** Compact per-account totals for influencer_follower_snapshots.accounts. */
export function compactSnapshotAccounts(
  accounts:
    | Array<{
        platform?: string | null;
        username?: string | null;
        followers?: string | number | null;
      }>
    | null
    | undefined
): Array<{ platform: string; username: string; followers: number }> {
  if (!Array.isArray(accounts)) return [];
  const out: Array<{ platform: string; username: string; followers: number }> = [];
  for (const acc of accounts) {
    const platform = String(acc?.platform || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const username = String(acc?.username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const followers = parseFollowerString(acc?.followers);
    if (!platform || !username || !(followers > 0)) continue;
    out.push({ platform, username, followers });
  }
  return out;
}

/**
 * Insert a follower snapshot for an influencer into the database.
 * @param supabaseAdmin - Supabase admin client
 * @param influencerId - The influencer's ID
 * @param accounts - The influencer's social media accounts (to calculate total followers)
 */
export async function insertFollowerSnapshot(
  supabaseAdmin: any,
  influencerId: string,
  accounts: {
    platform?: string | null;
    username?: string | null;
    followers?: string | number | null;
    posts_count?: string | number | null;
  }[] | null | undefined
): Promise<void> {
  const totalFollowers = totalFollowersFromAccounts(accounts);
  if (totalFollowers <= 0) {
    return;
  }
  
  try {
    const { data: last } = await supabaseAdmin
      .from('influencer_follower_snapshots')
      .select('total_followers')
      .eq('influencer_id', influencerId)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastTotal = last?.total_followers != null ? Number(last.total_followers) : null;
    if (
      lastTotal != null &&
      Number.isFinite(lastTotal) &&
      looksLikeFollowerScaleTypo(lastTotal, totalFollowers) &&
      totalFollowers < lastTotal
    ) {
      return;
    }

    const snapshotAt = new Date().toISOString();
    const totalPosts = totalPostsFromAccounts(accounts);
    const accountRows = compactSnapshotAccounts(accounts);
    const fullRow: Record<string, unknown> = {
      influencer_id: influencerId,
      snapshot_at: snapshotAt,
      total_followers: totalFollowers,
      total_posts: totalPosts > 0 ? totalPosts : null,
      accounts: accountRows.length ? accountRows : null,
    };
    const { error: snapErr } = await supabaseAdmin
      .from('influencer_follower_snapshots')
      .insert(fullRow);
    if (snapErr && /accounts|column/i.test(snapErr.message)) {
      delete fullRow.accounts;
      const { error: retryAccounts } = await supabaseAdmin
        .from('influencer_follower_snapshots')
        .insert(fullRow);
      if (retryAccounts && /total_posts|column/i.test(retryAccounts.message)) {
        await supabaseAdmin.from('influencer_follower_snapshots').insert({
          influencer_id: influencerId,
          snapshot_at: snapshotAt,
          total_followers: totalFollowers,
        });
      } else if (retryAccounts) {
        console.error('Error inserting follower snapshot:', retryAccounts.message);
      }
    } else if (snapErr && /total_posts|column/i.test(snapErr.message)) {
      await supabaseAdmin.from('influencer_follower_snapshots').insert({
        influencer_id: influencerId,
        snapshot_at: snapshotAt,
        total_followers: totalFollowers,
        accounts: accountRows.length ? accountRows : null,
      });
    } else if (snapErr) {
      console.error('Error inserting follower snapshot:', snapErr.message);
    }
  } catch (err) {
    console.error('Error inserting follower snapshot:', err);
  }
}