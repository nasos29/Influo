/** Client-side persistence for brand tools (checklist, ROI, snippets). */

export type BrandChecklistState = Record<string, boolean>;

export type BrandRoiEntry = {
  id: string;
  campaignName: string;
  spend: number;
  results: string;
  notes: string;
  createdAt: string;
};

export type BrandSnippetsState = {
  outreach: string;
  negotiate: string;
  reminder: string;
  approve: string;
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

export function defaultSnippets(el: boolean): BrandSnippetsState {
  if (el) {
    return {
      outreach:
        "Γεια σας,\n\nΕίμαστε από το [Brand] και μας άρεσε το περιεχόμενό σας. Θα μας ενδιέφερε συνεργασία για [προϊόν/καμπάνια]. Μπορούμε να σας στείλουμε brief;\n\nΕυχαριστώ,\n[Όνομα]",
      negotiate:
        "Ευχαριστούμε για την πρόταση. Το budget μας για αυτή τη συνεργασία είναι έως [Χ]€ για [deliverables]. Μπορούμε να συμφωνήσουμε σε αυτό το εύρος;",
      reminder:
        "Γεια σας — υπενθύμιση για το deliverable της καμπάνιας [όνομα]. Παρακαλούμε ανεβάστε το URL στο Influo όταν είναι έτοιμο.",
      approve:
        "Εγκρίνουμε το deliverable. Ευχαριστούμε για τη συνεργασία — ανυπομονούμε για τα αποτελέσματα.",
    };
  }
  return {
    outreach:
      "Hi,\n\nWe're from [Brand] and love your content. We'd like to collaborate on [product/campaign]. Can we share a brief?\n\nThanks,\n[Name]",
    negotiate:
      "Thanks for the proposal. Our budget for this collab is up to [X]€ for [deliverables]. Can we align on that range?",
    reminder:
      "Hi — friendly reminder on the deliverable for campaign [name]. Please submit the URL in Influo when ready.",
    approve:
      "We've approved the deliverable. Thanks for the collaboration — looking forward to the results.",
  };
}

export function loadSnippets(brandId: string, el: boolean): BrandSnippetsState {
  const base = defaultSnippets(el);
  if (typeof window === "undefined" || !brandId) return base;
  try {
    const raw = localStorage.getItem(key(brandId, "snippets"));
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveSnippets(brandId: string, state: BrandSnippetsState) {
  if (typeof window === "undefined" || !brandId) return;
  localStorage.setItem(key(brandId, "snippets"), JSON.stringify(state));
}

export { CHECKLIST_DEFAULT_KEYS };
