export const COOKIE_CONSENT_KEY = "influo_cookie_consent";
export const COOKIE_CONSENT_EVENT = "influo-cookie-consent";
export const COOKIE_OPEN_EVENT = "influo-open-cookie-settings";

export type CookieConsentValue = "accepted" | "rejected";

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === "accepted" || v === "rejected") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === "accepted";
}

export function setCookieConsent(value: CookieConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_OPEN_EVENT));
}
