const TABS_KEY = "influo-open-tabs";

/** Counts open dashboard/chat tabs so one tab closing does not mark the user offline. */
export function presenceTabOpened(): () => boolean {
  if (typeof window === "undefined") return () => false;
  const current = Number(window.localStorage.getItem(TABS_KEY) || "0");
  window.localStorage.setItem(TABS_KEY, String(Number.isFinite(current) ? current + 1 : 1));
  return () => {
    const left = Math.max(0, Number(window.localStorage.getItem(TABS_KEY) || "1") - 1);
    window.localStorage.setItem(TABS_KEY, String(left));
    return left === 0;
  };
}
