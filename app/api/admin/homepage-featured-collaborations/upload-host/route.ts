import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { resolveHomepageShowcaseUploadHostInfluencerId } from "@/lib/homepageShowcaseUploadServer";

export const runtime = "nodejs";

/** Admin: influencer id used as storage prefix for homepage showcase direct uploads. */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const admin = supabaseService();
  const influencerId = await resolveHomepageShowcaseUploadHostInfluencerId(admin);
  if (!influencerId) {
    return NextResponse.json(
      { error: "Δεν βρέθηκε creator για αποθήκευση showcase (ρύθμισε HOMEPAGE_SHOWCASE_UPLOAD_INFLUENCER_ID)." },
      { status: 503 }
    );
  }
  return NextResponse.json({ influencerId });
}