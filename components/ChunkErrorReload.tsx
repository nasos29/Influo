"use client";

import { useEffect } from "react";
import {
  clearChunkReloadToken,
  isStaleChunkError,
  takeChunkReloadToken,
} from "@/lib/chunkLoadError";

/** One reload after a deploy leaves the browser asking for a chunk that no longer exists. */
export default function ChunkErrorReload() {
  useEffect(() => {
    // Successful mount: allow a later deploy in this tab to auto-reload again.
    clearChunkReloadToken();

    const reload = (message: string) => {
      if (!isStaleChunkError(message)) return;
      if (!takeChunkReloadToken()) return;
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => {
      reload(event.message || String(event.error || ""));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason || "");
      reload(message);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
