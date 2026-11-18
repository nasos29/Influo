"use client";

import { useEffect } from "react";
import {
  clearChunkReloadToken,
  isStaleChunkError,
  takeChunkReloadToken,
} from "@/lib/chunkLoadError";

export default function GlobalError({
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
    <html lang="el">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600 }}>Κάτι πήγε στραβά</p>
          <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.85 }}>
            Something went wrong while loading the page.
          </p>
          <button
            type="button"
            onClick={() => {
              clearChunkReloadToken();
              reset();
              window.location.reload();
            }}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              border: 0,
              borderRadius: 999,
              background: "#fff",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ανανέωση / Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
