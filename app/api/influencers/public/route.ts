import { NextRequest, NextResponse } from "next/server";
import { loadDirectoryPage } from "@/lib/directoryPage";
import { DIRECTORY_PAGE_SIZE, parseDirectoryFilters } from "@/lib/directoryQuery";

export const runtime = "nodejs";

/**
 * One page of approved influencers for /directory.
 * Filters, sort, and the result count run here. The database call is a
 * range/limit for the simple filters, or a cached scan when a filter needs
 * account JSON, then only this page is returned.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const filters = parseDirectoryFilters(params);
    const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
    const requestedSize = parseInt(params.get("pageSize") || String(DIRECTORY_PAGE_SIZE), 10);
    const pageSize = Math.min(
      DIRECTORY_PAGE_SIZE,
      Math.max(1, Number.isFinite(requestedSize) ? requestedSize : DIRECTORY_PAGE_SIZE)
    );
    const result = await loadDirectoryPage(filters, page, pageSize);
    const body = JSON.stringify(result);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        "X-Directory-Bytes": String(Buffer.byteLength(body)),
      },
    });
  } catch (err: unknown) {
    console.error("[API /api/influencers/public] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
