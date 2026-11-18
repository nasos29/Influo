import { NextResponse } from "next/server";
import { addAdminNotice } from "@/lib/adminNotice";
import type { User } from "@supabase/supabase-js";
import { isAdminUser, isBrandUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { emailAdminUserReport } from "@/lib/userReportAdminEmail";
import {
  parseUserReportSubmit,
  resolveBrandIdForAuthUser,
  resolveBrandIdFromEmail,
  resolveInfluencerIdForAuthUser,
  userReportReasonLabel,
  type UserReportReporterRole,
} from "@/lib/userReports";
import { allowRateLimit, clientIpFromRequest } from "@/lib/simpleRateLimit";

async function resolveReporterRole(user: User): Promise<UserReportReporterRole | null> {
  const admin = supabaseService();
  if (await isAdminUser(user)) return "admin";
  if (await isBrandUser(user)) return "brand";
  const infId = await resolveInfluencerIdForAuthUser(admin, user.id, user.email);
  if (infId) return "creator";
  return null;
}

export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  if (!allowRateLimit("user-reports-user", user.id, 8, 3_600_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!allowRateLimit("user-reports-ip", ip, 24, 3_600_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseUserReportSubmit(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const reporterRole = await resolveReporterRole(user);
  if (!reporterRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = supabaseService();
  let target_id = parsed.value.target_id;
  if (!target_id && parsed.value.brand_email) {
    const resolved = await resolveBrandIdFromEmail(admin, parsed.value.brand_email);
    if (!resolved) {
      return NextResponse.json({ error: "Brand not found" }, { status: 400 });
    }
    target_id = resolved;
  }

  if (parsed.value.target_type === "creator") {
    const ownInf = await resolveInfluencerIdForAuthUser(admin, user.id, user.email);
    if (ownInf && ownInf === target_id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }
    if (user.id === target_id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }
  } else {
    const ownBrand = await resolveBrandIdForAuthUser(admin, user.id, user.email);
    if (ownBrand && ownBrand === target_id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }
    if (user.id === target_id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }
  }

  const { data: openRow } = await admin
    .from("user_reports")
    .select("id")
    .eq("reporter_user_id", user.id)
    .eq("target_type", parsed.value.target_type)
    .eq("target_id", target_id)
    .in("status", ["new", "in_review"])
    .maybeSingle();

  if (openRow?.id) {
    return NextResponse.json(
      {
        error: "open_report_exists",
        message:
          "You already have an open report for this profile. We'll review it soon.",
      },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("user_reports")
    .insert({
      reporter_user_id: user.id,
      reporter_role: reporterRole,
      target_type: parsed.value.target_type,
      target_id,
      reason: parsed.value.reason,
      comment: parsed.value.comment,
      context: parsed.value.context,
      conversation_id: parsed.value.conversation_id,
      status: "new",
    })
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        {
          error: "open_report_exists",
          message:
            "You already have an open report for this profile. We'll review it soon.",
        },
        { status: 409 }
      );
    }
    console.error("[user report insert]", insertError?.code, insertError?.message);
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }

  const reasonEl = userReportReasonLabel(parsed.value.reason, "el");
  await addAdminNotice({
    kind: "user_report",
    title: `Αναφορά: ${reasonEl}`,
    body: null,
    url: "/admin?tab=reports",
    dedupeKey: `user_report:${inserted.id}`,
  });

  let targetLabel: string = parsed.value.target_type;
  if (parsed.value.target_type === "creator") {
    const { data: inf } = await admin.from("influencers").select("display_name").eq("id", target_id).maybeSingle();
    targetLabel = (inf?.display_name as string) || "creator";
  } else {
    const { data: br } = await admin.from("brands").select("brand_name").eq("id", target_id).maybeSingle();
    targetLabel = (br?.brand_name as string) || "brand";
  }

  void emailAdminUserReport({
    reportId: inserted.id,
    reason: parsed.value.reason,
    targetLabel,
    reporterRole,
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}