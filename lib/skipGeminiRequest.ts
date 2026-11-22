export function isSkipGeminiRequest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as { skip_gemini?: unknown }).skip_gemini;
  return value === true || value === 1 || value === "1" || value === "true";
}

export function shouldRunGeminiAudit(opts: {
  skipGemini: boolean;
  didRefreshSocials: boolean;
}): boolean {
  return !opts.skipGemini && opts.didRefreshSocials;
}