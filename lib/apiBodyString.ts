/** Coerce JSON body fields to string without `String(object)` → "[object Object]". */
export function apiBodyString(value: unknown): string {
  return typeof value === "string" ? value : "";
}