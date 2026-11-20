"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  phaseLabel,
  usePortfolioMediaUpload,
  type PortfolioUploadItem,
  type PortfolioUploadLang,
} from "@/lib/usePortfolioMediaUpload";

type PortfolioUploadContextValue = ReturnType<typeof usePortfolioMediaUpload>;

const PortfolioUploadContext = createContext<PortfolioUploadContextValue | null>(null);

export function usePortfolioUploadContext(): PortfolioUploadContextValue {
  const ctx = useContext(PortfolioUploadContext);
  if (!ctx) {
    throw new Error("usePortfolioUploadContext requires PortfolioUploadProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider (signup uses its own hook instance). */
export function useOptionalPortfolioUploadContext(): PortfolioUploadContextValue | null {
  return useContext(PortfolioUploadContext);
}

function FloatingIndicator({
  lang,
  topSending,
  anyProcessing,
}: {
  lang: PortfolioUploadLang;
  topSending: PortfolioUploadItem | undefined;
  anyProcessing: boolean;
}) {
  const L = (el: string, en: string) => (lang === "en" ? en : el);
  let label = "";
  if (topSending) {
    label =
      topSending.phase === "checking"
        ? L("Ανέβασμα…", "Uploading…")
        : `${L("Ανέβασμα", "Upload")} ${topSending.percent}%`;
  } else if (anyProcessing) {
    label = L("Επεξεργασία…", "Processing…");
  }
  if (!label) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-20 right-4 z-[60] max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-medium text-slate-800 shadow-lg backdrop-blur-sm sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      {label}
      {topSending && (topSending.phase === "sending" || topSending.phase === "paused") ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${topSending.percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function PortfolioUploadProvider({
  influencerId,
  lang = "el",
  deferUntilInfluencerId = false,
  children,
}: {
  influencerId: string | null;
  lang?: PortfolioUploadLang;
  deferUntilInfluencerId?: boolean;
  children: ReactNode;
}) {
  const upload = usePortfolioMediaUpload({ influencerId, lang, deferUntilInfluencerId });

  const showFloat =
  !!influencerId && (upload.topSending !== undefined || upload.anyProcessing);

  return (
    <PortfolioUploadContext.Provider value={upload}>
      {children}
      {showFloat ? (
        <FloatingIndicator
          lang={lang}
          topSending={upload.topSending}
          anyProcessing={upload.anyProcessing}
        />
      ) : null}
    </PortfolioUploadContext.Provider>
  );
}

export { phaseLabel, type PortfolioUploadItem };