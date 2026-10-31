import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, userFromBearer } from "@/lib/apiAuth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

async function requireLoggedInAdmin(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await isAdminUser(user))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

type CampaignApplicationRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  message: string | null;
  proposed_price: number | null;
  work_links: string | null;
  created_at: string;
  influencers:
    | { display_name: string | null; avatar_url: string | null }
    | Array<{ display_name: string | null; avatar_url: string | null }>
    | null;
};

/** Λίστα όλων των καμπανιών (service role — μόνο admin). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireLoggedInAdmin(request);
    if (auth.error) return auth.error;

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
        platforms,
        compensation_type,
        deliverables,
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

    const campaigns = data ?? [];
    const ids = campaigns.map((c) => c.id).filter(Boolean);
    const appsByCampaign = new Map<string, CampaignApplicationRow[]>();

    if (ids.length > 0) {
      const { data: apps, error: appsError } = await supabaseAdmin
        .from("campaign_applications")
        .select(
          `
          id,
          campaign_id,
          influencer_id,
          status,
          message,
          proposed_price,
          work_links,
          created_at,
          influencers ( display_name, avatar_url )
        `
        )
        .in("campaign_id", ids)
        .neq("status", "withdrawn")
        .order("created_at", { ascending: false });

      if (appsError) {
        console.error("[admin/campaigns GET applications]", appsError);
      } else {
        for (const row of (apps ?? []) as CampaignApplicationRow[]) {
          const list = appsByCampaign.get(row.campaign_id) || [];
          list.push(row);
          appsByCampaign.set(row.campaign_id, list);
        }
      }
    }

    const withApps = campaigns.map((c) => {
      const applications = appsByCampaign.get(c.id) || [];
      return {
        ...c,
        applications,
        // Same rule as public /campaigns: exclude withdrawn.
        applications_count: applications.length,
      };
    });

    return NextResponse.json({
      success: true,
      campaigns: withApps,
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
    const auth = await requireLoggedInAdmin(request);
    if (auth.error) return auth.error;

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
