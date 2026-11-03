/** Readable diff of an influencer profile change (admin review). Pure; no React. */

export type DiffLine = { label: string; from: string; to: string };
export type FieldDiff = { field: string; label: string; lines: DiffLine[]; notes: string[] };

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
  avatar_url: "Φωτογραφία προφίλ",
  audience_male_percent: "Κοινό: άνδρες %",
  audience_female_percent: "Κοινό: γυναίκες %",
  audience_top_age: "Κύρια ηλικιακή ομάδα",
  birth_date: "Ημερομηνία γέννησης",
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
        lines.push({ label: `${name} ${ACCOUNT_KEYS[k] || k}`, from: show(o[k]), to: show(n[k]) });
      }
    }
    if (n && n.er_suspicious === true && !(o && o.er_suspicious === true)) {
      notes.push(`${name}: σήμανση ύποπτου engagement${n.er_flag_reason ? ` (${show(n.er_flag_reason)})` : ""}`);
    }
  }
  return { lines, notes };
}

function diffList(oldV: unknown, newV: unknown): DiffLine[] {
  const key = (x: unknown) => (isRec(x) ? show(x.url ?? x.link ?? x) : show(x));
  const o = (Array.isArray(oldV) ? oldV : []).map(key);
  const n = (Array.isArray(newV) ? newV : []).map(key);
  const lines: DiffLine[] = [];
  for (const x of n) if (!o.includes(x)) lines.push({ label: "Προστέθηκε", from: "", to: x });
  for (const x of o) if (!n.includes(x)) lines.push({ label: "Αφαιρέθηκε", from: x, to: "" });
  return lines;
}

export function diffProfileChange(fields: string[] | null | undefined, oldValues: Rec | null | undefined, newValues: Rec | null | undefined): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const field of fields || []) {
    const o = parse(oldValues?.[field]);
    const n = parse(newValues?.[field]);
    const label = fieldLabel(field);
    if (field === "accounts") {
      const { lines, notes } = diffAccounts(o, n);
      if (lines.length || notes.length) out.push({ field, label, lines, notes });
      continue;
    }
    if (Array.isArray(o) || Array.isArray(n)) {
      const lines = diffList(o, n);
      if (lines.length) out.push({ field, label, lines, notes: [] });
      continue;
    }
    if (show(o) === show(n)) continue;
    out.push({ field, label, lines: [{ label, from: show(o), to: show(n) }], notes: [] });
  }
  return out;
}
