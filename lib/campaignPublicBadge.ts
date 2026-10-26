/** Public-facing campaign popularity / freshness badge (inline el/en). */

const NEW_CAMPAIGN_DAYS = 7;
const MIN_APPLICATIONS_TO_SHOW = 3;

export function isOpenedWithinDays(openedAt: string | null | undefined, days: number): boolean {
  if (!openedAt) return false;
  const opened = new Date(openedAt).getTime();
  if (Number.isNaN(opened)) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - opened <= ms && Date.now() >= opened;
}

/**
 * ≥3 applications → "X αιτήσεις" / "X applications".
 * Otherwise → "Νέα καμπάνια" / "New campaign" only if opened_at is within 7 days.
 * Never exposes applicant details — count only.
 */
export function campaignPublicBadgeLabel(
  applicationsCount: number | null | undefined,
  openedAt: string | null | undefined,
  lang: "el" | "en"
): string | null {
  const count = typeof applicationsCount === "number" && applicationsCount > 0 ? applicationsCount : 0;
  if (count >= MIN_APPLICATIONS_TO_SHOW) {
    return lang === "el" ? `${count} αιτήσεις` : `${count} applications`;
  }
  if (isOpenedWithinDays(openedAt, NEW_CAMPAIGN_DAYS)) {
    return lang === "el" ? "Νέα καμπάνια" : "New campaign";
  }
  return null;
}
