import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cronRoute";
import {
  FeaturedCollaborationViewsMergeInput,
  HOMEPAGE_FEATURED_COLLABORATION_VIEWS_CACHE_TAG,
  HOMEPAGE_FEATURED_COLLABORATION_VIEWS_KEY,
  mergeFeaturedCollaborationViews,
  parseHomepageFeaturedCollaborationViewsSetting,
} from "@/lib/homepageFeaturedCollaborationViews";
import { loadFeaturedCollaborationViewPlan } from "@/lib/loadFeaturedCollaborationViewPlan";
import {
  getHomepageFeaturedCollaborationViewsSetting,
  getHomepageFeaturedCollaborationsSetting,
  upsertJsonSiteSetting,
} from "@/lib/siteSettingsServer";

export const maxDuration = 60;

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function parsePostItems(raw: unknown): FeaturedCollaborationViewsMergeInput[] | null {
  if (!Array.isArray(raw)) return null;
  const items: FeaturedCollaborationViewsMergeInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const applicationId = row.applicationId;
    const url = row.url;
    if (!isUuid(applicationId)) continue;
    const viewsRaw = row.views;
    let views: number | null = null;
    if (viewsRaw === null || viewsRaw === undefined) {
      views = null;
    } else if (typeof viewsRaw === "number" && Number.isFinite(viewsRaw)) {
      const n = Math.floor(viewsRaw);
      views = n >= 0 ? n : null;
    } else {
      continue;
    }
    items.push({
      applicationId,
      url: typeof url === "string" ? url.trim() : "",
      views,
    });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const collabConfig = await getHomepageFeaturedCollaborationsSetting();
  const stored = await getHomepageFeaturedCollaborationViewsSetting();
  const plan = await loadFeaturedCollaborationViewPlan(stored?.items, collabConfig);

  return NextResponse.json({
    ok: true,
    applicationIds: plan.applicationIds,
    items: plan.items,
    storedUpdatedAt: stored?.updatedAt ?? null,
  });
}

export async function POST(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = parsePostItems(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { items?: unknown }).items
      : undefined
  );
  if (!items) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }

  const collabConfig = await getHomepageFeaturedCollaborationsSetting();
  const previousRaw = await getHomepageFeaturedCollaborationViewsSetting();
  const merged = mergeFeaturedCollaborationViews(
    collabConfig.applicationIds,
    previousRaw,
    items
  );

  const upsert = await upsertJsonSiteSetting(
    HOMEPAGE_FEATURED_COLLABORATION_VIEWS_KEY,
    merged,
    null,
    {
      extraTags: [HOMEPAGE_FEATURED_COLLABORATION_VIEWS_CACHE_TAG],
      revalidatePaths: ["/", "/en"],
    }
  );

  if (!upsert.ok) {
    return NextResponse.json({ error: upsert.error }, { status: upsert.status });
  }

  const complete = merged.total !== null;
  return NextResponse.json({
    ok: true,
    total: merged.total,
    complete,
    items: merged.items,
    previous: parseHomepageFeaturedCollaborationViewsSetting(upsert.previous),
  });
}