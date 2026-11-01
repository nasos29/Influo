/**
 * One page of the public directory.
 * Simple filters (availability, gender, rating, page) are a PostgREST range
 * plus an exact count. Search and the JSON-derived filters use a short
 * in-process cache of the approved rows, then return only that page.
 * The cache is per Node process (one server on Hetzner).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";
import { getPastBrandsByInfluencerIds } from "@/lib/pastBrands";
import { selectApprovedInfluencers } from "@/lib/loadPublicInfluencers";
import { DIRECTORY_PAGE_COLUMNS, toPublicDirectoryCard } from "@/lib/publicInfluencer";
import {
  DIRECTORY_PAGE_SIZE,
  clampDirectoryPage,
  compareDirectoryOrder,
  directoryCacheKey,
  directoryCandidateFromRow,
  directoryFiltersAreSqlOnly,
  directoryFiltersNeedAccounts,
  matchesDirectoryFilters,
  type DirectoryFilters,
} from "@/lib/directoryQuery";

const CACHE_TTL_MS = 60_000;
const PAGE_CACHE_MAX = 80;

const LIGHT_INDEX_COLUMNS = [
  "id",
  "display_name",
  "bio",
  "category",
  "languages",
  "skills",
  "gender",
  "location",
  "avg_rating",
  "created_at",
  "availability_status",
  "birth_date",
  "analytics_verified",
  "profile_slug",
  "accounts",
  "service_packages",
  "rate_card",
  "min_rate",
] as const;

const HEAVY_INDEX_COLUMNS = [...DIRECTORY_PAGE_COLUMNS, "bio", "birth_date"] as const;

export type DirectoryPageResult = {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  /** Set when an exact package-price cap matched nobody and the cap was widened by 20%. */
  relaxedMax: number | null;
};

type CacheEntry<T> = { at: number; value: T };

let lightIndex: CacheEntry<Record<string, unknown>[]> | null = null;
let lightInflight: Promise<Record<string, unknown>[]> | null = null;
let heavyIndex: CacheEntry<Record<string, unknown>[]> | null = null;
let heavyInflight: Promise<Record<string, unknown>[]> | null = null;
let pastBrandCache: CacheEntry<Map<string, string[]>> | null = null;
let pastBrandInflight: Promise<Map<string, string[]>> | null = null;

const pageCache = new Map<string, CacheEntry<DirectoryPageResult>>();
const pageInflight = new Map<string, Promise<DirectoryPageResult>>();

function fresh<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) return null;
  return entry.value;
}

function rememberPage(key: string, value: DirectoryPageResult) {
  pageCache.set(key, { at: Date.now(), value });
  if (pageCache.size <= PAGE_CACHE_MAX) return;
  const oldest = [...pageCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (oldest) pageCache.delete(oldest[0]);
}

function stripCard(card: Record<string, unknown>): Record<string, unknown> {
  const next = { ...card };
  delete next.bio;
  delete next.bio_en;
  if (!Array.isArray(next.accounts)) return next;
  next.accounts = next.accounts.map((item) => {
    if (!item || typeof item !== "object") return item;
    const { top_posts: _topPosts, ...rest } = item as Record<string, unknown>;
    return rest;
  });
  return next;
}

function toCard(row: Record<string, unknown>, pastBrands: string[]): Record<string, unknown> {
  return stripCard({
    ...toPublicDirectoryCard(row),
    past_brands: pastBrands,
  });
}

async function client(): Promise<SupabaseClient> {
  return supabaseService();
}

async function loadIndex(columns: readonly string[], heavy: boolean): Promise<Record<string, unknown>[]> {
  const cached = fresh(heavy ? heavyIndex : lightIndex);
  if (cached) return cached;
  if (heavy && heavyInflight) return heavyInflight;
  if (!heavy && lightInflight) return lightInflight;

  const pending = (async () => {
    const admin = await client();
    const rows: Record<string, unknown>[] = [];
    const batch = 1000;
    for (let from = 0; ; from += batch) {
      const { rows: part } = await selectApprovedInfluencers(columns, (columnList) =>
        admin
          .from("influencers")
          .select(columnList)
          .eq("approved", true)
          .order("id", { ascending: true })
          .range(from, from + batch - 1)
      );
      rows.push(...part);
      if (part.length < batch) break;
    }
    const entry = { at: Date.now(), value: rows };
    if (heavy) heavyIndex = entry;
    else lightIndex = entry;
    return rows;
  })().finally(() => {
    if (heavy) heavyInflight = null;
    else lightInflight = null;
  });

  if (heavy) heavyInflight = pending;
  else lightInflight = pending;
  return pending;
}

async function pastBrandsFor(ids: string[]): Promise<Map<string, string[]>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  return getPastBrandsByInfluencerIds(unique);
}

