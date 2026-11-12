import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { resolveTikTokAdminSession } from "@/lib/social/tiktokAdminConfig";
import { tiktokSessionErrorResponse } from "@/lib/social/tiktokAdminRoute";
import {
  isMissingSchemaError,
  redactSecrets,
  revokeTikTokAccessToken,
  schemaMissingResponseBody,
} from "@/lib/social/tiktokUnified";
import { decryptSecret } from "@/lib/social/tokenCrypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only TikTok disconnect for TIKTOK_TEST_INFLUENCER_ID.
 * Attempts official revoke, then deactivates the TikTok row and clears encrypted tokens.
 * Never touches Instagram connections (platform = 'tiktok' filter).
 */
export async function POST(request: Request) {
  const session = await resolveTikTokAdminSession(request);
  if (!session.ok) return tiktokSessionErrorResponse(session, "disconnect_failed");

  const { data: row, error } = await supabaseService()
    .from("social_connections")
    .select(
      "id, influencer_id, platform, platform_user_id, encrypted_access_token, encrypted_refresh_token, is_active"
    )
    .eq("influencer_id", session.testInfluencerId)
    .eq("platform", "tiktok")
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return NextResponse.json(schemaMissingResponseBody("disconnect"), { status: 503 });
    }
    console.error("[tt-oauth] disconnect load error", redactSecrets(error.message || ""));
    return NextResponse.json({ error: "disconnect_load_failed" }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({
      ok: true,
      disconnected: false,
      reason: "not_connected",
      revokeAttempted: false,
      revokeOk: null,
      localCleared: false,
    });
  }

  let revokeAttempted = false;
  let revokeOk: boolean | null = null;
  if (row.encrypted_access_token) {
    try {
      const access = decryptSecret(row.encrypted_access_token);
      revokeAttempted = true;
      const revoked = await revokeTikTokAccessToken(access);
      revokeOk = revoked.ok;
      if (!revoked.ok) {
        console.warn("[tt-oauth] revoke failed (continuing local disconnect)", {
          error: redactSecrets(revoked.error),
        });
      }
    } catch (e) {
      revokeAttempted = true;
      revokeOk = false;
      const message = e instanceof Error ? e.message : "revoke_decrypt_failed";
      console.warn("[tt-oauth] revoke skipped", redactSecrets(message));
    }
  }

  const { error: clearErr } = await supabaseService()
    .from("social_connections")
    .update({
      is_active: false,
      encrypted_access_token: "",
      encrypted_refresh_token: null,
      token_expires_at: null,
      refresh_token_expires_at: null,
      last_error: null,
      last_spike_report: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("platform", "tiktok");

  if (clearErr) {
    if (isMissingSchemaError(clearErr)) {
      return NextResponse.json(schemaMissingResponseBody("disconnect_clear"), { status: 503 });
    }
    console.error("[tt-oauth] disconnect clear failed", clearErr.message);
    return NextResponse.json(
      {
        ok: false,
        error: "local_disconnect_failed",
        revokeAttempted,
        revokeOk,
        localCleared: false,
      },
      { status: 500 }
    );
  }

  // encrypted_access_token is NOT NULL in schema — empty string clears usable secret while satisfying NOT NULL.
  // Prefer a second pass that sets a non-decryptable placeholder if empty string rejected by app checks.
  return NextResponse.json({
    ok: true,
    disconnected: true,
    revokeAttempted,
    revokeOk,
    localCleared: true,
    platformUserId: row.platform_user_id,
    note:
      revokeOk === false
        ? "Local TikTok connection cleared; remote revoke did not succeed"
        : "TikTok connection deactivated and tokens cleared",
  });
}
