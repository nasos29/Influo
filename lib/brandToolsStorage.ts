/** Client-side persistence for brand tools (checklist, ROI). */

export type BrandChecklistState = Record<string, boolean>;

export type BrandRoiEntry = {
  id: string;
  campaignName: string;
  spend: number;
  results: string;
  notes: string;
  createdAt: string;
};

const CHECKLIST_DEFAULT_KEYS = [
  "brief",
  "budget",
  "creators",
  "deliverables",
  "tracking",
  "legal",
] as const;

export function defaultChecklist(): BrandChecklistState {
  return Object.fromEntries(CHECKLIST_DEFAULT_KEYS.map((k) => [k, false]));
}

function key(brandId: string, suffix: string) {
  return `influo.brandTools.${brandId}.${suffix}`;
}

export function loadChecklist(brandId: string): BrandChecklistState {
  if (typeof window === "undefined" || !brandId) return defaultChecklist();
  try {
    const raw = localStorage.getItem(key(brandId, "checklist"));
    if (!raw) return defaultChecklist();
    return { ...defaultChecklist(), ...JSON.parse(raw) };
  } catch {
    return defaultChecklist();
  }
}

export function saveChecklist(brandId: string, state: BrandChecklistState) {
  if (typeof window === "undefined" || !brandId) return;
  localStorage.setItem(key(brandId, "checklist"), JSON.stringify(state));
}

export function loadRoi(brandId: string): BrandRoiEntry[] {
  if (typeof window === "undefined" || !brandId) return [];
  try {
    const raw = localStorage.getItem(key(brandId, "roi"));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveRoi(brandId: string, entries: BrandRoiEntry[]) {
  if (typeof window === "undefined" || !brandId) return;
  localStorage.setItem(key(brandId, "roi"), JSON.stringify(entries.slice(0, 50)));
}

export { CHECKLIST_DEFAULT_KEYS };