async function allPastBrands(): Promise<Map<string, string[]>> {
  const cached = fresh(pastBrandCache);
  if (cached) return cached;
  if (pastBrandInflight) return pastBrandInflight;
  pastBrandInflight = (async () => {
    const admin = await client();
    const ids: string[] = [];
    const batch = 1000;
    for (let from = 0; ; from += batch) {
      const { rows } = await selectApprovedInfluencers(["id"], (columnList) =>
        admin
          .from("influencers")
          .select(columnList)
          .eq("approved", true)
          .order("id", { ascending: true })
          .range(from, from + batch - 1)
      );
      ids.push(...rows.map((row) => String(row.id ?? "")).filter(Boolean));
      if (rows.length < batch) break;
    }
    const map = await pastBrandsFor(ids);
    pastBrandCache = { at: Date.now(), value: map };
    return map;
  })().finally(() => {
    pastBrandInflight = null;
  });
  return pastBrandInflight;
}

function applySqlFilters<T extends { or: (filters: string) => T; eq: (column: string, value: string) => T; gte: (column: string, value: number) => T; not: (column: string, operator: string, value: unknown) => T; neq: (column: string, value: string) => T }>(
  query: T,
  filters: DirectoryFilters
): T {
  if (filters.availability === "available") {
    query = query.or('availability_status.is.null,availability_status.eq."",availability_status.eq.available');
  } else if (filters.availability === "unavailable") {
    query = query.not("availability_status", "is", null).neq("availability_status", "available").neq("availability_status", "");
  }
  if (filters.gender === "Male") query = query.eq("gender", "Male");
  else if (filters.gender === "AI") query = query.or("gender.eq.AI,gender.eq.Other");
  else if (filters.gender === "Female") {
    query = query.or('gender.is.null,gender.eq."",gender.eq.Female,gender.not.in.(Male,AI,Other)');
  }
  if (filters.rating !== "All") {
    const min = parseFloat(filters.rating);
    if (Number.isFinite(min) && min > 0) query = query.gte("avg_rating", min);
  }
  return query;
}

async function fetchSqlRange(filters: DirectoryFilters, from: number, to: number) {
  const admin = await client();
  return selectApprovedInfluencers(DIRECTORY_PAGE_COLUMNS, (columnList) => {
    let query = admin.from("influencers").select(columnList, { count: "exact" }).eq("approved", true);
    query = applySqlFilters(query, filters);
    return query
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, to);
  });
}

async function loadSqlPage(filters: DirectoryFilters, page: number, pageSize: number): Promise<DirectoryPageResult> {
  const from = (page - 1) * pageSize;
  let { rows, total } = await fetchSqlRange(filters, from, from + pageSize - 1);
  const counted = total ?? rows.length;
  let safePage = page;
  if (rows.length === 0 && counted > 0 && page > 1) {
    safePage = clampDirectoryPage(page, counted, pageSize);
    const start = (safePage - 1) * pageSize;
    const again = await fetchSqlRange(filters, start, start + pageSize - 1);
    rows = again.rows;
    total = again.total ?? counted;
  }
  const past = await pastBrandsFor(rows.map((row) => String(row.id ?? "")));
  return {
    data: rows.map((row) => toCard(row, past.get(String(row.id ?? "")) || [])),
    total: total ?? counted,
    page: (total ?? counted) === 0 ? 1 : safePage,
    pageSize,
    relaxedMax: null,
  };
}

