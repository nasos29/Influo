/** Readable diff of an influencer profile change (admin review). Pure; no React. */

import { skillLabel } from "@/lib/skills";

export type DiffLine = { label: string; from: string; to: string };
export type FieldDiff = { field: string; label: string; lines: DiffLine[]; notes: string[] };

/** Creator edits to these fields alone do not reset approval. */
export const LOW_RISK_PROFILE_FIELDS = new Set(["skills"]);

export function isLowRiskOnlyProfileChange(fields: string[] | null | undefined): boolean {
  const list = (fields || []).filter(Boolean);
  return list.length > 0 && list.every((f) => LOW_RISK_PROFILE_FIELDS.has(f));
}

const FIELD_LABELS: Record<string, string> = {
  display_name: "Όνομα",
  bio: "Βιογραφικό",
  min_rate: "Ελάχιστη χρέωση",
  location: "Τοποθεσία",
  engagement_rate: "Engagement rate",
  avg_likes: "Μέσος όρος likes",
  category: "Κατηγορία",
  languages: "Γλώσσες",
  gender: "Φύλο",
  accounts: "Social λογαριασμοί",
  videos: "Βίντεο",
  skills: "Δεξιότητες",
  avatar_url: "Φωτογραφία προφίλ",
  audience_male_percent: "Κοινό: άνδρες %",
  audience_female_percent: "Κοινό: γυναίκες %",
  audience_top_age: "Κύρια ηλικιακή ομάδα",
  birth_date: "Ημερομηνία γέννησης",
  service_packages: "Πακέτα υπηρεσιών",
  contact_email: "Email επικοινωνίας",
};

const ACCOUNT_KEYS: Record<string, string> = {
  username: "username",
  followers: "followers",
  avg_likes: "μέσα likes",
  avg_views: "μέσες προβολές",
  avg_comments: "μέσα σχόλια",
  posts_count: "posts",
  engagement_rate: "ER",
  url: "link",
};

/** Account keys the creator types; everything else is computed/technical. */
const USER_ACCOUNT_KEYS = new Set(["username", "followers", "url"]);

/** Internal / computed keys: not shown as changes (flags become a short note). */
const INTERNAL = /^(er_|verified|checked|updated_at|created_at|fetched|last_|source$|id$|_)/;

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(κενό)";
  if (typeof v === "boolean") return v ? "ναι" : "όχι";
  if (Array.isArray(v)) return v.map(show).join(", ") || "(κενό)";
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).map(show).join(" · ");
  const s = String(v);
  return s.length > 140 ? `${s.slice(0, 137)}…` : s;
}

function parse(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!(t.startsWith("[") || t.startsWith("{"))) return v;
  try {
    return JSON.parse(t);
  } catch {
    return v;
  }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

function platformOf(a: Rec): string {
  return String(a.platform || "Λογαριασμός").trim() || "Λογαριασμός";
}

function diffAccounts(oldV: unknown, newV: unknown): { lines: DiffLine[]; notes: string[] } {
  const lines: DiffLine[] = [];
  const notes: string[] = [];
  const index = (list: unknown) => {
    const m = new Map<string, Rec>();
    for (const a of Array.isArray(list) ? list : []) if (isRec(a)) m.set(platformOf(a).toLowerCase(), a);
    return m;
  };
  const before = index(oldV);
  const after = index(newV);
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const o = before.get(key);
    const n = after.get(key);
    const name = platformOf((n || o) as Rec);
    if (!o && n) {
      lines.push({ label: `${name}`, from: "(δεν υπήρχε)", to: `νέος: ${show(n.username)}${n.followers ? `, ${show(n.followers)} followers` : ""}` });
    } else if (o && !n) {
      lines.push({ label: `${name}`, from: show(o.username), to: "(αφαιρέθηκε)" });
    } else if (o && n) {
      for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
        if (INTERNAL.test(k) || k === "platform") continue;
        if (show(o[k]) === show(n[k])) continue;
        // Auto/technical fields going value <-> empty are noise (e.g. is_private: όχι → (κενό)).
        if (!USER_ACCOUNT_KEYS.has(k) && (show(o[k]) === "(κενό)" || show(n[k]) === "(κενό)")) continue;
        lines.push({ label: `${name} ${ACCOUNT_KEYS[k] || k}`, from: show(o[k]), to: show(n[k]) });
      }
    }
    if (n && n.er_suspicious === true && !(o && o.er_suspicious === true)) {
      notes.push(`${name}: σήμανση ύποπτου engagement${n.er_flag_reason ? ` (${show(n.er_flag_reason)})` : ""}`);
    }
  }
  return { lines, notes };
}

function arrayItemLabel(field: string, item: unknown): string {
  if (field === "skills" && typeof item === "string") {
    return skillLabel(item, "el") || item;
  }
  if (isRec(item)) return show(item.url ?? item.link ?? item);
  return show(item);
}

function diffList(field: string, oldV: unknown, newV: unknown): DiffLine[] {
  const o = (Array.isArray(oldV) ? oldV : []).map((x) => arrayItemLabel(field, x));
  const n = (Array.isArray(newV) ? newV : []).map((x) => arrayItemLabel(field, x));
  const lines: DiffLine[] = [];
  for (const x of n) if (!o.includes(x)) lines.push({ label: "Προστέθηκε", from: "", to: x });
  for (const x of o) if (!n.includes(x)) lines.push({ label: "Αφαιρέθηκε", from: x, to: "" });
  return lines;
}

function fallbackLine(label: string, o: unknown, n: unknown): DiffLine[] {
  return [{ label, from: show(o), to: show(n) }];
}

export function diffProfileChange(fields: string[] | null | undefined, oldValues: Rec | null | undefined, newValues: Rec | null | undefined): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of fields || []) {
    const o = parse(oldValues?.[field]);
    const n = parse(newValues?.[field]);
    const label = fieldLabel(field);
    if (field === "accounts") {
      const { lines, notes } = diffAccounts(o, n);
      out.push({
        field,
        label,
        lines: lines.length ? lines : fallbackLine(label, o, n),
        notes,
      });
      continue;
    }
    if (Array.isArray(o) || Array.isArray(n)) {
      const lines = diffList(field, o, n);
      out.push({ field, label, lines: lines.length ? lines : fallbackLine(label, o, n), notes: [] });
      continue;
    }
    out.push({ field, label, lines: [{ label, from: show(o), to: show(n) }], notes: [] });
  }
  return out;
}
