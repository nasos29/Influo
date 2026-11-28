"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { featuredCollaborationUploadCuratedId } from "@/lib/homepageShowcaseUpload";
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_PARALLEL_CHUNKS,
  chunkCount,
  isPortfolioPickableFile,
  validateUploadRequest,
} from "@/lib/portfolioUpload";
import {
  chunksRemaining,
  createChunkPumpState,
  markChunkComplete,
  markChunkFailed,
  pickNextChunkIndex,
} from "@/lib/portfolioUploadChunkPump";
import type { ServerUpload } from "@/lib/usePortfolioMediaUpload";

export type SlotVideoUploadPhase = "idle" | "checking" | "sending" | "processing" | "ready" | "failed";

export type SlotVideoUploadState = {
  phase: SlotVideoUploadPhase;
  percent: number;
  message?: string;
};

async function adminBearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function videoDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      const done = (d: number | null) => {
        URL.revokeObjectURL(url);
        resolve(d);
      };
      v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
      v.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}

function putChunk(
  url: string,
  body: Blob,
  token: string,
  onProgress: (sent: number) => void,
  signal: AbortSignal
): Promise<{ status: number; json: { upload?: ServerUpload; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let json = {};
      try {
        json = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* ignore */
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("network"));
    const abort = () => {
      xhr.abort();
      reject(Object.assign(new Error("abort"), { name: "AbortError" }));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One active homepage showcase slot video upload (portfolio chunks + worker). */
export function useHomepageShowcaseSlotVideoUpload() {
  const [hostInfluencerId, setHostInfluencerId] = useState<string | null>(null);
  const hostRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      const token = await adminBearer();
      if (!token) return;
      const res = await fetch("/api/admin/homepage-featured-collaborations/upload-host", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { influencerId?: string };
      if (typeof data.influencerId === "string") {
        hostRef.current = data.influencerId;
        setHostInfluencerId(data.influencerId);
      }
    })();
  }, []);

  const uploadFile = useCallback(
    async (
      file: File,
      onProgress: (state: SlotVideoUploadState) => void
    ): Promise<{ ok: true; curatedId: string } | { ok: false; message: string }> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (!isPortfolioPickableFile(file.type, file.name)) {
        return { ok: false, message: "Επιτρέπονται βίντεο MP4, MOV ή WebM." };
      }

      const hostId = hostRef.current;
      if (!hostId) {
        return { ok: false, message: "Δεν είναι διαθέσιμος ο server αποθήκευσης showcase." };
      }

      onProgress({ phase: "checking", percent: 0 });
      const durationSec = await videoDurationSec(file);
      const check = validateUploadRequest({
        mimeType: file.type,
        fileName: file.name,
        size: file.size,
        durationSec,
      });
      if (!check.ok) {
        onProgress({ phase: "failed", percent: 0, message: check.message.el });
        return { ok: false, message: check.message.el };
      }
      if (check.mediaType !== "video") {
        const msg = "Επιτρέπονται μόνο βίντεο.";
        onProgress({ phase: "failed", percent: 0, message: msg });
        return { ok: false, message: msg };
      }

      const token = await adminBearer();
      if (!token) {
        const msg = "Απαιτείται σύνδεση admin.";
        onProgress({ phase: "failed", percent: 0, message: msg });
        return { ok: false, message: msg };
      }

      const startRes = await fetch("/api/admin/homepage-featured-collaborations/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          durationSec,
        }),
        signal: ctrl.signal,
      });
      const startData = (await startRes.json().catch(() => ({}))) as {
        upload?: ServerUpload;
        influencerId?: string;
        error?: string;
      };
      if (!startRes.ok || !startData.upload) {
        const msg = startData.error || "Αποτυχία έναρξης ανεβάσματος.";
        onProgress({ phase: "failed", percent: 0, message: msg });
        return { ok: false, message: msg };
      }

      const activeHost = startData.influencerId || hostId;
      hostRef.current = activeHost;
      let current = startData.upload;
      const activeQs = `influencerId=${encodeURIComponent(activeHost)}`;

      onProgress({ phase: "sending", percent: 0 });
      try {
        const chunkBytes = current.chunkBytes || UPLOAD_CHUNK_BYTES;
        const totalChunks = chunkCount(current.totalBytes, chunkBytes);
        const pumpState = createChunkPumpState(
          totalChunks,
          UPLOAD_PARALLEL_CHUNKS,
          Math.floor(current.receivedBytes / chunkBytes)
        );
        const inflight = new Map<number, Promise<void>>();
        let failures = 0;

        const sendChunk = async (index: number) => {
          const offset = index * chunkBytes;
          const end = Math.min(offset + chunkBytes, current.totalBytes);
          const { status, json } = await putChunk(
            `/api/portfolio-media/uploads/${current.id}?${activeQs}&offset=${offset}`,
            file.slice(offset, end),
            token,
            (sent) => {
              const pct = Math.floor(((offset + sent) / current.totalBytes) * 100);
              onProgress({ phase: "sending", percent: pct });
            },
            ctrl.signal
          );
          if (status === 200 && json.upload) {
            current = json.upload;
            failures = 0;
            markChunkComplete(pumpState, index);
            onProgress({
              phase: "sending",
              percent: Math.floor((current.receivedBytes / current.totalBytes) * 100),
            });
            return;
          }
          if (status === 409 && json.upload) {
            current = json.upload;
            markChunkComplete(pumpState, index);
            if (current.status !== "uploading") throw Object.assign(new Error("status"), { fatal: true });
            return;
          }
          if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
            throw Object.assign(new Error(json.error || "rejected"), { fatal: true });
          }
          throw new Error("server");
        };

        const pump = async () => {
          for (;;) {
            const idx = pickNextChunkIndex(pumpState);
            if (idx === null) break;
            const job = sendChunk(idx)
              .catch((err) => {
                markChunkFailed(pumpState, idx);
                if ((err as Error).name === "AbortError" || (err as { fatal?: boolean }).fatal) throw err;
                failures += 1;
                if (failures > 8) throw err;
                return sendChunk(idx);
              })
              .finally(() => inflight.delete(idx));
            inflight.set(idx, job);
          }
        };

        await pump();
        while ((current.receivedBytes < current.totalBytes || inflight.size > 0) && chunksRemaining(pumpState)) {
          if (inflight.size > 0) await Promise.race(inflight.values());
          else await pump();
        }
        while (inflight.size > 0) await Promise.race(inflight.values());
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          onProgress({ phase: "idle", percent: 0 });
          return { ok: false, message: "Ακυρώθηκε." };
        }
        const msg = err instanceof Error ? err.message : "Αποτυχία μεταφόρτωσης.";
        onProgress({ phase: "failed", percent: 0, message: msg });
        return { ok: false, message: msg };
      }

      onProgress({ phase: "processing", percent: 100 });

      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (ctrl.signal.aborted) {
          onProgress({ phase: "idle", percent: 0 });
          return { ok: false, message: "Ακυρώθηκε." };
        }
        const st = await fetch(`/api/portfolio-media/uploads/${current.id}?${activeQs}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!st.ok) continue;
        const data = (await st.json()) as { upload?: ServerUpload };
        if (!data.upload) continue;
        current = data.upload;
        if (current.status === "ready") {
          const curatedId = featuredCollaborationUploadCuratedId(current.id);
          onProgress({ phase: "ready", percent: 100 });
          return { ok: true, curatedId };
        }
        if (current.status === "failed") {
          const msg = current.error || "Η επεξεργασία απέτυχε.";
          onProgress({ phase: "failed", percent: 100, message: msg });
          return { ok: false, message: msg };
        }
      }

      const msg = "Η επεξεργασία καθυστερεί — δοκίμασε ξανά σε λίγο.";
      onProgress({ phase: "failed", percent: 100, message: msg });
      return { ok: false, message: msg };
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { hostInfluencerId, uploadFile, cancel };
}