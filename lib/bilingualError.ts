export type BilingualText = { el: string; en: string };

/** Prefer `{ message: { el, en } }` from an API body, then a plain `error` string. */
export function responseText(body: unknown, lang: "el" | "en", fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const row = body as { error?: unknown; message?: unknown };
  const message = row.message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const pair = message as { el?: unknown; en?: unknown };
    const picked = lang === "en" ? pair.en : pair.el;
    if (typeof picked === "string" && picked.trim()) return picked;
  }
  if (typeof row.error === "string" && row.error.trim()) return row.error;
  return fallback;
}
