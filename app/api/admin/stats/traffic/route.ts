import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/apiAuth";
import { getGa4TrafficPayload } from "@/lib/ga4Traffic";

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const traffic = await getGa4TrafficPayload();
  return NextResponse.json(traffic, { headers: CACHE_HEADERS });
}