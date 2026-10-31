const PREFIX = { el: "Καμπάνια", en: "Campaign" } as const;

/** Service name stored on a campaign invite proposal. */
export function campaignServiceType(title: string, lang: "el" | "en"): string {
  return `${PREFIX[lang]}: ${title}`.slice(0, 120);
}

/**
 * Show a stored invite label in the viewer's language.
 * Other service names are returned unchanged.
 */
export function displayServiceType(value: string | null | undefined, lang: "el" | "en"): string {
  const text = typeof value === "string" ? value : "";
  const match = /^(?:Καμπάνια|Campaign):\s*([\s\S]*)$/.exec(text);
  if (!match) return text;
  return `${PREFIX[lang]}: ${match[1]}`;
}
