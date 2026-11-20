"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import { validateUploadRequest } from "@/lib/portfolioUpload";

type Lang = "el" | "en";

type ServerUpload = {
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

type Item = {
  key: string;
  file?: File;
  upload?: ServerUpload;
  name: string;
  /** 0..100 while sending bytes. */
  percent: number;
  phase: "checking" | "sending" | "paused" | "processing" | "ready" | "failed" | "cancelled";
  message?: string;
};

const T = (lang: Lang, el: string, en: string) => (lang === "en" ? en : el);

const ACCEPT = "video/*,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

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
      v.onerror = () => done(null); // e.g. HEVC .mov on desktop Chrome — the server checks again
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

/** PUT one chunk with byte-level progress (fetch has no upload progress). */
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

/**
 * Upload videos/photos straight into the portfolio.
 * Mobile: native picker (camera roll). PC: picker or drag & drop.
 * Chunked + resumable (survives short network drops), % progress, cancel/retry,
 * then a "processing" state until the server finishes encoding.
 */
export default function PortfolioMediaUploader({
  influencerId,
  lang = "el",
  slotsLeft,
  onReady,
}: {
  influencerId: string;
  lang?: Lang;
  /** Portfolio slots still free in the editor (6 total). */
  slotsLeft: number;
  /** Called once an item is in the portfolio (public URL on our own storage). */
  onReady?: (url: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const reported = useRef<Set<string>>(new Set());
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const update = useCallback((key: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }, []);

  const qs = `influencerId=${encodeURIComponent(influencerId)}`;

  // Show uploads still processing (or failed) from an earlier visit.
  useEffect(() => {
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
            .map<Item>((u) => ({
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
  }, [qs]);

  // Poll while anything is processing.
  const processingIds = items.filter((i) => i.phase === "processing" && i.upload).map((i) => i.upload!.id).join(",");
  useEffect(() => {
    if (!processingIds) return;
    const timer = setInterval(async () => {
      const res = await sessionFetch(`/api/portfolio-media/uploads?${qs}`, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { uploads?: ServerUpload[] };
      for (const u of data.uploads || []) {
        if (!processingIds.includes(u.id)) continue;
        if (u.status === "ready") {
          setItems((prev) => prev.map((it) => (it.upload?.id === u.id ? { ...it, upload: u, phase: "ready" } : it)));
          if (u.portfolioUrl && !reported.current.has(u.id)) {
            reported.current.add(u.id);
            onReadyRef.current?.(u.portfolioUrl);
          }
        } else if (u.status === "failed") {
          setItems((prev) =>
            prev.map((it) => (it.upload?.id === u.id ? { ...it, upload: u, phase: "failed", message: u.error || undefined } : it))
          );
        }
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [processingIds, qs]);

  const send = useCallback(
    async (key: string, file: File, upload: ServerUpload) => {
      const ctrl = new AbortController();
      controllers.current.set(key, ctrl);
      let current = upload;
      let failures = 0;
      update(key, { phase: "sending", upload: current, message: undefined });
      try {
        while (current.receivedBytes < current.totalBytes) {
          const offset = current.receivedBytes;
          const end = Math.min(offset + current.chunkBytes, current.totalBytes);
          const token = await authHeader();
          try {
            const { status, json } = await putChunk(
              `/api/portfolio-media/uploads/${current.id}?${qs}&offset=${offset}`,
              file.slice(offset, end),
              token,
              (sent) => update(key, { percent: Math.floor(((offset + sent) / current.totalBytes) * 100) }),
              ctrl.signal
            );
            if (status === 200 && json.upload) {
              current = json.upload;
              failures = 0;
              update(key, { upload: current, percent: Math.floor((current.receivedBytes / current.totalBytes) * 100) });
              continue;
            }
            if (status === 409 && json.upload) {
              current = json.upload; // resume from what the server has
              if (current.status !== "uploading") break;
              continue;
            }
            if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
              throw Object.assign(new Error(json.error || "rejected"), { fatal: true });
            }
            throw new Error("server");
          } catch (err) {
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
            const st = await sessionFetch(`/api/portfolio-media/uploads/${current.id}?${qs}`, { cache: "no-store" }).catch(() => null);
            if (st?.ok) current = ((await st.json()) as { upload: ServerUpload }).upload;
            update(key, { phase: "sending", message: undefined });
          }
        }
        if (current.status === "uploading") {
          const res = await sessionFetch(`/api/portfolio-media/uploads/${current.id}?${qs}`, {
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
    [lang, qs, update]
  );

  const start = useCallback(
    async (file: File) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { key, file, name: file.name, percent: 0, phase: "checking" }]);
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
        body: JSON.stringify({ influencerId, fileName: file.name, mimeType: file.type, size: file.size, durationSec, lang }),
      }).catch(() => null);
      const data = res ? ((await res.json().catch(() => ({}))) as { upload?: ServerUpload; error?: string }) : {};
      if (!res || !res.ok || !data.upload) {
        update(key, { phase: "failed", message: data.error || T(lang, "Δεν ξεκίνησε το ανέβασμα.", "Could not start the upload.") });
        return;
      }
      await send(key, file, data.upload);
    },
    [influencerId, lang, send, update]
  );

  const active = items.filter((i) => ["checking", "sending", "paused", "processing"].includes(i.phase)).length;
  const free = Math.max(0, slotsLeft - active);

  const pick = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, free);
    for (const f of list) void start(f);
  };

  const cancel = async (it: Item) => {
    controllers.current.get(it.key)?.abort();
    if (it.upload) {
      await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${qs}`, { method: "DELETE" }).catch(() => undefined);
    }
    setItems((prev) => prev.filter((p) => p.key !== it.key));
  };

  const retry = async (it: Item) => {
    if (!it.upload) {
      setItems((prev) => prev.filter((p) => p.key !== it.key));
      if (it.file) void start(it.file);
      return;
    }
    if (it.upload.receivedBytes >= it.upload.totalBytes) {
      const res = await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      }).catch(() => null);
      const data = res ? ((await res.json().catch(() => ({}))) as { upload?: ServerUpload }) : {};
      if (data.upload) update(it.key, { upload: data.upload, phase: "processing", message: undefined });
      return;
    }
    if (it.file) {
      const st = await sessionFetch(`/api/portfolio-media/uploads/${it.upload.id}?${qs}`, { cache: "no-store" }).catch(() => null);
      const fresh = st?.ok ? ((await st.json()) as { upload: ServerUpload }).upload : it.upload;
      if (fresh.status === "uploading") void send(it.key, it.file, fresh);
    }
  };

  const phaseLabel = (it: Item) => {
    switch (it.phase) {
      case "checking":
        return T(lang, "Έλεγχος…", "Checking…");
      case "sending":
        return `${it.percent}%`;
      case "paused":
        return `${it.percent}% · ${T(lang, "σε παύση", "paused")}`;
      case "processing":
        return T(lang, "Επεξεργασία… θα εμφανιστεί μόλις είναι έτοιμο", "Processing… it will appear when ready");
      case "ready":
        return T(lang, "Έτοιμο, μπήκε στο portfolio", "Ready, added to your portfolio");
      case "failed":
        return T(lang, "Απέτυχε", "Failed");
      default:
        return "";
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (free > 0) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
        } ${free <= 0 ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={free <= 0}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {T(lang, "Ανέβασε βίντεο ή φωτογραφία", "Upload a video or photo")}
        </button>
        <p className="mt-2 hidden text-xs text-slate-500 sm:block">
          {T(lang, "ή σύρε το αρχείο εδώ", "or drag the file here")}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {free <= 0
            ? T(lang, "Το portfolio είναι γεμάτο (6 στοιχεία).", "Your portfolio is full (6 items).")
            : T(
                lang,
                "Βίντεο έως 500 MB και 3 λεπτά · φωτογραφίες JPG, PNG, HEIC, WebP έως 20 MB",
                "Videos up to 500 MB and 3 minutes · JPG, PNG, HEIC, WebP photos up to 20 MB"
              )}
        </p>
      </div>

      {items.map((it) => (
        <div key={it.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{it.name}</span>
            <span className={`shrink-0 text-xs ${it.phase === "failed" ? "text-red-600" : "text-slate-500"}`}>{phaseLabel(it)}</span>
          </div>
          {it.phase === "sending" || it.phase === "paused" ? (
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={it.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${it.percent}%` }} />
            </div>
          ) : null}
          {it.message ? <p className="mt-1 text-xs text-slate-600">{it.message}</p> : null}
          <div className="mt-1 flex gap-3 text-xs">
            {it.phase === "failed" ? (
              <button type="button" onClick={() => void retry(it)} className="font-semibold text-blue-600">
                {T(lang, "Ξανά", "Retry")}
              </button>
            ) : null}
            {["checking", "sending", "paused", "failed"].includes(it.phase) ? (
              <button type="button" onClick={() => void cancel(it)} className="font-semibold text-slate-500">
                {T(lang, "Ακύρωση", "Cancel")}
              </button>
            ) : null}
            {it.phase === "ready" ? (
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((p) => p.key !== it.key))}
                className="font-semibold text-slate-500"
              >
                OK
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
