"use client";

import { useEffect } from "react";
import {
  clearChunkReloadToken,
  isStaleChunkError,
  takeChunkReloadToken,
} from "@/lib/chunkLoadError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = `${error?.name || ""} ${error?.message || ""}`;
    if (isStaleChunkError(message) && takeChunkReloadToken()) {
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-slate-900">Κάτι πήγε στραβά</p>
      <p className="text-sm text-slate-600">Something went wrong while loading this page.</p>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white"
        onClick={() => {
          clearChunkReloadToken();
          reset();
          window.location.reload();
        }}
      >
        Ανανέωση / Refresh
      </button>
    </div>
  );
}
