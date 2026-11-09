import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, userFromBearer } from "@/lib/apiAuth";
import { SITE_SETTING_META, SITE_SETTING_KEYS } from "@/lib/siteSettings";
import {
  getSiteSettings,
  resetSiteSetting,
  updateSiteSetting,
} from "@/lib/siteSettingsServer";

export const runtime = "nodejs";

/** Admin: full settings + metadata. */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const settings = await getSiteSettings();
  return NextResponse.json({
    settings,
    meta: SITE_SETTING_KEYS.map((key) => SITE_SETTING_META[key]),
  });
}

/** Admin: update one key `{ key, value }` or reset `{ key, reset: true }`. */
export async function PATCH(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  let body: { key?: unknown; value?: unknown; reset?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  const user = await userFromBearer(request);
  const updatedBy = user?.id ?? null;

  const result =
    body.reset === true
      ? await resetSiteSetting(key, updatedBy)
      : await updateSiteSetting(key, body.value, updatedBy);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, settings: result.settings });
}
