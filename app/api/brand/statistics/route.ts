import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { resolveBrandIdForUser } from "@/lib/brandProfile";
import { aggregateBrandStatistics, type BrandStatProposal } from "@/lib/brandStatistics";

const PROPOSAL_COLUMNS =
  "id, influencer_id, status, budget, counter_proposal_budget, counter_proposal_status, agreement_accepted_at, publish_deadline, created_at";

export async function GET(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = supabaseService();
  const brandId = await resolveBrandIdForUser(admin, user);
  if (!brandId) return NextResponse.json({ error: "Brand not found" }, { status: 403 });

  const proposals: BrandStatProposal[] = [];
  for (let from = 0; from < 4000; from += 1000) {
    const { data, error } = await admin
      .from("proposals")
      .select(PROPOSAL_COLUMNS)
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data || []) {
      proposals.push({
        id: String(row.id),
        influencerId: String(row.influencer_id || ""),
        status: String(row.status || ""),
        budget: row.budget,
        counterBudget: row.counter_proposal_budget,
        counterStatus: typeof row.counter_proposal_status === "string" ? row.counter_proposal_status : null,
        agreementAcceptedAt: typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null,
        publishDeadline: typeof row.publish_deadline === "string" ? row.publish_deadline : null,
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      });
    }
    if (!data || data.length < 1000) break;
  }

  const { data: campaigns, error: campaignError } = await admin
    .from("brand_campaigns")
    .select("status")
    .eq("brand_id", brandId)
    .limit(1000);
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });

  const stats = aggregateBrandStatistics(
    proposals,
    (campaigns || []).map((row) => ({ status: String(row.status || "") }))
  );

  const ids = [...new Set(stats.collaborations.map((row) => row.influencerId).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: creators, error: creatorError } = await admin
      .from("influencers")
      .select("id, display_name")
      .in("id", ids);
    if (creatorError) return NextResponse.json({ error: creatorError.message }, { status: 500 });
    for (const row of creators || []) {
      names.set(String(row.id), typeof row.display_name === "string" ? row.display_name : "");
    }
  }

  return NextResponse.json(
    {
      ...stats,
      collaborations: stats.collaborations.map((row) => ({
        id: row.id,
        creator: names.get(row.influencerId) || "",
        amount: row.amount,
        status: row.status,
        date: row.date,
        deadline: row.deadline,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
