import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCatalogBenchmark } from "@/lib/catalogBenchmark";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Row = { id: string; accounts: unknown };

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

    const peers: Row[] = [];
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
      peers.push(...(data as Row[]));
      if (data.length < page) break;
    }

    const benchmark = buildCatalogBenchmark(
      String(self.id),
      (self.accounts as never) ?? [],
      peers.map((p) => ({ id: String(p.id), accounts: (p.accounts as never) ?? [] }))
    );

    return NextResponse.json(benchmark);
  } catch (err) {
    console.error("[catalog-benchmark]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
