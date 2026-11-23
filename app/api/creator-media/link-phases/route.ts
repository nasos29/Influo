import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { normalizeSourceUrl } from "@/lib/creatorMedia";
import { loadPortfolioLinkJobs } from "@/lib/portfolioUploadServer";
import {
  isDownloadablePortfolioLinkUrl,
  portfolioLinkSourceKey,
  portfolioLinkUiPhase,
  type PortfolioLinkUiPhase,
} from "@/lib/portfolioHosted";

export const dynamic = "force-dynamic";

/** Public read: pending vs failed vs ready for portfolio download jobs (no errors or internals). */
export async function GET(request: NextRequest) {
  const influencerId = request.nextUrl.searchParams.get("influencerId")?.trim() || "";
  if (!influencerId) {
    return NextResponse.json({ error: "influencerId required" }, { status: 400 });
  }

  const urls = request.nextUrl.searchParams
    .getAll("u")
    .map((u) => String(u || "").trim())
    .filter(Boolean);
  const portfolioUrls = urls.filter(isDownloadablePortfolioLinkUrl);
  if (!portfolioUrls.length) {
    return NextResponse.json({ phases: [] as { sourceKey: string; phase: PortfolioLinkUiPhase }[] });
  }

  const admin = supabaseService();
  const jobs = await loadPortfolioLinkJobs(admin, influencerId, portfolioUrls);
  const jobByKey = new Map(jobs.map((j) => [j.sourceKey, j]));
  const hostedByNorm = new Map<string, boolean>();
  for (const j of jobs) {
    if (j.mediaReady) hostedByNorm.set(normalizeSourceUrl(j.sourceUrl), true);
  }

  const phases = portfolioUrls.map((url) => {
    const sourceKey = portfolioLinkSourceKey(url);
    const job = jobByKey.get(sourceKey);
    const phase = portfolioLinkUiPhase(url, job, hostedByNorm);
    return { sourceKey, phase };
  });

  return NextResponse.json({ phases });
}