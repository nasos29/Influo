import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

/** Λίστα όλων των καμπανιών (service role — προστατεύεται από το UI admin). */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("brand_campaigns")
      .select(
        `
        id,
        brand_id,
        title,
        description,
        budget,
        category,
        status,
        deadline,
        created_at,
        updated_at,
        brands ( brand_name, contact_email, verified )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("brand_campaigns")) {
        return NextResponse.json({
          success: true,
          campaigns: [],
          schemaMissing: true,
        });
      }
      console.error("[admin/campaigns GET]", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      campaigns: data ?? [],
      schemaMissing: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[admin/campaigns GET]", e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/** Διαγραφή καμπάνιας και (μέσω CASCADE) των αιτήσεων. */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const campaignId = body.campaignId as string | undefined;
    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "Missing campaignId" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("brand_campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      console.error("[admin/campaigns DELETE]", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("[admin/campaigns DELETE]", e);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
