import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { sevenDaysAgoIso } from "@/lib/adminPaging";
import { parseFollowerString } from "@/lib/parseFollowers";
import { findApprovedDuplicateIds } from "@/lib/socialAccountIdentity";

/** Columns needed by the admin influencers table / row actions (not full profile). */
const LIST_COLUMNS = [
  "id",
  "created_at",
  "display_name",
  "contact_email",
  "avatar_url",
  "location",
  "category",
  "approved",
  "analytics_verified",
  "verified",
  "accounts",
  "auth_user_id",
  "min_rate",
  "hidden_videos",
].join(",");

const PICKER_COLUMNS = [
  "id",
  "display_name",
  "contact_email",
  "auth_user_id",
  "profile_slug",
].join(",");

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Cache whether generated accounts_text exists (optional migration). */
let accountsTextColumn: boolean | null = null;

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = parseInt(raw || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function hasAccountsTextColumn(admin: SupabaseClient): Promise<boolean> {
  if (accountsTextColumn != null) return accountsTextColumn;
  const probe = await admin.from("influencers").select("accounts_text").limit(1);
  accountsTextColumn = !probe.error;
  return accountsTextColumn;
}

function applyStatusFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  status: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (status === "verified") return query.eq("approved", true);
  if (status === "pending") return query.or("approved.is.false,approved.is.null");
  return query;
}

