import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { accountsConflictWithExisting } from "@/lib/socialAccountIdentity";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Before influencer signup: block if Instagram/TikTok username already exists
 * (lowercase, strip @) inside influencers.accounts jsonb. No schema change.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const accounts = Array.isArray(body?.accounts) ? body.accounts : null;
    if (!accounts) {
      return NextResponse.json({ error: "accounts required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("influencers")
      .select("id, accounts");

    if (error) {
      console.error("[check-social-accounts]", error);
      return NextResponse.json({ error: "Failed to check accounts" }, { status: 500 });
    }

    const exists = accountsConflictWithExisting(accounts, data || []);
    return NextResponse.json(
      {
        exists,
        message: exists
          ? "A profile with this account already exists"
          : "Accounts available",
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    console.error("[check-social-accounts]", err);
    const message = err instanceof Error ? err.message : "Failed to check accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
