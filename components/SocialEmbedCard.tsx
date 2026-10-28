"use client";

import { useCallback, useState } from "react";
import { buildOfficialEmbedUrl } from "@/lib/videoThumbnail";

type Provider = "instagram" | "tiktok" | "youtube";

interface SocialEmbedCardProps {
  provider: Provider;
  originalUrl: string;
  lang?: "el" | "en";
  /** @deprecated Prefer originalUrl; kept for call-site compatibility. */
  embedUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

const COPY = {
  play: { el: "Προβολή βίντεο", en: "Play video" },
  open: { el: "Άνοιγμα στο", en: "Open on" },
  loading: { el: "Φόρτωση", en: "Loading" },
  error: { el: "Αποτυχία φόρτωσης", en: "Failed to load" },
  retry: { el: "Δοκιμή ξανά", en: "Try again" },
} as const;

const NAMES: Record<Provider, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const COLORS: Record<Provider, string> = {
  instagram: "from-purple-600 to-pink-600",
  tiktok: "from-black to-gray-900",
  youtube: "from-red-600 to-red-700",
};

const DEFAULT_DIMENSIONS: Record<Provider, { width: number; height: number }> = {
  instagram: { width: 400, height: 500 },
  tiktok: { width: 400, height: 600 },
  youtube: { width: 560, height: 315 },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTikTokEmbed(originalUrl: string): Promise<string> {
  const apiUrl = `/api/video-embed?url=${encodeURIComponent(originalUrl)}`;
  const attempt = async () => {
    const res = await fetch(apiUrl);
    if (res.status === 429 || res.status >= 500) {
      const err = new Error(`HTTP ${res.status}`);
      (err as Error & { retryable?: boolean }).retryable = true;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { embed_url?: string };
    if (!data.embed_url) throw new Error("Missing embed_url");
    return String(data.embed_url);
  };

  try {
    return await attempt();
  } catch (err) {
    if ((err as { retryable?: boolean })?.retryable) {
      await sleep(1500);
      return attempt();
    }
    throw err;
  }
}

/**
 * Click-to-load social embed facade — iframes mount only after user click
 * to avoid Instagram/TikTok rate limits from simultaneous embeds.
 */
export default function SocialEmbedCard({
  provider,
  originalUrl,
  lang = "el",
  width,
  height,
}: SocialEmbedCardProps) {
  const finalWidth = width || DEFAULT_DIMENSIONS[provider].width;
  const finalHeight = height || DEFAULT_DIMENSIONS[provider].height;
  const uiLang = lang === "en" ? "en" : "el";

  const [activated, setActivated] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const openHref = originalUrl || "#";

  const activate = useCallback(async () => {
    if (loading || iframeSrc) return;
    setError(false);
    setActivated(true);
    setLoading(true);
    try {
      const official = buildOfficialEmbedUrl(originalUrl, { autoplay: true });
      if (official) {
        setIframeSrc(official);
        setLoading(false);
        return;
      }
      const fetched = await fetchTikTokEmbed(originalUrl);
      setIframeSrc(fetched);
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [iframeSrc, loading, originalUrl]);

  return (
    <div className="w-full max-w-full">
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
        <div
          className="relative w-full bg-slate-100"
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
        >
          {!activated || error ? (
            <button
              type="button"
              onClick={() => {
                void activate();
              }}
              className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br ${COLORS[provider]} text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}
              aria-label={COPY.play[uiLang]}
            >
              <span className="text-sm font-semibold tracking-wide uppercase opacity-90">
                {NAMES[provider]}
              </span>
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-base font-bold">
                {error ? COPY.retry[uiLang] : COPY.play[uiLang]}
              </span>
              {error ? (
                <span className="text-xs font-medium text-white/80">{COPY.error[uiLang]}</span>
              ) : null}
            </button>
          ) : null}

          {activated && loading ? (
            <div
              className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br ${COLORS[provider]}`}
            >
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              <span className="text-xs font-medium text-white">
                {COPY.loading[uiLang]} {NAMES[provider]}…
              </span>
            </div>
          ) : null}

          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title={`${NAMES[provider]} video`}
              className="absolute top-0 left-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setError(true)}
            />
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        <a
          href={openHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 underline-offset-2 hover:underline"
        >
          {COPY.open[uiLang]} {NAMES[provider]}
        </a>
      </p>
    </div>
  );
}