async function loadFilteredPage(filters: DirectoryFilters, page: number, pageSize: number): Promise<DirectoryPageResult> {
  const heavy = directoryFiltersNeedAccounts(filters);
  const rows = await loadIndex(heavy ? HEAVY_INDEX_COLUMNS : LIGHT_INDEX_COLUMNS, heavy);
  const past = filters.badge !== "All" ? await allPastBrands() : new Map<string, string[]>();
  const now = Date.now();
  const indexed = rows.map((row) => ({
    row,
    candidate: directoryCandidateFromRow(row, past.get(String(row.id ?? "")) || []),
  }));
  let relaxedMax: number | null = null;
  let matched = indexed
    .filter((item) => matchesDirectoryFilters(item.candidate, filters, now))
    .sort((a, b) => compareDirectoryOrder(a.candidate, b.candidate, now));
  const cap = Number(filters.maxPackagePrice);
  if (matched.length === 0 && Number.isFinite(cap) && cap > 0) {
    const widened = String(Math.ceil(cap * 1.2));
    const again = indexed
      .filter((item) => matchesDirectoryFilters(item.candidate, { ...filters, maxPackagePrice: widened }, now))
      .sort((a, b) => compareDirectoryOrder(a.candidate, b.candidate, now));
    if (again.length > 0) {
      matched = again;
      relaxedMax = Number(widened);
    }
  }

  const total = matched.length;
  const safePage = clampDirectoryPage(page, total, pageSize);
  const slice = total === 0 ? [] : matched.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (!heavy) {
    const ids = slice.map((item) => String(item.row.id ?? "")).filter(Boolean);
    if (ids.length === 0) {
      return { data: [], total, page: 1, pageSize, relaxedMax };
    }
    const admin = await client();
    const { rows: hydrated } = await selectApprovedInfluencers(DIRECTORY_PAGE_COLUMNS, (columnList) =>
      admin.from("influencers").select(columnList).eq("approved", true).in("id", ids)
    );
    const byId = new Map(hydrated.map((row) => [String(row.id ?? ""), row]));
    const pagePast = await pastBrandsFor(ids);
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((row): row is Record<string, unknown> => !!row)
      .map((row) => toCard(row, pagePast.get(String(row.id ?? "")) || []));
    return { data: ordered, total, page: safePage, pageSize, relaxedMax };
  }

  const pagePast = filters.badge === "All"
    ? await pastBrandsFor(slice.map((item) => String(item.row.id ?? "")))
    : past;
  return {
    data: slice.map((item) => toCard(item.row, pagePast.get(String(item.row.id ?? "")) || [])),
    total,
    page: total === 0 ? 1 : safePage,
    pageSize,
    relaxedMax,
  };
}

export async function countDirectoryMatches(filters: DirectoryFilters): Promise<number> {
  const rows = await loadIndex(LIGHT_INDEX_COLUMNS, false);
  const now = Date.now();
  return rows.filter((row) => matchesDirectoryFilters(directoryCandidateFromRow(row, 0), filters, now)).length;
}

export async function loadDirectoryPage(
  filters: DirectoryFilters,
  page = 1,
  pageSize = DIRECTORY_PAGE_SIZE
): Promise<DirectoryPageResult> {
  const size = Math.min(DIRECTORY_PAGE_SIZE, Math.max(1, Math.floor(pageSize) || DIRECTORY_PAGE_SIZE));
  const requested = Math.max(1, Math.floor(page) || 1);
  const key = directoryCacheKey(filters, requested, size);
  const cached = fresh(pageCache.get(key) || null);
  if (cached) return cached;
  const existing = pageInflight.get(key);
  if (existing) return existing;

  const pending = (directoryFiltersAreSqlOnly(filters) ? loadSqlPage(filters, requested, size) : loadFilteredPage(filters, requested, size))
    .then((result) => {
      rememberPage(key, result);
      return result;
    })
    .finally(() => {
      pageInflight.delete(key);
    });
  pageInflight.set(key, pending);
  return pending;
}
