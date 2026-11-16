/**
 * Legacy one-click unsubscribe for brand campaign reminder emails.
 * Redirects to the unified notification preferences page (reminders category).
 */

import { NextRequest, NextResponse } from "next/server";
import { parseBrandReminderUnsubToken } from "@/lib/brandCampaignReminderMail";
import { brandReminderPrefsUnsubUrl } from "@/lib/notificationUnsubToken";
import { upsertNotificationPreferences } from "@/lib/notificationPreferences";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const parsed = parseBrandReminderUnsubToken(token);
  if (!parsed) {
    return NextResponse.redirect(new URL("/notifications/preferences", request.url));
  }

  // Best-effort apply reminders off, then send user to the settings page.
  await upsertNotificationPreferences(admin(), "brand", parsed.brandId, {
    reminders_email: false,
  });

  const dest = brandReminderPrefsUnsubUrl(parsed.brandId, parsed.email);
  return NextResponse.redirect(dest);
}
