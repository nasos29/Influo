import { hasAnalyticsConsent } from "@/lib/cookieConsent";

type GtagFn = (...args: unknown[]) => void;

function gtagSafe(): GtagFn | null {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) return null;
  const fn = window.gtag;
  return typeof fn === "function" ? fn : null;
}

export function trackSignUp(role: "creator" | "brand", method: "email" = "email"): void {
  const gtag = gtagSafe();
  if (!gtag) return;
  gtag("event", "sign_up", { method, role });
}