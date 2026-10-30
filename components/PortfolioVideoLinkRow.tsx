"use client";

import SocialEmbedCard from "@/components/SocialEmbedCard";
import {
  detectProvider,
  getVideoEmbedApiUrl,
  isDefinitelyImage,
  isEmbeddableVideoUrl,
} from "@/lib/videoThumbnail";

type Lang = "el" | "en";

const PROFILE_WARN = {
  el: "Αυτό είναι link προφίλ, όχι video. Βάλε link από συγκεκριμένο reel/video/post.",
  en: "This is a profile link, not a video. Paste a link to a specific reel/video/post.",
} as const;

type Props = {
  rowId: string;
  value: string;
  lang?: Lang;
  inputClassName: string;
  canRemove: boolean;
  checking?: boolean;
  checkingLabel?: string;
  error?: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  onPaste?: () => void;
  onRemove: () => void;
  /** signup uses SocialEmbedCard preview; dashboard may pass custom preview */
  showEmbedPreview?: boolean;
};

/**
 * Stable portfolio video URL row — defined outside parent forms so it never remounts on keystroke.
 */
export default function PortfolioVideoLinkRow({
  rowId,
  value,
  lang = "el",
  inputClassName,
  canRemove,
  checking,
  checkingLabel,
  error,
  onChange,
  onBlur,
  onPaste,
  onRemove,
  showEmbedPreview = true,
}: Props) {
  const uiLang = lang === "en" ? "en" : "el";
  const provider = detectProvider(value);
  const embedUrl = provider ? getVideoEmbedApiUrl(value) : null;
  const isImage = isDefinitelyImage(value);
  const isProfileNotVideo =
    !!value.trim() && !!provider && !isImage && !isEmbeddableVideoUrl(value);
  const rejected = !!error;
  const showPreview =
    showEmbedPreview &&
    !rejected &&
    !!value &&
    !!provider &&
    !!embedUrl &&
    !isImage &&
    isEmbeddableVideoUrl(value);

  return (
    <div className="space-y-2" data-video-row={rowId}>
      <div className="flex gap-3">
        <input
          type="text"
          className={inputClassName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onPaste={() => {
            onPaste?.();
          }}
          placeholder="https://..."
          autoComplete="off"
        />
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 font-bold px-2 hover:bg-red-50 rounded"
          >
            ✕
          </button>
        ) : null}
      </div>
      {checking && checkingLabel ? (
        <p className="text-sm text-slate-500 px-1">{checkingLabel}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}
      {isProfileNotVideo && !rejected ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {PROFILE_WARN[uiLang]}
        </p>
      ) : null}
      {showPreview ? (
        <div className="mt-2 w-full max-w-lg">
          <SocialEmbedCard
            provider={provider!}
            originalUrl={value}
            embedUrl={embedUrl!}
            lang={uiLang}
          />
        </div>
      ) : null}
    </div>
  );
}
