/**
 * Central registry of homepage sections.
 *
 * Homepage rendering and /admin/settings «Σειρά sections αρχικής» both read from
 * HOMEPAGE_SECTION_REGISTRY only. Adding / removing / renaming a section here
 * automatically updates the admin reorder panel (titles) and the merge logic
 * (new ids insert at defaultIndex; unknown saved ids are dropped silently).
 *
 * Saved order lives in site_settings key `homepage_section_order` (JSON array
 * of stable ids). See mergeHomepageSectionOrder().
 *
 * Test contract (scripts/homepage-sections.test.mts): every `data-homepage-section`
 * rendered by HomePage must be an id in this registry.
 */

export const HOMEPAGE_SECTION_ORDER_KEY = "homepage_section_order" as const;

export type HomepageSectionId =
  | "hero"
  | "how_it_works"
  | "top_influencers"
  | "open_campaigns"
  | "directory"
  | "brand_cta"
  | "newly_approved"
  | "brand_logos";

export type HomepageSectionDef = {
  id: HomepageSectionId;
  /** Greek / English titles shown in admin and used as section identity labels. */
  title: { el: string; en: string };
  /** Short admin description of what the section contains. */
  description: { el: string; en: string };
  /** Default sort index (0-based). Lower = higher on the page. */
  defaultIndex: number;
  /** When true, section may omit itself at runtime (e.g. no open campaigns). */
  optional?: boolean;
};

/**
 * Default homepage order (post brand_cta ↔ newly_approved swap):
 * hero → how_it_works → top_influencers → open_campaigns → directory →
 * brand_cta («Έχετε Επιχείρηση;») → newly_approved («Νεοί Εγκεκριμένοι Creators») →
 * brand_logos.
 */
export const HOMEPAGE_SECTION_REGISTRY: readonly HomepageSectionDef[] = [
  {
    id: "hero",
    title: { el: "Hero / αναζήτηση", en: "Hero / search" },
    description: {
      el: "Κεντρικό hero με αναζήτηση creators και φωτογραφίες.",
      en: "Main hero with creator search and photos.",
    },
    defaultIndex: 0,
  },
  {
    id: "how_it_works",
    title: { el: "Πώς δουλεύει", en: "How it works" },
    description: {
      el: "Δύο μονοπάτια — για brands και για influencers.",
      en: "Two paths — for brands and for influencers.",
    },
    defaultIndex: 1,
  },
  {
    id: "top_influencers",
    title: { el: "Top Influencers", en: "Top Influencers" },
    description: {
      el: "Carousel κορυφαίων creators βάσει αλληλεπίδρασης.",
      en: "Carousel of top creators by engagement.",
    },
    defaultIndex: 2,
  },
  {
    id: "open_campaigns",
    title: { el: "Ανοιχτές καμπάνιες από brands", en: "Open campaigns from brands" },
    description: {
      el: "Προεπισκόπηση ανοιχτών καμπανιών (κρύβεται αν δεν υπάρχουν).",
      en: "Open campaigns preview (hidden when empty).",
    },
    defaultIndex: 3,
    optional: true,
  },
  {
    id: "directory",
    title: { el: "Κατάλογος Influencers", en: "Influencer Directory" },
    description: {
      el: "Προεπισκόπηση καταλόγου creators στην αρχική.",
      en: "Directory preview of creators on the homepage.",
    },
    defaultIndex: 4,
  },
  {
    id: "brand_cta",
    title: { el: "Έχετε Επιχείρηση;", en: "Are you a Company?" },
    description: {
      el: "CTA εγγραφής επιχείρησης και features για brands.",
      en: "Brand signup CTA and feature highlights.",
    },
    defaultIndex: 5,
  },
  {
    id: "newly_approved",
    title: { el: "Νεοί Εγκεκριμένοι Creators", en: "Newly Approved Creators" },
    description: {
      el: "Carousel νεοεγκεκριμένων creators.",
      en: "Carousel of newly approved creators.",
    },
    defaultIndex: 6,
  },
  {
    id: "brand_logos",
    title: { el: "Συνεργάζονται μαζί μας", en: "Trusted by" },
    description: {
      el: "Marquee λογότυπων brands.",
      en: "Brand logo marquee.",
    },
    defaultIndex: 7,
  },
] as const;

