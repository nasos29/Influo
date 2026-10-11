import { NextResponse } from "next/server";
import { runMessageSummaries } from "@/lib/messageSummaryRun";

export const maxDuration = 60;

function assertCron(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function handle(req: Request) {
  const denied = assertCron(req);
  if (denied) return denied;
  try {
    const result = await runMessageSummaries();
    return NextResponse.json({ success: result.errors.length === 0, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Summary cron failed";
    console.error("[message-summary]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
