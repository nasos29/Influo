"use client";

import VideoThumbnail from "@/components/VideoThumbnail";
import PlatformBrandIcon from "@/components/PlatformBrandIcon";

type Provider = "instagram" | "tiktok";

const COPY = {
  preparing: { el: "Προετοιμασία βίντεο…", en: "Preparing video…" },
} as const;

const COLORS: Record<Provider, string> = {
  instagram: "from-purple-600 to-pink-600",
  tiktok: "from-black to-gray-900",
};

export default function PendingHostedSocialCard({
  provider,
  url,
  lang = "el",
}: {
  provider: Provider;
  url: string;
  lang?: "el" | "en";
}) {
  const uiLang = lang === "en" ? "en" : "el";
  return (
    <div className="w-full max-w-full">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md w-full max-w-full">
        <div
          className="relative w-full overflow-hidden bg-slate-100"
          style={{ aspectRatio: provider === "tiktok" ? "9 / 16" : "4 / 5", minHeight: 300 }}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${COLORS[provider]} opacity-20`}
            aria-hidden
          />
          <VideoThumbnail url={url} alt="" fill className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10">
            <PlatformBrandIcon platform={provider} className="h-5 w-5 shrink-0 text-white" />
            <p className="text-xs font-medium text-white">{COPY.preparing[uiLang]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}