import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import { adminRestoreDeal } from "@/lib/deliverableAutocancelActions";
import { sendManualDeliverableWarning } from "@/lib/deliverableAutocancelRun";

type Source = "proposal" | "campaign";

function asSource(value: unknown): Source | null {
  return value === "proposal" || value === "campaign" ? value : null;
}

export async function POST(request: Request) {
  const adminUser = await requireAdmin(request);
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "").trim();
  const source = asSource(body.source);
  const id = String(body.id || "").trim();
  if (!source || !id) return NextResponse.json({ error: "source and id required" }, { status: 400 });

  const admin = supabaseService();

  if (action === "warn") {
    const result = await sendManualDeliverableWarning(admin, source, id);
    if (!result.ok) {
      const status = result.error === "not_found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    const result = await adminRestoreDeal(admin, source, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}