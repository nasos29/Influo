export const HOMEPAGE_SHOWCASE_UPLOAD_PURPOSE = "homepage_showcase" as const;

const UPLOAD_CURATED_RE =
  /^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Curated slot id `upload:<creator_media_upload uuid>`. */
export function parseFeaturedCollaborationUploadId(curatedId: string): string | null {
  const trimmed = curatedId.trim();
  const match = /^upload:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(trimmed);
  return match ? match[1]!.toLowerCase() : null;
}

export function isFeaturedCollaborationUploadCuratedId(value: unknown): boolean {
  return typeof value === "string" && UPLOAD_CURATED_RE.test(value.trim());
}

export function featuredCollaborationUploadCuratedId(uploadId: string): string {
  return `upload:${uploadId.trim().toLowerCase()}`;
}

/** Matches creator_media.source_video_id for a showcase upload. */
export function homepageShowcaseUploadSourceVideoId(uploadId: string): string {
  return `upload-${uploadId.trim().toLowerCase()}`;
}

export function isHomepageShowcaseHostInfluencerUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export const HOMEPAGE_SHOWCASE_UPLOAD_LIMIT_EL = "Έως 500 MB · έως 3 λεπτά (MP4, MOV, WebM).";