/**
 * Admin influencers list — paginated, filtered/sorted in the DB.
 * Use ?picker=1 for lightweight id/name/email lists (support desk, announcements).
 */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  try {
    const url = request.nextUrl;
    const admin = supabaseService();
    const picker = url.searchParams.get("picker") === "1";

    if (picker) {
      const influencers: Record<string, unknown>[] = [];
      const pageSize = 1000;
      let pickerCols = PICKER_COLUMNS;
      const probe = await admin.from("influencers").select(pickerCols).limit(1);
      if (probe.error && /profile_slug|column/i.test(probe.error.message)) {
        pickerCols = ["id", "display_name", "contact_email", "auth_user_id"].join(",");
      } else if (probe.error) {
        return NextResponse.json({ error: probe.error.message }, { status: 500 });
      }
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await admin
          .from("influencers")
          .select(pickerCols)
          .order("display_name", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const rows = (data || []) as unknown as Record<string, unknown>[];
        influencers.push(...rows);
        if (rows.length < pageSize) break;
      }
      return NextResponse.json(
        { influencers, mode: "picker" },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").toLowerCase();
    const sort = (url.searchParams.get("sort") || "created_at").toLowerCase();
    const orderAsc = (url.searchParams.get("order") || "desc").toLowerCase() === "asc";
    const sortColumn = sort === "display_name" ? "display_name" : "created_at";

    let listQuery = admin
      .from("influencers")
      .select(LIST_COLUMNS, { count: "exact" })
      .order(sortColumn, { ascending: orderAsc })
      .range((page - 1) * pageSize, page * pageSize - 1);

    listQuery = applyStatusFilter(listQuery, status);

    if (q) {
      const pattern = `%${escapeIlike(q)}%`;
      const useAccountsText = await hasAccountsTextColumn(admin);
      // name / email / location (+ username via accounts_text when migration applied)
      listQuery = useAccountsText
        ? listQuery.or(
            `display_name.ilike.${pattern},contact_email.ilike.${pattern},location.ilike.${pattern},accounts_text.ilike.${pattern}`
          )
        : listQuery.or(
            `display_name.ilike.${pattern},contact_email.ilike.${pattern},location.ilike.${pattern}`
          );
    }

    const { data, error, count } = await listQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const since = sevenDaysAgoIso();
    const [
      { count: totalCount, error: totalErr },
      { count: approvedCount, error: approvedErr },
      { count: pendingCount, error: pendingErr },
      { count: analyticsCount, error: analyticsErr },
      { count: recentCount, error: recentErr },
      attentionProbe,
      hiddenProbe,
    ] = await Promise.all([
      admin.from("influencers").select("id", { count: "exact", head: true }),
      admin.from("influencers").select("id", { count: "exact", head: true }).eq("approved", true),
      admin.from("influencers").select("id", { count: "exact", head: true }).or("approved.is.false,approved.is.null"),
      admin.from("influencers").select("id", { count: "exact", head: true }).eq("analytics_verified", true),
      admin.from("influencers").select("id", { count: "exact", head: true }).gte("created_at", since),
      admin
        .from("influencers")
        .select("id, display_name, contact_email, created_at")
        .or("approved.is.false,approved.is.null")
        .order("created_at", { ascending: false })
        .limit(5),
      admin.from("influencers").select("id, display_name, hidden_videos").not("hidden_videos", "eq", "[]"),
    ]);

    if (totalErr || approvedErr || pendingErr || analyticsErr || recentErr) {
      console.error(
        "[admin/influencers] count error",
        totalErr || approvedErr || pendingErr || analyticsErr || recentErr
      );
    }

    let hiddenVideoCount: number | undefined;
    const hiddenByProfile: { id: string; display_name: string; count: number; urls: string[] }[] = [];
    if (!hiddenProbe.error && Array.isArray(hiddenProbe.data)) {
      hiddenVideoCount = 0;
      for (const row of hiddenProbe.data) {
        const list = Array.isArray(row.hidden_videos) ? row.hidden_videos : [];
        const urls = list
          .map((item: unknown) =>
            item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string"
              ? String((item as { url: string }).url)
              : null
          )
          .filter((u: string | null): u is string => !!u);
        if (!urls.length) continue;
        hiddenVideoCount += urls.length;
        hiddenByProfile.push({
          id: String(row.id),
          display_name: typeof row.display_name === "string" ? row.display_name : "",
          count: urls.length,
          urls,
        });
      }
    }

    // Sum followers across all platforms for all influencers (paginated probe).
    let reach: number | undefined;
    {
      const pageSize = 1000;
      let reachSum = 0;
      let reachOk = true;
      for (let from = 0; ; from += pageSize) {
        const { data: reachRows, error: reachErr } = await admin
          .from("influencers")
          .select("accounts")
          .range(from, from + pageSize - 1);
        if (reachErr) {
          console.error("[admin/influencers] reach probe error", reachErr);
          reachOk = false;
          break;
        }
        const rows = reachRows || [];
        for (const row of rows) {
          const accounts = Array.isArray(row.accounts) ? row.accounts : [];
          for (const acc of accounts) {
            const followers =
              acc && typeof acc === "object"
                ? (acc as { followers?: string | number | null }).followers
                : null;
            reachSum += parseFollowerString(followers);
          }
        }
        if (rows.length < pageSize) break;
      }
      if (reachOk) reach = reachSum;
    }

    // Possible-duplicate badge: approved rows sharing IG/TikTok username (no schema change).
    const duplicateIds = new Set<string>();
    {
      const pageSizeDup = 1000;
      const approvedForDup: Array<{ id: string; accounts?: unknown; approved?: boolean | null }> = [];
      for (let from = 0; ; from += pageSizeDup) {
        const { data: dupRows, error: dupErr } = await admin
          .from("influencers")
          .select("id, accounts, approved")
          .eq("approved", true)
          .range(from, from + pageSizeDup - 1);
        if (dupErr) {
          console.error("[admin/influencers] duplicate probe error", dupErr);
          break;
        }
        const rows = (dupRows || []) as Array<{ id: string; accounts?: unknown; approved?: boolean | null }>;
        approvedForDup.push(...rows);
        if (rows.length < pageSizeDup) break;
      }
      for (const id of findApprovedDuplicateIds(approvedForDup)) duplicateIds.add(id);
    }

    const influencers = ((data || []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      possible_duplicate: duplicateIds.has(String(row.id ?? "")),
    }));

    const total = count ?? 0;
    return NextResponse.json(
      {
        influencers,
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        counts: {
          total: totalCount ?? 0,
          approved: approvedCount ?? 0,
          pending: pendingCount ?? 0,
          recent: recentCount ?? 0,
          analyticsVerified: analyticsCount ?? 0,
          ...(typeof hiddenVideoCount === "number" ? { hiddenVideos: hiddenVideoCount } : {}),
          ...(typeof reach === "number" ? { reach } : {}),
        },
        hiddenByProfile,
        attention: attentionProbe.error ? [] : attentionProbe.data || [],
        searchIncludesUsername: await hasAccountsTextColumn(admin),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
