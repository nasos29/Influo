import { NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { deriveMinRate } from "@/lib/servicePackages";

/**
 * Sets influencers.min_rate from the stored rate card / packages.
 * Does not accept a client-supplied amount. Leaves min_rate unchanged
 * when every price is blank or zero.
 * Owner or admin receives the resulting amount; other callers only get ok.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = String(body?.influencerId ?? "").trim();
    if (!influencerId) {
      return NextResponse.json({ error: "influencerId required" }, { status: 400 });
    }

    const user = await userFromBearer(request);
    const admin = supabaseService();
    const { data: row, error: fetchErr } = await admin
      .from("influencers")
      .select("id, auth_user_id, min_rate, rate_card, service_packages")
      .eq("id", influencerId)
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ error: fetchErr?.message || "Not found" }, { status: 404 });
    }

    const ownerId = String(row.auth_user_id || row.id || "");
    const isOwner = !!user && (user.id === influencerId || user.id === ownerId);
    const isAdmin = !!user && (await isAdminUser(user));
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const derived = deriveMinRate(row.service_packages, row.rate_card);
    if (derived == null) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        min_rate: row.min_rate ?? null,
      });
    }

    if (String(row.min_rate ?? "") === derived) {
      return NextResponse.json({ ok: true, unchanged: true, min_rate: derived });
    }

    const { error: updateErr } = await admin
      .from("influencers")
      .update({ min_rate: derived })
      .eq("id", influencerId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, unchanged: false, min_rate: derived });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[influencer/sync-min-rate]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
