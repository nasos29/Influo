"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import { UPLOAD_CHUNK_BYTES, UPLOAD_PARALLEL_CHUNKS, chunkCount, validateUploadRequest } from "@/lib/portfolioUpload";
import {
  chunksRemaining,
  createChunkPumpState,
  markChunkComplete,
  markChunkFailed,
  pickNextChunkIndex,
} from "@/lib/portfolioUploadChunkPump";

export type PortfolioUploadLang = "el" | "en";

export type ServerUpload = {
  id: string;
  mediaType: "video" | "photo";
  fileName: string | null;
  totalBytes: number;
  chunkBytes: number;
  receivedBytes: number;
  status: "uploading" | "uploaded" | "processing" | "ready" | "failed" | "cancelled";
  error: string | null;
  portfolioUrl: string | null;
};

export type PortfolioUploadItem = {
  key: string;
  file?: File;
  upload?: ServerUpload;
  name: string;
  /** 0..100 while sending bytes. */
  percent: number;
  phase: "queued" | "checking" | "sending" | "paused" | "processing" | "ready" | "failed" | "cancelled";
  message?: string;
};

const T = (lang: PortfolioUploadLang, el: string, en: string) => (lang === "en" ? en : el);

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

async function authHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

function putChunk(
  url: string,
  body: Blob,
  token: string | null,
  onProgress: (sent: number) => void,
  signal: AbortSignal
): Promise<{ status: number; json: { upload?: ServerUpload; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (token) xhr.setRequestHeader("Authorization", token);
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
    xhr.ontimeout = () => reject(new Error("network"));
    const abort = () => {
      xhr.abort();
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type UsePortfolioMediaUploadOptions = {
  influencerId: string | null;
  lang?: PortfolioUploadLang;
  /** When true, picked files wait in `queued` until `influencerId` is set (signup). */
  deferUntilInfluencerId?: boolean;
};

export function usePortfolioMediaUpload({
  influencerId,
  lang = "el",
  deferUntilInfluencerId = false,
}: UsePortfolioMediaUploadOptions) {
  const [items, setItems] = useState<PortfolioUploadItem[]>([]);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const reported = useRef<Set<string>>(new Set());
  const pendingReadyRef = useRef<Array<{ id: string; url: string }>>([]);
  const onReadyListeners = useRef(new Set<(url: string) => void>());
  const exclusiveOnReady = useRef<((url: string) => void) | null>(null);
  const influencerIdRef = useRef(influencerId);
  influencerIdRef.current = influencerId;

  const flushPendingToListener = useCallback((fn: (url: string) => void) => {
    for (const item of [...pendingReadyRef.current]) {
      if (reported.current.has(item.id)) continue;
      fn(item.url);
      reported.current.add(item.id);
    }
    pendingReadyRef.current = pendingReadyRef.current.filter((p) => !reported.current.has(p.id));
  }, []);

  const deliverReadyUrl = useCallback(
    (id: string, url: string) => {
      if (reported.current.has(id)) return;
      const listeners = onReadyListeners.current;
      if (listeners.size > 0) {
        for (const fn of listeners) fn(url);
        reported.current.add(id);
        pendingReadyRef.current = pendingReadyRef.current.filter((p) => p.id !== id);
        return;
      }
      if (!pendingReadyRef.current.some((p) => p.id === id)) {
        pendingReadyRef.current.push({ id, url });
      }
    },
    []
  );

  const registerOnReady = useCallback(
    (fn: (url: string) => void) => {
      onReadyListeners.current.add(fn);
      flushPendingToListener(fn);
      return () => {
        onReadyListeners.current.delete(fn);
      };
    },
    [flushPendingToListener]
  );

  const setOnReady = useCallback(
    (fn: ((url: string) => void) | null) => {
      const prev = exclusiveOnReady.current;
      if (prev) onReadyListeners.current.delete(prev);
      exclusiveOnReady.current = fn;
      if (fn) {
        onReadyListeners.current.add(fn);
        flushPendingToListener(fn);
      }
    },
    [flushPendingToListener]
  );

  const update = useCallback((key: string, patch: Partial<PortfolioUploadItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  const qs = influencerId ? `influencerId=${encodeURIComponent(influencerId)}` : "";

  useEffect(() => {
    if (!influencerId || !qs) return;
    let cancelled = false;
    sessionFetch(`/api/portfolio-media/uploads?${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { uploads: [] }))
      .then((data: { uploads?: ServerUpload[] }) => {
        if (cancelled) return;
        const open = (data.uploads || []).filter((u) => u.status === "uploaded" || u.status === "processing" || u.status === "failed");
        if (!open.length) return;
        setItems((prev) => [
          ...prev,
          ...open
            .filter((u) => !prev.some((p) => p.upload?.id === u.id))
            .map<PortfolioUploadItem>((u) => ({
              key: u.id,
              upload: u,
              name: u.fileName || (u.mediaType === "video" ? "video" : "photo"),
              percent: 100,
              phase: u.status === "failed" ? "failed" : "processing",
              message: u.status === "failed" ? u.error || undefined : undefined,
            })),
        ]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [qs, influencerId]);

  const processingIds = items.filter((i) => i.phase === "processing" && i.upload).map((i) => i.upload!.id).join(",");
  useEffect(() => {
    if (!processingIds || !qs) return;
    const timer = setInterval(async () => {
      const res = await sessionFetch(`/api/portfolio-media/uploads?${qs}`, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { uploads?: ServerUpload[] };
      for (const u of data.uploads || []) {
        if (!processingIds.includes(u.id)) continue;
        if (u.status === "ready") {
          setItems((prev) => prev.map((it) => (it.upload?.id === u.id ? { ...it, upload: u, phase: "ready" } : it)));
          if (u.portfolioUrl) deliverReadyUrl(u.id, u.portfolioUrl);
        } else if (u.status === "failed") {
          setItems((prev) =>
            prev.map((it) => (it.upload?.id === u.id ? { ...it, upload: u, phase: "failed", message: u.error || undefined } : it))
          );
        }
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [deliverReadyUrl, processingIds, qs]);

  const send = useCallback(
    async (key: string, file: File, upload: ServerUpload, activeId: string) => {
      const activeQs = `influencerId=${encodeURIComponent(activeId)}`;
      const ctrl = new AbortController();
      controllers.current.set(key, ctrl);
      let current = upload;
      let failures = 0;
      update(key, { phase: "sending", upload: current, message: undefined });
      try {
        const chunkBytes = current.chunkBytes || UPLOAD_CHUNK_BYTES;
        const totalChunks = chunkCount(current.totalBytes, chunkBytes);
        const inflight = new Map<number, Promise<void>>();
        const pumpState = createChunkPumpState(
          totalChunks,
          UPLOAD_PARALLEL_CHUNKS,
          Math.floor(current.receivedBytes / chunkBytes)
        );

        const sendChunk = async (index: number) => {
          const offset = index * chunkBytes;
          const end = Math.min(offset + chunkBytes, current.totalBytes);
          const token = await authHeader();
          const { status, json } = await putChunk(
            `/api/portfolio-media/uploads/${current.id}?${activeQs}&offset=${offset}`,
            file.slice(offset, end),
            token,
            (sent) => update(key, { percent: Math.floor(((offset + sent) / current.totalBytes) * 100) }),
            ctrl.signal
          );
          if (status === 200 && json.upload) {
            current = json.upload;
            failures = 0;
            markChunkComplete(pumpState, index);
            update(key, { upload: current, percent: Math.floor((current.receivedBytes / current.totalBytes) * 100) });
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
              .catch(async (err) => {
                markChunkFailed(pumpState, idx);
                if ((err as Error).name === "AbortError" || (err as { fatal?: boolean }).fatal) throw err;
                failures += 1;
                if (failures > 8) throw err;
                update(key, {
                  phase: "paused",
                  message: T(lang, "Η σύνδεση διακόπηκε, συνεχίζω αυτόματα…", "Connection dropped, resuming automatically…"),
                });
                await sleep(Math.min(30000, 1000 * 2 ** failures));
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  await new Promise<void>((r) => window.addEventListener("online", () => r(), { once: true }));
                }
                const st = await sessionFetch(`/api/portfolio-media/uploads/${current.id}?${activeQs}`, { cache: "no-store" }).catch(() => null);
                if (st?.ok) {
                  current = ((await st.json()) as { upload: ServerUpload }).upload;
                  const synced = Math.floor(current.receivedBytes / chunkBytes);
                  for (let i = 0; i < synced && i < totalChunks; i++) {
                    if (!pumpState.completed.has(i)) pumpState.completed.add(i);
                  }
                  if (synced > pumpState.nextIndex) pumpState.nextIndex = synced;
                }
                update(key, { phase: "sending", message: undefined });
                throw err;
              })
              .finally(() => {
                inflight.delete(idx);
              });
            inflight.set(idx, job);
          }
        };

        while ((current.receivedBytes < current.totalBytes || inflight.size > 0) && chunksRemaining(pumpState)) {
          try {
            await pump();
            if (inflight.size === 0) {
              if (current.receivedBytes < current.totalBytes && chunksRemaining(pumpState)) await sleep(50);
              else if (!chunksRemaining(pumpState)) break;
              else continue;
            }
            await Promise.race(inflight.values());
            if (current.status !== "uploading") break;
          } catch (err) {
            if ((err as Error).name === "AbortError" || (err as { fatal?: boolean }).fatal) throw err;
            if (inflight.size === 0) await pump();
          }
        }
        if (current.status === "uploading") {
          const res = await sessionFetch(`/api/portfolio-media/uploads/${current.id}?${activeQs}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete" }),
          });
          const data = (await res.json().catch(() => ({}))) as { upload?: ServerUpload; error?: string };
          if (!res.ok || !data.upload) throw Object.assign(new Error(data.error || "complete failed"), { fatal: true });
          current = data.upload;
        }
        update(key, { upload: current, percent: 100, phase: current.status === "failed" ? "failed" : "processing" });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        update(key, {
          phase: "failed",
          message: (err as Error).message && (err as Error).message !== "network" && (err as Error).message !== "server"
            ? (err as Error).message
            : T(lang, "Το ανέβασμα σταμάτησε. Πάτα «Ξανά» για να συνεχίσει.", "Upload stopped. Tap Retry to continue."),
        });
      } finally {
        controllers.current.delete(key);
      }
    },
    [lang, update]
  );

  const startWithId = useCallback(
    async (key: string, file: File, activeId: string) => {
      update(key, { phase: "checking", file, name: file.name, percent: 0 });
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name);
      const durationSec = isVideo ? await videoDurationSec(file) : null;
      const check = validateUploadRequest({ mimeType: file.type, fileName: file.name, size: file.size, durationSec });
      if (!check.ok) {
        update(key, { phase: "failed", message: check.message[lang] });
        return;
      }
      const res = await sessionFetch("/api/portfolio-media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId: activeId,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          durationSec,
          lang,
        }),
      }).catch(() => null);
      const data = res ? ((await res.json().catch(() => ({}))) as { upload?: ServerUpload; error?: string }) : {};
      if (!res || !res.ok || !data.upload) {
        update(key, {
          phase: "failed",
          message: data.error || T(lang, "Δεν ξεκίνησε το ανέβασμα.", "Could not start the upload."),
        });
        return;
      }
      await send(key, file, data.upload, activeId);
    },
    [lang, send, update]
  );

  const start = useCallback(
    async (file: File) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { key, file, name: file.name, percent: 0, phase: deferUntilInfluencerId && !influencerIdRef.current ? "queued" : "checking" }]);
      const activeId = influencerIdRef.current;
      if (deferUntilInfluencerId && !activeId) return;
      if (!activeId) {
        update(key, {
          phase: "failed",
          message: T(lang, "Δεν βρέθηκε λογαριασμός για ανέβασμα.", "No account found for upload."),
        });
        return;
      }
      await startWithId(key, file, activeId);
    },
    [deferUntilInfluencerId, lang, startWithId, update]
  );

  /** Start all queued items once signup has created the influencer id (non-blocking). */
  const flushQueued = useCallback(
    (activeId: string) => {
      for (const it of items) {
        if (it.phase === "queued" && it.file) void startWithId(it.key, it.file, activeId);
      }
    },
    [items, startWithId]
  );

  const pick = useCallback(
    (files: FileList | null, slotsLeft: number) => {
      if (!files) return;
      const active = items.filter((i) => ["queued", "checking", "sending", "paused", "processing"].includes(i.phase)).length;
      const free = Math.max(0, slotsLeft - active);
      const list = Array.from(files).slice(0, free);
      for (const f of list) void start(f);
    },
    [items, start]
  );

  const cancel = useCallback(
    async (it: PortfolioUploadItem) => {
      controllers.current.get(it.key)?.abort();
      const activeId = influencerIdRef.current;
      if (it.upload && activeId) {
        const activeQs = `influencerId=${encodeURIComponent(activeId)}`;
        await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${activeQs}`, { method: "DELETE" }).catch(() => undefined);
      }
      setItems((prev) => prev.filter((p) => p.key !== it.key));
    },
    []
  );

  const retry = useCallback(
    async (it: PortfolioUploadItem) => {
      const activeId = influencerIdRef.current;
      if (!it.upload) {
        setItems((prev) => prev.filter((p) => p.key !== it.key));
        if (it.file && activeId) void startWithId(it.key, it.file, activeId);
        else if (it.file) void start(it.file);
        return;
      }
      if (!activeId) return;
      const activeQs = `influencerId=${encodeURIComponent(activeId)}`;
      if (it.upload.receivedBytes >= it.upload.totalBytes) {
        const res = await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${activeQs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry" }),
        }).catch(() => null);
        const data = res ? ((await res.json().catch(() => ({}))) as { upload?: ServerUpload }) : {};
        if (data.upload) update(it.key, { upload: data.upload, phase: "processing", message: undefined });
        return;
      }
      if (it.file) {
        const st = await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${activeQs}`, { cache: "no-store" }).catch(() => null);
        const fresh = st?.ok ? ((await st.json()) as { upload: ServerUpload }).upload : it.upload;
        if (fresh.status === "uploading") void send(it.key, it.file, fresh, activeId);
      }
    },
    [send, start, startWithId, update]
  );

  const hasByteTransfer = items.some((i) => i.phase === "sending" || i.phase === "paused" || i.phase === "checking");
  const hasBackgroundWork = items.some((i) =>
    ["queued", "checking", "sending", "paused", "processing"].includes(i.phase)
  );
  const topSending = items.find((i) => i.phase === "sending" || i.phase === "paused" || i.phase === "checking");
  const anyProcessing = items.some((i) => i.phase === "processing");

  useEffect(() => {
    if (!hasByteTransfer) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasByteTransfer]);

  const queuedCount = items.filter((i) => i.phase === "queued").length;

  const dismiss = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key));
  }, []);

  return {
    items,
    pick,
    cancel,
    retry,
    dismiss,
    setOnReady,
    registerOnReady,
    hasByteTransfer,
    hasBackgroundWork,
    topSending,
    anyProcessing,
    queuedCount,
    flushQueued,
    lang,
  };
}

export function phaseLabel(it: PortfolioUploadItem, lang: PortfolioUploadLang) {
  switch (it.phase) {
    case "queued":
      return T(lang, "Σε αναμονή εγγραφής…", "Waiting for signup…");
    case "checking":
      return T(lang, "Έλεγχος…", "Checking…");
    case "sending":
      return `${it.percent}%`;
    case "paused":
      return `${it.percent}% · ${T(lang, "σε παύση", "paused")}`;
    case "processing":
      return T(lang, "Επεξεργασία…", "Processing…");
    case "ready":
      return T(lang, "Έτοιμο, μπήκε στο portfolio", "Ready, added to your portfolio");
    case "failed":
      return T(lang, "Απέτυχε", "Failed");
    default:
      return "";
  }
}