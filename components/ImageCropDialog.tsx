"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

type Job = { file: File; url: string; aspect: number; outW: number; outH: number; title: string; resolve: (f: File | null) => void };

async function cropToFile(job: Job, area: Area): Promise<File> {
  const img = new Image();
  img.src = job.url;
  await img.decode();
  const canvas = document.createElement("canvas");
  // Never upscale beyond the cropped source pixels.
  const scale = Math.min(1, job.outW / area.width);
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return job.file;
  const png = job.file.type === "image/png" || job.file.type === "image/webp";
  if (!png) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const type = png ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
  if (!blob) return job.file;
  const base = job.file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${png ? "png" : "jpg"}`, { type });
}

/**
 * `crop(file, opts)` opens a crop dialog and resolves with the cropped file,
 * the original file («Χωρίς περικοπή»), or null (cancel). Render `dialog` once.
 */
export function useImageCrop() {
  const [job, setJob] = useState<Job | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const areaRef = useRef<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const cropFile = useCallback(
    (file: File, opts: { aspect: number; outW: number; outH: number; title: string }) =>
      new Promise<File | null>((resolve) => {
        if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return resolve(file);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        areaRef.current = null;
        setJob({ file, url: URL.createObjectURL(file), ...opts, resolve });
      }),
    []
  );

  const finish = async (mode: "crop" | "original" | "cancel") => {
    if (!job) return;
    let out: File | null = null;
    if (mode === "original") out = job.file;
    if (mode === "crop") {
      setBusy(true);
      try {
        out = areaRef.current ? await cropToFile(job, areaRef.current) : job.file;
      } catch {
        out = job.file;
      }
      setBusy(false);
    }
    URL.revokeObjectURL(job.url);
    job.resolve(out);
    setJob(null);
  };

  const dialog = job ? (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-200">
          <p className="font-semibold text-slate-900">{job.title}</p>
          <p className="text-xs text-slate-500">
            Σύρετε και κάντε zoom. Προτεινόμενο: {job.outW}×{job.outH} px.
          </p>
        </div>
        <div className="relative w-full h-72 sm:h-80 bg-slate-900">
          <Cropper
            image={job.url}
            crop={crop}
            zoom={zoom}
            minZoom={0.5}
            maxZoom={4}
            restrictPosition={false}
            aspect={job.aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => {
              areaRef.current = px;
            }}
          />
        </div>
        <div className="px-4 pt-3">
          <input type="range" min={0.5} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" aria-label="Zoom" />
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => void finish("cancel")} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Ακύρωση</button>
          <button type="button" onClick={() => void finish("original")} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Χωρίς περικοπή</button>
          <button type="button" disabled={busy} onClick={() => void finish("crop")} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
            {busy ? "…" : "Αποκοπή"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { cropFile, dialog };
}

export const LOGO_CROP = { aspect: 1, outW: 512, outH: 512, title: "Περικοπή λογότυπου" };
export const COVER_CROP = { aspect: 4 / 3, outW: 1200, outH: 900, title: "Περικοπή εξωφύλλου" };
export const LOGO_HINT = "Προτεινόμενο: τετράγωνο 512×512 px (PNG με διάφανο φόντο ιδανικά).";
export const COVER_HINT = "Προτεινόμενο: 1200×900 px (4:3, όπως στις κάρτες). Η εικόνα εμφανίζεται ολόκληρη.";
