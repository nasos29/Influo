/**
 * Backfill English translations for open brand campaigns missing *_en fields.
 * Auth: Authorization: Bearer CRON_SECRET.
 * Supports GET (server cron-run.sh) and POST.
 */
import { NextRequest, NextResponse } from "next/server";
import { backfillOpenCampaignsEnglish } from "@/lib/campaignTranslate";
import { isGeminiPaused, GEMINI_PAUSED_MSG } from "@/lib/geminiPause";

export const maxDuration = 120;

async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized. Missing or invalid CRON_SECRET." }, { status: 401 });
  }

  if (isGeminiPaused()) {
    return NextResponse.json({ ok: false, error: GEMINI_PAUSED_MSG }, { status: 503 });
  }

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") || "40");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 40;

  try {
    const result = await backfillOpenCampaignsEnglish(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/campaign-translate-en]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "translate_failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
