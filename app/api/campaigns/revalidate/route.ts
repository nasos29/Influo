import { NextRequest, NextResponse } from "next/server";
import { userFromBearer } from "@/lib/apiAuth";
import { revalidatePublicCampaigns } from "@/lib/revalidatePublicCampaigns";

/** Signed-in only: expire public campaign list caches after a client-side change (e.g. withdraw). */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  revalidatePublicCampaigns();
  return NextResponse.json({ ok: true });
}
