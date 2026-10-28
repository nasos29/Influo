import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildCatalogBenchmark,
  peerFromAccounts,
  type BenchmarkPeer,
} from "@/lib/catalogBenchmark";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Row = { id: string; accounts: unknown };

const PEER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let peerCache: { at: number; peers: BenchmarkPeer[] } | null = null;

async function loadPeerCache(): Promise<BenchmarkPeer[]> {
  const now = Date.now();
  if (peerCache && now - peerCache.at < PEER_CACHE_TTL_MS) {
    return peerCache.peers;
  }

  const rows: Row[] = [];
  const page = 1000;
  for (let from = 0; from < 8000; from += page) {
    const { data, error } = await supabaseAdmin
      .from("influencers")
      .select("id, accounts")
      .eq("approved", true)
      .range(from, from + page - 1);
    if (error) {
      console.warn("[catalog-benchmark]", error.message);
      break;
    }
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < page) break;
  }

  const peers: BenchmarkPeer[] = [];
  for (const row of rows) {
    const peer = peerFromAccounts(String(row.id), (row.accounts as never) ?? []);
    if (peer) peers.push(peer);
  }

  peerCache = { at: now, peers };
  return peers;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: self, error: selfErr } = await supabaseAdmin
      .from("influencers")
      .select("id, accounts")
      .eq("id", id)
      .maybeSingle();

    if (selfErr || !self) {
      return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
    }

    const peers = await loadPeerCache();
    const benchmark = buildCatalogBenchmark(
      String(self.id),
      (self.accounts as never) ?? [],
      peers
    );

    return NextResponse.json(benchmark, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[catalog-benchmark]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
