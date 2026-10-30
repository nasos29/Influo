/** Coarse type used by thumbnail cache (carousel photos → image). */
export type InstagramMediaType = "video" | "image";

/** Full embed kind for /api/instagram-video (GraphSidecar → carousel). */
export type InstagramEmbedKind = "video" | "image" | "carousel";

function matchTypename(
  html: string
): "GraphVideo" | "GraphImage" | "GraphSidecar" | null {
  const plain = html.match(
    /"__typename"\s*:\s*"(GraphVideo|GraphImage|GraphSidecar)"/
  );
  if (plain?.[1]) return plain[1] as "GraphVideo" | "GraphImage" | "GraphSidecar";
  const escaped = html.match(
    /\\"__typename\\"\s*:\s*\\"(GraphVideo|GraphImage|GraphSidecar)\\"/
  );
  if (escaped?.[1]) return escaped[1] as "GraphVideo" | "GraphImage" | "GraphSidecar";
  // Crawler /embed HTML (no GraphQL blob): data-media-type="GraphImage"
  const attr = html.match(
    /data-media-type="(GraphVideo|GraphImage|GraphSidecar)"/i
  );
  if (attr?.[1]) {
    const t = attr[1];
    if (t === "GraphVideo" || t === "GraphImage" || t === "GraphSidecar") return t;
  }
  return null;
}

function htmlHasIsVideoTrue(html: string): boolean {
  return (
    /"is_video"\s*:\s*true/.test(html) || /\\"is_video\\"\s*:\s*true/.test(html)
  );
}

/**
 * Parse Instagram embed HTML for GraphQL `__typename`.
 * - GraphVideo → video
 * - GraphImage → image
 * - GraphSidecar → carousel
 */
export function parseInstagramEmbedKindFromHtml(
  html: string
): InstagramEmbedKind | undefined {
  if (!html) return undefined;
  const typename = matchTypename(html);
  if (!typename) {
    // Fallback when typename missing but is_video is present
    if (htmlHasIsVideoTrue(html)) return "video";
    return undefined;
  }
  if (typename === "GraphVideo") return "video";
  if (typename === "GraphImage") return "image";
  return "carousel";
}

/**
 * Thumbnail / playability coarse type (not og:type — that is always "article").
 * GraphSidecar → video if any is_video:true, else image.
 */
export function parseInstagramMediaTypeFromEmbedHtml(
  html: string
): InstagramMediaType | undefined {
  if (!html) return undefined;
  const kind = parseInstagramEmbedKindFromHtml(html);
  if (!kind) return undefined;
  if (kind === "video") return "video";
  if (kind === "image") return "image";
  // carousel
  if (htmlHasIsVideoTrue(html)) return "video";
  return "image";
}
