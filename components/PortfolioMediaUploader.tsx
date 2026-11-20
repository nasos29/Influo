"use client";

import { useRef, useState } from "react";
import { PORTFOLIO_FILE_ACCEPT, PORTFOLIO_PICK_REJECTED } from "@/lib/portfolioFilePicker";
import ToastViewport, { useToasts } from "@/components/ui/Toast";
import {
  phaseLabel,
  useOptionalPortfolioUploadContext,
  type PortfolioUploadItem,
} from "@/components/PortfolioUploadProvider";
import {
  usePortfolioMediaUpload,
  type PortfolioUploadLang,
} from "@/lib/usePortfolioMediaUpload";

type Lang = PortfolioUploadLang;

const T = (lang: Lang, el: string, en: string) => (lang === "en" ? en : el);

function ItemPreview({ it, lang }: { it: PortfolioUploadItem; lang: Lang }) {
  const [url] = useState(() => (it.file ? URL.createObjectURL(it.file) : null));
  if (!url || !it.file) return null;
  const isVideo = it.file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(it.file.name);
  return (
    <div className="relative mt-2 flex max-h-64 min-h-[8rem] w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {isVideo ? (
        <video src={url} className="max-h-64 w-full object-contain" controls muted playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-64 w-full object-contain" />
      )}
      {it.phase === "processing" ? (
        <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-medium text-white">
          {T(lang, "Επεξεργάζεται…", "Processing…")}
        </span>
      ) : null}
    </div>
  );
}

function UploaderBody({
  lang,
  slotsLeft,
  upload,
}: {
  lang: Lang;
  slotsLeft: number;
  upload: ReturnType<typeof usePortfolioMediaUpload>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { items, pick, cancel, retry } = upload;
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const rejectToast = () => {
    pushToast(lang === "en" ? PORTFOLIO_PICK_REJECTED.en : PORTFOLIO_PICK_REJECTED.el, "error");
  };

  const active = items.filter((i) => ["queued", "checking", "sending", "paused", "processing"].includes(i.phase)).length;
  const free = Math.max(0, slotsLeft - active);

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
          if (pick(e.dataTransfer.files, slotsLeft)) rejectToast();
        }}
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
        } ${free <= 0 ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={PORTFOLIO_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (pick(e.target.files, slotsLeft)) rejectToast();
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
                "Στο κινητό μπορείς να διαλέξεις από Αρχεία ή συλλογή. Βίντεο έως 500 MB και 3 λεπτά · φωτογραφίες JPG, PNG, HEIC, WebP έως 20 MB",
                "On mobile you can pick from Files or your library. Videos up to 500 MB and 3 minutes · JPG, PNG, HEIC, WebP photos up to 20 MB"
              )}
        </p>
      </div>

      <ToastViewport
        toasts={toasts}
        onDismiss={dismissToast}
        dismissLabel={lang === "en" ? "Dismiss" : "Κλείσιμο"}
      />

      {items.map((it) => (
        <div key={it.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{it.name}</span>
            <span className={`shrink-0 text-xs ${it.phase === "failed" ? "text-red-600" : "text-slate-500"}`}>
              {phaseLabel(it, lang)}
            </span>
          </div>
          {(it.phase === "sending" || it.phase === "paused") && (
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={it.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${it.percent}%` }} />
            </div>
          )}
          {it.file && ["sending", "paused", "processing", "ready"].includes(it.phase) ? (
            <ItemPreview it={it} lang={lang} />
          ) : null}
          {it.phase === "processing" && !it.file ? (
            <p className="mt-1 text-xs font-medium text-amber-800">{T(lang, "Επεξεργάζεται…", "Processing…")}</p>
          ) : null}
          {it.message ? <p className="mt-1 text-xs text-slate-600">{it.message}</p> : null}
          <div className="mt-1 flex gap-3 text-xs">
            {it.phase === "failed" ? (
              <button type="button" onClick={() => void retry(it)} className="font-semibold text-blue-600">
                {T(lang, "Ξανά", "Retry")}
              </button>
            ) : null}
            {["checking", "sending", "paused", "queued", "failed"].includes(it.phase) ? (
              <button type="button" onClick={() => void cancel(it)} className="font-semibold text-slate-500">
                {T(lang, "Ακύρωση", "Cancel")}
              </button>
            ) : null}
            {it.phase === "ready" ? (
              <button type="button" onClick={() => upload.dismiss(it.key)} className="font-semibold text-slate-500">
                OK
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Upload videos/photos straight into the portfolio (chunked API + background encoding).
 * Uses dashboard-level `PortfolioUploadProvider` when present; signup passes a local hook.
 */
export default function PortfolioMediaUploader({
  influencerId,
  lang = "el",
  slotsLeft,
  localUpload,
}: {
  influencerId: string | null;
  lang?: Lang;
  slotsLeft: number;
  /** Signup supplies its own hook instance instead of the dashboard provider. */
  localUpload?: ReturnType<typeof usePortfolioMediaUpload>;
}) {
  const ctx = useOptionalPortfolioUploadContext();
  const upload = localUpload ?? ctx;
  if (!upload) {
    throw new Error("PortfolioMediaUploader requires PortfolioUploadProvider or localUpload");
  }

  return <UploaderBody lang={lang} slotsLeft={slotsLeft} upload={upload} />;
}