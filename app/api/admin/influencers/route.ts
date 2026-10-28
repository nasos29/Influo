import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";

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

    const [
      { count: totalCount, error: totalErr },
      { count: approvedCount, error: approvedErr },
      { count: pendingCount, error: pendingErr },
      { count: analyticsCount, error: analyticsErr },
    ] = await Promise.all([
      admin.from("influencers").select("id", { count: "exact", head: true }),
      admin.from("influencers").select("id", { count: "exact", head: true }).eq("approved", true),
      admin.from("influencers").select("id", { count: "exact", head: true }).or("approved.is.false,approved.is.null"),
      admin.from("influencers").select("id", { count: "exact", head: true }).eq("analytics_verified", true),
    ]);

    if (totalErr || approvedErr || pendingErr || analyticsErr) {
      console.error("[admin/influencers] count error", totalErr || approvedErr || pendingErr || analyticsErr);
    }

    const total = count ?? 0;
    return NextResponse.json(
      {
        influencers: data || [],
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        counts: {
          total: totalCount ?? 0,
          approved: approvedCount ?? 0,
          pending: pendingCount ?? 0,
          analyticsVerified: analyticsCount ?? 0,
        },
        searchIncludesUsername: await hasAccountsTextColumn(admin),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
