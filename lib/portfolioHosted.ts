import { detectMediaPlatform, normalizeSourceUrl } from "@/lib/creatorMedia";
import { mediaBucket, mediaPublicBaseUrl } from "@/lib/mediaStorage";

/** Direct upload objects (upload-&lt;uuid&gt;/video.mp4|photo.webp). */
const UPLOAD_ITEM_RE =
  /\/creators\/[0-9a-f-]{36}\/portfolio\/upload-[0-9a-f-]{36}\/(video\.mp4|photo\.webp)$/i;

const HOSTED_PORTFOLIO_PATH_RE = /\/creators\/[0-9a-f-]{36}\/portfolio\//i;

const STORAGE_PUBLIC_PORTFOLIO_RE =
  /\/storage\/v1\/object\/public\/[^/]+\/creators\/[0-9a-f-]{36}\/portfolio\//i;

/** Same dedupe key as `creator_media_jobs.source_url_key` / DB `portfolio_link_source_key`. */
export function portfolioLinkSourceKey(url: string): string {
  const trimmed = String(url || "").trim();
  const bare = trimmed.split("#")[0].split("?")[0].replace(/\/+$/, "");
  return bare.replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();
}

/** True for portfolio items that came from a direct upload (stored on our own media storage). */
export function isUploadedPortfolioUrl(url: string | null | undefined): boolean {
  return UPLOAD_ITEM_RE.test(String(url || "").trim());
}

function isOnOurMediaStorageHost(u: string): boolean {
  const base = mediaPublicBaseUrl();
  if (base && u.toLowerCase().startsWith(`${base.replace(/\/+$/, "").toLowerCase()}/`)) {
    return true;
  }
  const bucket = mediaBucket();
  if (bucket && STORAGE_PUBLIC_PORTFOLIO_RE.test(u) && new RegExp(`/object/public/${bucket}/`, "i").test(u)) {
    return true;
  }
  return false;
}

/** Any portfolio folder on our media storage (uploads or hosted TikTok/IG copies). */
export function isSelfHostedPortfolioUrl(url: string | null | undefined): boolean {
  const u = String(url || "").trim();
  if (!u || !isOnOurMediaStorageHost(u)) return false;
  if (UPLOAD_ITEM_RE.test(u) || HOSTED_PORTFOLIO_PATH_RE.test(u)) return true;
  if (STORAGE_PUBLIC_PORTFOLIO_RE.test(u)) return true;
  const base = mediaPublicBaseUrl();
  if (base) {
    const prefix = `${base.replace(/\/+$/, "")}/`;
    const rest = u.slice(prefix.length);
    if (rest.toLowerCase().startsWith(`creators/`) && rest.includes("/portfolio/")) return true;
  }
  return false;
}

export function isPortfolioStillImageUrl(url: string | null | undefined): boolean {
  const u = String(url || "").trim();
  if (!u) return false;
  if (/\/photo\.webp(\?|#|$)/i.test(u)) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)(\?|#|$)/i.test(u);
}

/** TikTok / Instagram portfolio links that the worker may download (not YouTube, not already on our storage). */
export function isDownloadablePortfolioLinkUrl(url: string | null | undefined): boolean {
  const u = String(url || "").trim();
  if (!u || isSelfHostedPortfolioUrl(u) || isPortfolioStillImageUrl(u)) return false;
  const platform = detectMediaPlatform(u);
  return platform === "tiktok" || platform === "instagram";
}

export type PortfolioLinkJob = {
  sourceUrl: string;
  sourceKey: string;
  jobStatus: "queued" | "processing" | "done" | "failed" | string;
  attempts: number;
  error: string | null;
  mediaReady: boolean;
};

export type PortfolioLinkUiPhase = "none" | "pending" | "ready" | "failed";

export function portfolioLinkUiPhase(url: string, job: PortfolioLinkJob | undefined, hostedByNorm: Map<string, boolean>): PortfolioLinkUiPhase {
  if (!isDownloadablePortfolioLinkUrl(url)) return "none";
  const norm = normalizeSourceUrl(url);
  if (hostedByNorm.get(norm) || job?.mediaReady) return "ready";
  if (!job) return "pending";
  if (job.jobStatus === "done") return "ready";
  if (job.jobStatus === "failed" && job.attempts >= 4) return "failed";
  if (job.jobStatus === "failed") return "pending";
  if (job.jobStatus === "queued" || job.jobStatus === "processing") return "pending";
  return "pending";
}

export const PORTFOLIO_LINK_STATUS_COPY = {
  ready: {
    el: "Ανεβασμένο βίντεο, φιλοξενείται στο Influo",
    en: "Uploaded video, hosted on Influo",
  },
  pending: {
    el: "Γίνεται λήψη…",
    en: "Downloading…",
  },
  failed: {
    el: "Δεν ήταν δυνατή η λήψη, θα ξαναδοκιμάσουμε",
    en: "We could not download this yet; we will try again",
  },
} as const;