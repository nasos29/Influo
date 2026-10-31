"use client";

import { useEffect } from "react";

const RELOAD_KEY = "influo-chunk-reload";

function isStaleChunk(message: string): boolean {
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|\/_next\/static\/chunks\//i.test(
    message
  );
}

/** One reload after a deploy leaves the browser asking for a chunk that no longer exists. */
export default function ChunkErrorReload() {
  useEffect(() => {
    const reload = (message: string) => {
      if (!isStaleChunk(message)) return;
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        return;
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => {
      reload(event.message || String(event.error || ""));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason || "");
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
