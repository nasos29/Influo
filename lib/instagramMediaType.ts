export type InstagramMediaType = "video" | "image";

/**
 * Parse Instagram embed HTML for GraphQL `__typename` (not og:type — that is
 * always "article" for both photos and videos).
 *
 * - GraphVideo → video
 * - GraphImage → image
 * - GraphSidecar → video if any `"is_video":true`, else image
 * - anything else → undefined
 */
export function parseInstagramMediaTypeFromEmbedHtml(
  html: string
): InstagramMediaType | undefined {
  if (!html) return undefined;

  // Prefer an explicit typename near media payload.
  const typeMatch = html.match(/"__typename"\s*:\s*"(GraphVideo|GraphImage|GraphSidecar)"/);
  if (!typeMatch?.[1]) return undefined;

  const typename = typeMatch[1];
  if (typename === "GraphVideo") return "video";
  if (typename === "GraphImage") return "image";

  // GraphSidecar (carousel): any slide with is_video:true → video
  if (/"is_video"\s*:\s*true/.test(html)) return "video";
  return "image";
}
