/**
 * site_settings key `homepage_featured_collaboration_views` — public view totals for
 * curated homepage featured collaborations (Athos showcase). Not a SiteSettingKey.
 */

export const HOMEPAGE_FEATURED_COLLABORATION_VIEWS_KEY =
  "homepage_featured_collaboration_views" as const;

export const HOMEPAGE_FEATURED_COLLABORATION_VIEWS_CACHE_TAG =
  "homepage-featured-collaboration-views" as const;

export type FeaturedCollaborationViewsItem = {
  applicationId: string;
  sourceUrl: string;
  views: number;
  fetchedAt: string;
};

export type HomepageFeaturedCollaborationViewsSetting = {
  total: number | null;
  updatedAt: string;
  items: FeaturedCollaborationViewsItem[];
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function nonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 0 || n !== value) return null;
  return n;
}

function parseItem(raw: unknown): FeaturedCollaborationViewsItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const applicationId = row.applicationId;
  const sourceUrl = row.sourceUrl;
  const views = nonNegativeInt(row.views);
  const fetchedAt = row.fetchedAt;
  if (!isUuid(applicationId) || views === null) return null;
  if (typeof sourceUrl !== "string" || !sourceUrl.trim()) return null;
  if (typeof fetchedAt !== "string" || !fetchedAt.trim()) return null;
  return {
    applicationId,
    sourceUrl: sourceUrl.trim(),
    views,
    fetchedAt: fetchedAt.trim(),
  };
}

/** Parse DB/json; returns null when missing or unusable. */
export function parseHomepageFeaturedCollaborationViewsSetting(
  raw: unknown
): HomepageFeaturedCollaborationViewsSetting | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as {
    total?: unknown;
    updatedAt?: unknown;
    items?: unknown;
  };
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt.trim() : "";
  if (!updatedAt) return null;
  const items: FeaturedCollaborationViewsItem[] = [];
  if (Array.isArray(obj.items)) {
    for (const entry of obj.items) {
      const parsed = parseItem(entry);
      if (parsed && !items.some((i) => i.applicationId === parsed.applicationId)) {
        items.push(parsed);
      }
    }
  }
  const storedTotal = obj.total === null ? null : nonNegativeInt(obj.total);
  return { total: storedTotal, updatedAt, items };
}

const itemsByAppId = (items: FeaturedCollaborationViewsItem[]) =>
  new Map(items.map((i) => [i.applicationId, i]));

/**
 * Sum views for the current curated application ids only.
 * Incomplete (any id missing a real views number) => null — never show 0 as a fake total.
 */
export function computeFeaturedCollaborationViewsTotal(
  applicationIds: string[],
  items: FeaturedCollaborationViewsItem[]
): number | null {
  const uniqueIds = [...new Set(applicationIds)].filter(isUuid);
  if (uniqueIds.length === 0) return null;
  const byId = itemsByAppId(items);
  let sum = 0;
  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (!row) return null;
    sum += row.views;
  }
  return sum;
}

export function featuredCollaborationViewsTotal(
  applicationIds: string[],
  setting: HomepageFeaturedCollaborationViewsSetting | null
): number | null {
  if (!setting) return null;
  return computeFeaturedCollaborationViewsTotal(applicationIds, setting.items);
}

export type FeaturedCollaborationViewsMergeInput = {
  applicationId: string;
  url: string;
  views: number | null;
};

/**
 * Merge POST results with last-good rows. Failed fetches (views null) keep prior counts.
 * Successful fetches overwrite even when the new count is lower. Stale application ids are dropped.
 */
export function mergeFeaturedCollaborationViews(
  applicationIds: string[],
  previous: HomepageFeaturedCollaborationViewsSetting | null,
  incoming: FeaturedCollaborationViewsMergeInput[]
): HomepageFeaturedCollaborationViewsSetting {
  const uniqueIds = [...new Set(applicationIds)].filter(isUuid);
  const prevById = itemsByAppId(previous?.items ?? []);
  const incomingById = new Map<string, FeaturedCollaborationViewsMergeInput>();
  for (const row of incoming) {
    if (!isUuid(row.applicationId)) continue;
    if (!incomingById.has(row.applicationId)) incomingById.set(row.applicationId, row);
  }

  const now = new Date().toISOString();
  const items: FeaturedCollaborationViewsItem[] = [];

  for (const applicationId of uniqueIds) {
    const post = incomingById.get(applicationId);
    const prev = prevById.get(applicationId);
    const freshViews = post ? nonNegativeInt(post.views) : null;
    const url =
      (typeof post?.url === "string" && post.url.trim()) ||
      prev?.sourceUrl ||
      "";

    if (freshViews !== null && url) {
      items.push({
        applicationId,
        sourceUrl: url.trim(),
        views: freshViews,
        fetchedAt: now,
      });
    } else if (prev) {
      items.push({ ...prev });
    }
  }

  const total = computeFeaturedCollaborationViewsTotal(uniqueIds, items);
  return { total, updatedAt: now, items };
}