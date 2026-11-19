/**
 * Accepts only age-range strings like "18-24", "25–34", "18 - 24", "18--24", "18/24"
 * with 13 ≤ from < to ≤ 80, or "NN+" with 13–80.
 * Values like "1", "17", "", "?" → false.
 */
const PLUS_RE = /^(\d{1,2})\+$/;
const RANGE_RE = /^(\d{1,2})\s*(?:--|–|-|\/)\s*(\d{1,2})$/;

export function isValidAgeRange(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === "?") return false;

  const plus = PLUS_RE.exec(s);
  if (plus) {
    const n = Number(plus[1]);
    return Number.isInteger(n) && n >= 13 && n <= 80;
  }

  const range = RANGE_RE.exec(s);
  if (!range) return false;
  const from = Number(range[1]);
  const to = Number(range[2]);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  return from >= 13 && from < to && to <= 80;
}

/** Stored in audience_top_age when the creator has no Insights access (personal account). Public profiles still show "?". */
export const AUDIENCE_NO_ACCESS = "no_access";

export type AudienceRow = {
  audience_top_age?: string | null;
  audience_male_percent?: number | null;
  audience_female_percent?: number | null;
};

export type AudiencePayload = {
  audience_male_percent: number | null;
  audience_female_percent: number | null;
  audience_top_age: string | null;
};

export function isAudienceNoAccess(raw: string | null | undefined): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === AUDIENCE_NO_ACCESS;
}

/** Known placeholders meaning the age group is not known. Display these as "?". */
const UNKNOWN_AGE_LABELS = new Set([
  "?",
  "δεν την ξέρουμε",
  "δεν την ξερουμε",
  "we don't know",
  "we don’t know",
  "we don't know it",
  "we don’t know it",
  "we do not know",
  "we do not know it",
  "don't know",
  "don’t know",
  "unknown",
]);

/**
 * Value shown on public profile stats for the top age group.
 * Missing, personal-account opt-out, or "we don't know" placeholders become "?".
 * Real ranges are left as entered (trimmed).
 */
export function displayAudienceTopAge(raw: string | null | undefined): string {
  if (raw == null) return "?";
  const s = String(raw).trim();
  if (!s) return "?";
  if (isAudienceNoAccess(s)) return "?";
  if (UNKNOWN_AGE_LABELS.has(s.toLowerCase())) return "?";
  return s;
}

export function parseGenderPercent(raw: string): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
}

/** True when the creator entered a real age group and a gender split that adds up to 100. */
export function hasAudienceDemographics(row: AudienceRow | null | undefined): boolean {
  if (!row) return false;
  if (isAudienceNoAccess(row.audience_top_age)) return false;
  if (!isValidAgeRange(row.audience_top_age)) return false;
  const male = row.audience_male_percent;
  const female = row.audience_female_percent;
  if (typeof male !== "number" || typeof female !== "number") return false;
  if (!Number.isFinite(male) || !Number.isFinite(female)) return false;
  if (male < 0 || female < 0 || male > 100 || female > 100) return false;
  return male + female === 100;
}

/** Signup / checklist requirement: real demographics, or an explicit personal-account opt-out. */
export function hasAudienceRequirement(row: AudienceRow | null | undefined): boolean {
  if (!row) return false;
  return isAudienceNoAccess(row.audience_top_age) || hasAudienceDemographics(row);
}

export function audienceValidationMessage(
  code: "missing" | "age" | "percent" | "sum",
  lang: "el" | "en"
): string {
  const messages = {
    missing: {
      el: "Συμπλήρωσε την ηλικιακή ομάδα και το ποσοστό ανδρών/γυναικών, ή επίλεξε «Δεν έχω πρόσβαση».",
      en: "Fill in the top age group and the male/female split, or choose “I don’t have access”.",
    },
    age: {
      el: "Η ηλικιακή ομάδα πρέπει να είναι της μορφής 18-24 (ή 45+).",
      en: "The top age group must look like 18-24 (or 45+).",
    },
    percent: {
      el: "Τα ποσοστά ανδρών και γυναικών πρέπει να είναι αριθμοί από 0 έως 100.",
      en: "Male and female percentages must be numbers from 0 to 100.",
    },
    sum: {
      el: "Τα ποσοστά ανδρών και γυναικών πρέπει να αθροίζουν σε 100.",
      en: "Male and female percentages must add up to 100.",
    },
  } as const;
  return messages[code][lang];
}

export function validateAudienceInput(
  input: { noAccess: boolean; male: string; female: string; topAge: string },
  lang: "el" | "en"
): { ok: true; payload: AudiencePayload } | { ok: false; error: string; fields: Array<"male" | "female" | "age"> } {
  if (input.noAccess) {
    return {
      ok: true,
      payload: {
        audience_male_percent: null,
        audience_female_percent: null,
        audience_top_age: AUDIENCE_NO_ACCESS,
      },
    };
  }

  const male = parseGenderPercent(input.male);
  const female = parseGenderPercent(input.female);
  const ageRaw = input.topAge.trim();
  const missingFields: Array<"male" | "female" | "age"> = [];
  if (male == null) missingFields.push("male");
  if (female == null) missingFields.push("female");
  if (!ageRaw) missingFields.push("age");

  if (missingFields.length > 0) {
    const percentMissing = missingFields.includes("male") || missingFields.includes("female");
    const onlyAgeFormat = !percentMissing && ageRaw && !isValidAgeRange(ageRaw);
    if (onlyAgeFormat) {
      return { ok: false, error: audienceValidationMessage("age", lang), fields: ["age"] };
    }
    if (percentMissing && (input.male.trim() || input.female.trim()) && (male == null || female == null)) {
      return { ok: false, error: audienceValidationMessage("percent", lang), fields: missingFields };
    }
    return { ok: false, error: audienceValidationMessage("missing", lang), fields: missingFields };
  }

  if (!isValidAgeRange(ageRaw)) {
    return { ok: false, error: audienceValidationMessage("age", lang), fields: ["age"] };
  }
  if (male! + female! !== 100) {
    return { ok: false, error: audienceValidationMessage("sum", lang), fields: ["male", "female"] };
  }

  return {
    ok: true,
    payload: {
      audience_male_percent: male,
      audience_female_percent: female,
      audience_top_age: ageRaw,
    },
  };
}

export type AudienceMissingKind = "no_access" | "empty";

/** Why a creator is missing usable audience demographics, or null when complete. */
export function audienceMissingKind(row: AudienceRow | null | undefined): AudienceMissingKind | null {
  if (!row) return "empty";
  if (isAudienceNoAccess(row.audience_top_age)) return "no_access";
  if (hasAudienceDemographics(row)) return null;
  return "empty";
}

export type DemographicsListFilter = "all" | "missing" | "no_access" | "empty";

export function parseDemographicsListFilter(raw: string | null | undefined): DemographicsListFilter {
  const v = String(raw || "all").trim().toLowerCase();
  if (v === "missing" || v === "no_access" || v === "empty") return v;
  return "all";
}

export function matchesDemographicsListFilter(
  row: AudienceRow | null | undefined,
  filter: DemographicsListFilter
): boolean {
  if (filter === "all") return true;
  const kind = audienceMissingKind(row);
  if (filter === "missing") return kind !== null;
  return kind === filter;
}
