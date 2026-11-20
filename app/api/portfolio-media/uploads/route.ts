import { NextRequest, NextResponse } from "next/server";
import {
  MAX_ACTIVE_UPLOADS_PER_CREATOR,
  MAX_UPLOADS_PER_CREATOR_PER_DAY,
  UPLOAD_CHUNK_BYTES,
  portfolioSlotsLeft,
  validateUploadRequest,
} from "@/lib/portfolioUpload";
import { MAX_PORTFOLIO_POSTS } from "@/lib/videoLinks";
import {
  UPLOAD_COLUMNS,
  countInFlightUploads,
  loadPortfolioLinkJobs,
  resolveUploadActor,
  uploadJson,
  type UploadRow,
} from "@/lib/portfolioUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List this creator's recent uploads (for progress / processing state). */
export async function GET(request: NextRequest) {
  const actor = await resolveUploadActor(request, request.nextUrl.searchParams.get("influencerId"));
  if (actor instanceof NextResponse) return actor;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await actor.admin
    .from("creator_media_uploads")
    .select(UPLOAD_COLUMNS)
    .eq("influencer_id", actor.influencerId)
    .neq("status", "cancelled")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: "lookup failed" }, { status: 500 });

  const includeLinks = request.nextUrl.searchParams.get("links") !== "0";
  let links: Awaited<ReturnType<typeof loadPortfolioLinkJobs>> = [];
  if (includeLinks) {
    const { data: inf } = await actor.admin.from("influencers").select("videos").eq("id", actor.influencerId).maybeSingle();
    const videos = Array.isArray(inf?.videos) ? (inf.videos as string[]).map(String) : [];
    links = await loadPortfolioLinkJobs(actor.admin, actor.influencerId, videos);
  }

  return NextResponse.json({
    uploads: ((data || []) as UploadRow[]).map(uploadJson),
    links,
  });
}

/** Start a resumable upload. Body: { fileName, mimeType, size, durationSec?, influencerId? (admin) } */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const actor = await resolveUploadActor(request, typeof body.influencerId === "string" ? body.influencerId : null);
  if (actor instanceof NextResponse) return actor;
  const lang = body.lang === "en" ? "en" : "el";

  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const check = validateUploadRequest({
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    fileName,
    size: Number(body.size),
    durationSec: body.durationSec == null ? null : Number(body.durationSec),
  });
  if (!check.ok) return NextResponse.json({ error: check.message[lang], code: check.code }, { status: 400 });

  const { data: inf, error: infErr } = await actor.admin
    .from("influencers")
    .select("id, videos")
    .eq("id", actor.influencerId)
    .maybeSingle();
  if (infErr || !inf) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  const saved = Array.isArray(inf.videos) ? inf.videos.filter((v: unknown) => String(v || "").trim()).length : 0;
  const inFlight = await countInFlightUploads(actor.admin, actor.influencerId);
  if (portfolioSlotsLeft(saved, inFlight, MAX_PORTFOLIO_POSTS) <= 0) {
    return NextResponse.json(
      {
        error:
          lang === "en"
            ? `Your portfolio is full (${MAX_PORTFOLIO_POSTS} items in total). Remove an item first.`
            : `Το portfolio είναι γεμάτο (${MAX_PORTFOLIO_POSTS} στοιχεία συνολικά). Αφαίρεσε πρώτα ένα.`,
        code: "full",
      },
      { status: 409 }
    );
  }
  if (inFlight >= MAX_ACTIVE_UPLOADS_PER_CREATOR) {
    return NextResponse.json({ error: "Too many uploads in progress", code: "busy" }, { status: 429 });
  }
  if (!actor.isAdmin) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await actor.admin
      .from("creator_media_uploads")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", actor.influencerId)
      .gte("created_at", since);
    if ((count || 0) >= MAX_UPLOADS_PER_CREATOR_PER_DAY) {
      return NextResponse.json(
        {
          error: lang === "en" ? "Too many uploads today. Try again tomorrow." : "Πολλά ανεβάσματα σήμερα. Δοκίμασε ξανά αύριο.",
          code: "rate",
        },
        { status: 429 }
      );
    }
  }

  const durationSec = Number(body.durationSec);
  const { data: row, error } = await actor.admin
    .from("creator_media_uploads")
    .insert({
      influencer_id: actor.influencerId,
      created_by: actor.userId,
      media_type: check.mediaType,
      mime_type: check.mimeType,
      file_name: fileName,
      total_bytes: Math.floor(Number(body.size)),
      chunk_bytes: UPLOAD_CHUNK_BYTES,
      client_duration_ms: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null,
    })
    .select(UPLOAD_COLUMNS)
    .single();
  if (error || !row) return NextResponse.json({ error: "Could not start upload" }, { status: 500 });
  return NextResponse.json({ upload: uploadJson(row as UploadRow) }, { status: 201 });
}
