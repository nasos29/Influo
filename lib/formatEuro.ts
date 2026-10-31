export type EuroLang = "el" | "en";

/**
 * Amounts with the euro sign on the right and a space: "50 €", "1.500,50 €".
 */
export function formatEuro(value: number | string | null | undefined, lang: EuroLang = "el"): string {
  if (value == null || value === "") return "—";
  const raw = typeof value === "number" ? value : Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(raw)) return "—";
  const rounded = Math.round(raw * 100) / 100;
  const hasCents = Math.round(Math.abs(rounded) * 100) % 100 !== 0;
  const formatted = rounded.toLocaleString(lang === "el" ? "el-GR" : "en-GB", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} €`;
}