const REGISTRY_BY_ID: ReadonlyMap<HomepageSectionId, HomepageSectionDef> = new Map(
  HOMEPAGE_SECTION_REGISTRY.map((s) => [s.id, s])
);

export function isHomepageSectionId(value: unknown): value is HomepageSectionId {
  return typeof value === "string" && REGISTRY_BY_ID.has(value as HomepageSectionId);
}

export function getHomepageSectionDef(id: HomepageSectionId): HomepageSectionDef {
  const def = REGISTRY_BY_ID.get(id);
  if (!def) throw new Error(`Unknown homepage section: ${id}`);
  return def;
}

/** Default order derived from registry defaultIndex (stable sort by id on ties). */
export function defaultHomepageSectionOrder(): HomepageSectionId[] {
  return [...HOMEPAGE_SECTION_REGISTRY]
    .sort((a, b) => a.defaultIndex - b.defaultIndex || a.id.localeCompare(b.id))
    .map((s) => s.id);
}

/**
 * Merge a saved JSON order with the registry (additive):
 * - unknown / removed ids are dropped silently
 * - registry ids missing from saved order are inserted at their defaultIndex slot
 * - duplicates in saved order keep the first occurrence
 */
export function mergeHomepageSectionOrder(raw: unknown): HomepageSectionId[] {
  const defaults = defaultHomepageSectionOrder();
  const defaultPos = new Map(defaults.map((id, i) => [id, i]));

  const saved: HomepageSectionId[] = [];
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    for (const item of raw) {
      if (!isHomepageSectionId(item) || seen.has(item)) continue;
      seen.add(item);
      saved.push(item);
    }
  }

  if (saved.length === 0) return defaults;

  const present = new Set(saved);
  const missing = defaults.filter((id) => !present.has(id));

  const result = [...saved];
  for (const id of missing) {
    const target = defaultPos.get(id) ?? result.length;
    // Insert so final index is as close as possible to defaultIndex among current items.
    let insertAt = result.length;
    for (let i = 0; i < result.length; i++) {
      const otherPos = defaultPos.get(result[i]) ?? i;
      if (otherPos > target) {
        insertAt = i;
        break;
      }
    }
    result.splice(insertAt, 0, id);
  }
  return result;
}

/** Optional hide list: ids present here are not rendered (order still preserved). */
export function mergeHomepageSectionHidden(raw: unknown): HomepageSectionId[] {
  if (!Array.isArray(raw)) return [];
  const out: HomepageSectionId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isHomepageSectionId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/**
 * Parse DB/json value for homepage_section_order.
 * Accepts a bare string[] (order only) or `{ order: string[], hidden?: string[] }`.
 */
export function parseHomepageSectionOrderSetting(raw: unknown): {
  order: HomepageSectionId[];
  hidden: HomepageSectionId[];
} {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as { order?: unknown; hidden?: unknown };
    return {
      order: mergeHomepageSectionOrder(obj.order),
      hidden: mergeHomepageSectionHidden(obj.hidden),
    };
  }
  return {
    order: mergeHomepageSectionOrder(raw),
    hidden: [],
  };
}

/** Serialize for site_settings jsonb — bare array when nothing is hidden. */
export function serializeHomepageSectionOrderSetting(
  order: HomepageSectionId[],
  hidden: HomepageSectionId[] = []
): HomepageSectionId[] | { order: HomepageSectionId[]; hidden: HomepageSectionId[] } {
  const mergedOrder = mergeHomepageSectionOrder(order);
  const mergedHidden = mergeHomepageSectionHidden(hidden).filter((id) =>
    mergedOrder.includes(id)
  );
  if (mergedHidden.length === 0) return mergedOrder;
  return { order: mergedOrder, hidden: mergedHidden };
}
