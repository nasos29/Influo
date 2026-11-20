import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadChatActor } from "@/lib/chatActor";
import { normalizeSourceUrl } from "@/lib/creatorMedia";
import {
  isDownloadablePortfolioLinkUrl,
  portfolioLinkSourceKey,
  type PortfolioLinkJob,
} from "@/lib/portfolioHosted";
import { IN_FLIGHT_UPLOAD_STATUSES, PORTFOLIO_UPLOAD_BUCKET, chunkCount, chunkObjectPath } from "@/lib/portfolioUpload";
import { removeUploadStaging } from "@/lib/portfolioUploadStaging";

export type UploadRow = {
  id: string;
  influencer_id: string;
  media_type: "video" | "photo";
  mime_type: string;
  file_name: string | null;
  total_bytes: number;
  chunk_bytes: number;
  received_bytes: number;
  status: string;
  error: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
};

export const UPLOAD_COLUMNS =
  "id, influencer_id, media_type, mime_type, file_name, total_bytes, chunk_bytes, received_bytes, status, error, portfolio_url, created_at, updated_at";

/** Public shape for the client (no internal paths). */
export function uploadJson(row: UploadRow) {
  return {
    id: row.id,
    mediaType: row.media_type,
    fileName: row.file_name,
    totalBytes: Number(row.total_bytes),
    chunkBytes: Number(row.chunk_bytes),
    receivedBytes: Number(row.received_bytes),
    status: row.status,
    error: row.error,
    portfolioUrl: row.status === "ready" ? row.portfolio_url : null,
    createdAt: row.created_at,
  };
}

/**
 * Resolve which creator this request may act for: the signed-in creator, or any creator for an admin
 * (admin passes influencerId). Returns a response on failure.
 */
export async function resolveUploadActor(
  request: Request,
  requestedInfluencerId?: string | null
): Promise<{ admin: SupabaseClient; influencerId: string; userId: string; isAdmin: boolean } | NextResponse> {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requested = String(requestedInfluencerId || "").trim();
  const isAdmin = await isAdminUser(user);
  if (isAdmin && requested) {
    return { admin: supabaseService(), influencerId: requested, userId: user.id, isAdmin };
  }
  const actor = await loadChatActor(user);
  if (!actor.influencerId) return NextResponse.json({ error: "Creator account required" }, { status: 403 });
  if (requested && requested !== actor.influencerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { admin: supabaseService(), influencerId: actor.influencerId, userId: user.id, isAdmin };
}

export async function loadUpload(
  admin: SupabaseClient,
  uploadId: string,
  influencerId: string
): Promise<UploadRow | null> {
  const { data } = await admin
    .from("creator_media_uploads")
    .select(UPLOAD_COLUMNS)
    .eq("id", uploadId)
    .eq("influencer_id", influencerId)
    .maybeSingle();
  return (data as UploadRow | null) || null;
}

export type LinkJobRow = {
  id: string;
  influencer_id: string;
  source_url: string;
  source_url_key: string;
  status: string;
  attempts: number;
  error: string | null;
  next_retry_at: string | null;
  updated_at: string;
};

const LINK_JOB_COLUMNS =
  "id, influencer_id, source_url, source_url_key, status, attempts, error, next_retry_at, updated_at";

export async function loadPortfolioLinkJobs(
  admin: SupabaseClient,
  influencerId: string,
  sourceUrls: string[]
): Promise<PortfolioLinkJob[]> {
  const keys = new Set(
    sourceUrls
      .filter((u) => isDownloadablePortfolioLinkUrl(u))
      .map((u) => portfolioLinkSourceKey(u))
      .filter(Boolean)
  );
  if (!keys.size) return [];

  const { data: jobRows, error: jobErr } = await admin
    .from("creator_media_jobs")
    .select(LINK_JOB_COLUMNS)
    .eq("influencer_id", influencerId)
    .in("source_url_key", [...keys]);
  if (jobErr) return [];

  const norms = new Set(sourceUrls.map((u) => normalizeSourceUrl(u)).filter(Boolean));
  const { data: mediaRows } = await admin
    .from("creator_media")
    .select("source_url, status")
    .eq("influencer_id", influencerId)
    .eq("kind", "portfolio")
    .eq("status", "ready");

  const readyNorms = new Set(
    (mediaRows || [])
      .map((r) => normalizeSourceUrl(String(r.source_url || "")))
      .filter((n) => n && norms.has(n))
  );

  const jobByKey = new Map<string, LinkJobRow>();
  for (const row of (jobRows || []) as LinkJobRow[]) jobByKey.set(row.source_url_key, row);

  const out: PortfolioLinkJob[] = [];
  for (const url of sourceUrls) {
    if (!isDownloadablePortfolioLinkUrl(url)) continue;
    const key = portfolioLinkSourceKey(url);
    const mediaReady = readyNorms.has(normalizeSourceUrl(url));
    const row = jobByKey.get(key);
    if (row) {
      out.push({
        sourceUrl: row.source_url,
        sourceKey: row.source_url_key,
        jobStatus: row.status,
        attempts: Number(row.attempts) || 0,
        error: row.error,
        mediaReady: mediaReady || row.status === "done",
      });
      continue;
    }
    out.push({
      sourceUrl: url,
      sourceKey: key,
      jobStatus: mediaReady ? "done" : "queued",
      attempts: 0,
      error: null,
      mediaReady,
    });
  }
  return out;
}

export async function countInFlightUploads(admin: SupabaseClient, influencerId: string): Promise<number> {
  const { count } = await admin
    .from("creator_media_uploads")
    .select("id", { count: "exact", head: true })
    .eq("influencer_id", influencerId)
    .in("status", [...IN_FLIGHT_UPLOAD_STATUSES]);
  return count || 0;
}

/** Best effort: remove staged chunks for an upload. */
export async function removeUploadChunks(admin: SupabaseClient, row: UploadRow): Promise<void> {
  await removeUploadStaging(row.influencer_id, row.id);
  const paths: string[] = [];
  const n = chunkCount(Number(row.total_bytes), Number(row.chunk_bytes));
  for (let i = 0; i < n; i++) paths.push(chunkObjectPath(row.influencer_id, row.id, i));
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(PORTFOLIO_UPLOAD_BUCKET).remove(paths.slice(i, i + 100)).catch(() => undefined);
  }
}
