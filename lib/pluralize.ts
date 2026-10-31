type Lang = "el" | "en";

/** «1 ανοιχτή καμπάνια» / «N ανοιχτές καμπάνιες» (EN: campaign/campaigns). */
export function openCampaignsLabel(count: number, lang: Lang): string {
  const n = Math.max(0, Math.floor(count));
  if (lang === "el") {
    return n === 1 ? "ανοιχτή καμπάνια" : "ανοιχτές καμπάνιες";
  }
  return n === 1 ? "open campaign" : "open campaigns";
}
