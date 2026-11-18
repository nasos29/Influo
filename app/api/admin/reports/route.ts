import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  USER_REPORT_STATUSES,
  userReportReasonLabel,
  userReportStatusLabel,
  type UserReportReason,
  type UserReportStatus,
} from "@/lib/userReports";

type ReportRow = {
  id: string;
  reporter_user_id: string;
  reporter_role: string;
  target_type: string;
  target_id: string;
  reason: string;
  comment: string | null;
  context: string;
  conversation_id: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

async function enrichReports(rows: ReportRow[]) {
  const admin = supabaseService();
  const creatorIds = [...new Set(rows.filter((r) => r.target_type === "creator").map((r) => r.target_id))];
  const brandIds = [...new Set(rows.filter((r) => r.target_type === "brand").map((r) => r.target_id))];

  const [creators, brands] = await Promise.all([
    creatorIds.length
      ? admin.from("influencers").select("id, display_name").in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    brandIds.length
      ? admin.from("brands").select("id, brand_name").in("id", brandIds)
      : Promise.resolve({ data: [] as { id: string; brand_name: string | null }[] }),
  ]);

  const creatorMap = new Map(
    (creators.data || []).map((c) => [String(c.id), (c.display_name as string) || ""])
  );
  const brandMap = new Map(
    (brands.data || []).map((b) => [String(b.id), (b.brand_name as string) || ""])
  );

  return rows.map((r) => {
    const targetName =
      r.target_type === "creator"
        ? creatorMap.get(r.target_id) || r.target_id
        : brandMap.get(r.target_id) || r.target_id;
    const profilePath = r.target_type === "creator" ? `/influencer/${r.target_id}` : null;
    return {
      ...r,
      target_name: targetName,
      profile_path: profilePath,
    };
  });
}

export async function GET(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req);
  if (denied) return denied;

  const status = req.nextUrl.searchParams.get("status");
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 100;

  const admin = supabaseService();
  let q = admin.from("user_reports").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status && status !== "all" && USER_REPORT_STATUSES.includes(status as UserReportStatus)) {
    q = q.eq("status", status);
  }

  const [{ data, error }, { count: newCount }] = await Promise.all([
    q,
    admin.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  if (error) {
    return NextResponse.json({ items: [], newCount: 0, error: error.message }, { status: 500 });
  }

  const items = await enrichReports((data || []) as ReportRow[]);
  return NextResponse.json({ items, newCount: newCount || 0 });
}

export async function PATCH(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    admin_note?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status != null) {
    if (!USER_REPORT_STATUSES.includes(body.status as UserReportStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.admin_note !== undefined) {
    patch.admin_note =
      body.admin_note == null || body.admin_note === ""
        ? null
        : String(body.admin_note).slice(0, 4000);
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseService()
    .from("user_reports")
    .update(patch)
    .eq("id", body.id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [enriched] = await enrichReports([data as ReportRow]);
  return NextResponse.json({
    item: {
      ...enriched,
      reason_label_el: userReportReasonLabel(data.reason as UserReportReason, "el"),
      reason_label_en: userReportReasonLabel(data.reason as UserReportReason, "en"),
      status_label_el: userReportStatusLabel(data.status as UserReportStatus, "el"),
      status_label_en: userReportStatusLabel(data.status as UserReportStatus, "en"),
    },
  });
}