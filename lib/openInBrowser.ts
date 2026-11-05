/**
 * Force a URL to open in the system browser (Chrome/Safari), not the installed Influo PWA.
 * Android Chrome hands same-site links to the installed WebAPK/"Open in app"; an explicit
 * Chrome intent bypasses that. Desktop and iOS use a normal new tab.
 */

export function openInSystemBrowser(url: string): void {
  if (typeof window === "undefined") return;

  let absolute = url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === "influo.gr") parsed.hostname = "www.influo.gr";
    absolute = parsed.toString();
  } catch {
    absolute = url;
  }

  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) {
    try {
      const u = new URL(absolute);
      const intent =
        `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
        "#Intent;scheme=https;action=android.intent.action.VIEW;" +
        "category=android.intent.category.BROWSABLE;" +
        "package=com.android.chrome;" +
        `S.browser_fallback_url=${encodeURIComponent(absolute)};end`;
      window.location.href = intent;
      return;
    } catch {
      /* fall through */
    }
  }

  window.open(absolute, "_blank", "noopener,noreferrer");
}

export function handleOpenInBrowserClick(
  event: { preventDefault(): void; stopPropagation(): void },
  url: string
): void {
  event.preventDefault();
  event.stopPropagation();
  openInSystemBrowser(url);
}
