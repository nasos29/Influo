import { isUgcPackageType, type PackageType } from "@/lib/servicePackages";

const UGC_TEXT = /\bugc\b|user[- ]generated|raw footage|ugc_video|ugc_photo/i;

function extrasRawSelected(extras: unknown): string {
  if (extras == null) return "";
  if (typeof extras === "string") return extras;
  if (Array.isArray(extras)) return extras.map(String).join(" ");
  if (typeof extras === "object") {
    return Object.entries(extras as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k]) => k)
      .join(" ");
  }
  return "";
}

/** True when the collaboration expects a UGC draft before the published post link. */
export function proposalRequiresUgcDraft(input: {
  service_type?: string | null;
  selected_extras?: unknown;
  message?: string | null;
}): boolean {
  const service = String(input.service_type || "");
  if (UGC_TEXT.test(service)) return true;
  const extras = extrasRawSelected(input.selected_extras);
  if (/\braw_footage\b/i.test(extras)) return true;
  if (UGC_TEXT.test(String(input.message || ""))) return true;
  return false;
}

export function campaignRequiresUgcDraft(input: {
  deliverables?: string | null;
  deliverables_en?: string | null;
  platforms?: string[] | null;
}): boolean {
  const text = `${input.deliverables || ""} ${input.deliverables_en || ""}`;
  if (UGC_TEXT.test(text)) return true;
  const platforms = Array.isArray(input.platforms) ? input.platforms : [];
  if (platforms.some((p) => String(p).toLowerCase() === "ugc")) return true;
  return false;
}

export function isUgcPackageTypeSafe(type: string | null | undefined): boolean {
  return isUgcPackageType(type as PackageType);
}