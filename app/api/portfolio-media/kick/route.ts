import { NextRequest, NextResponse } from "next/server";
import { loadChatActor } from "@/lib/chatActor";
import { userFromBearer } from "@/lib/apiAuth";
import { triggerPortfolioMediaWorker } from "@/lib/triggerPortfolioMediaWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Session creator only: nudge the on-host worker to process queued link jobs. */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await loadChatActor(user);
  if (!actor.influencerId) return NextResponse.json({ error: "Creator account required" }, { status: 403 });
  triggerPortfolioMediaWorker("links-only");
  return NextResponse.json({ ok: true });
}