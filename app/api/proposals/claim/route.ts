import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { requireActor } from "@/lib/proposalAccess";

/** Attaches guest proposals to the brand account that owns this email. */
export async function POST(request: Request) {
  try {
    const session = await requireActor(request);
    if (!session?.actor.brandId || !session.actor.brandEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { error } = await supabaseService()
      .from("proposals")
      .update({ brand_id: session.actor.brandId })
      .ilike("brand_email", session.actor.brandEmail)
      .is("brand_id", null);
    if (error && !/brand_id/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not link proposals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
