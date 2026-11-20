/**
 * End-to-end portfolio upload timing (real API routes).
 *
 * Env (never logged):
 *   PORTFOLIO_BENCH_BASE_URL — default http://localhost:3000
 *   PORTFOLIO_BENCH_ACCESS_TOKEN — Supabase user JWT (creator)
 *   PORTFOLIO_BENCH_INFLUENCER_ID — creator uuid
 *   PORTFOLIO_BENCH_SKIP_ENCODE=1 — measure upload + assembly only
 *
 * Run: node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/portfolio-upload-bench.mts
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import { UPLOAD_CHUNK_BYTES, UPLOAD_PARALLEL_CHUNKS, chunkCount } from "../lib/portfolioUpload.ts";

const BASE = (process.env.PORTFOLIO_BENCH_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.PORTFOLIO_BENCH_ACCESS_TOKEN || "";
const INFLUENCER_ID = process.env.PORTFOLIO_BENCH_INFLUENCER_ID || "";
const SKIP_ENCODE = process.env.PORTFOLIO_BENCH_SKIP_ENCODE === "1";

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${TOKEN}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}

async function ensureBenchAssets(dir: string): Promise<{ video: string; photo: string }> {
  await mkdir(dir, { recursive: true });
  const video = path.join(dir, "bench-100mb.mp4");
  const photo = path.join(dir, "bench-20mb.jpg");
  try {
    const vst = await stat(video);
    if (vst.size < 50_000_000) throw new Error("small");
  } catch {
    await runFfmpeg([
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=1280x720:rate=30",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=white:amplitude=0.8:d=150",
      "-t",
      "150",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      "5500k",
      "-minrate",
      "5500k",
      "-maxrate",
      "5500k",
      "-bufsize",
      "11000k",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      video,
    ]);
  }
  try {
    const pst = await stat(photo);
    if (pst.size < 19_000_000) throw new Error("small");
  } catch {
    const out = createWriteStream(photo);
    out.write(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]));
    const chunk = Buffer.alloc(512 * 1024, 0xab);
    let written = 0;
    const target = 20 * 1024 * 1024;
    while (written < target) {
      const n = Math.min(chunk.length, target - written);
      if (!out.write(chunk.subarray(0, n))) await finished(out, { readable: false, writable: true });
      written += n;
    }
    out.end();
    await finished(out);
  }
  return { video, photo };
}

type UploadRow = {
  id: string;
  receivedBytes: number;
  totalBytes: number;
  chunkBytes: number;
  status: string;
};

async function startUpload(file: { path: string; name: string; mime: string; size: number; durationSec?: number }): Promise<UploadRow> {
  const res = await fetch(`${BASE}/api/portfolio-media/uploads`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      influencerId: INFLUENCER_ID,
      fileName: file.name,
      mimeType: file.mime,
      size: file.size,
      durationSec: file.durationSec ?? null,
      lang: "en",
    }),
  });
  const data = (await res.json()) as { upload?: UploadRow; error?: string };
  if (!res.ok || !data.upload) throw new Error(data.error || `start ${res.status}`);
  return data.upload;
}

async function putChunk(id: string, offset: number, buf: Buffer): Promise<UploadRow> {
  const qs = new URLSearchParams({ influencerId: INFLUENCER_ID, offset: String(offset) });
  const res = await fetch(`${BASE}/api/portfolio-media/uploads/${id}?${qs}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/octet-stream" },
    body: buf,
  });
  const data = (await res.json()) as { upload?: UploadRow; error?: string };
  if (!res.ok || !data.upload) throw new Error(data.error || `chunk ${res.status}`);
  return data.upload;
}

async function uploadFile(filePath: string, mime: string, durationSec?: number): Promise<{ uploadMs: number; completeMs: number; id: string }> {
  const st = await stat(filePath);
  const upload0 = await startUpload({ path: filePath, name: path.basename(filePath), mime, size: st.size, durationSec });
  const buf = await import("node:fs/promises").then((m) => m.readFile(filePath));
  const t0 = performance.now();
  const n = chunkCount(st.size, UPLOAD_CHUNK_BYTES);
  const inflight = new Map<number, Promise<void>>();
  let received = 0;
  const pump = () => {
    const start = Math.floor(received / UPLOAD_CHUNK_BYTES);
    for (let i = start; i < n && inflight.size < UPLOAD_PARALLEL_CHUNKS; i++) {
      if (inflight.has(i)) continue;
      const off = i * UPLOAD_CHUNK_BYTES;
      const end = Math.min(off + UPLOAD_CHUNK_BYTES, st.size);
      inflight.set(
        i,
        putChunk(upload0.id, off, buf.subarray(off, end))
          .then((u) => {
            received = Math.max(received, u.receivedBytes);
          })
          .finally(() => inflight.delete(i))
      );
    }
  };
  while (received < st.size || inflight.size > 0) {
    pump();
    if (inflight.size) await Promise.race(inflight.values());
    else if (received < st.size) await new Promise((r) => setTimeout(r, 20));
  }
  const uploadMs = performance.now() - t0;
  const t1 = performance.now();
  const qs = new URLSearchParams({ influencerId: INFLUENCER_ID });
  const comp = await fetch(`${BASE}/api/portfolio-media/uploads/${upload0.id}?${qs}`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ action: "complete" }),
  });
  const compData = (await comp.json()) as { upload?: UploadRow };
  if (!comp.ok || !compData.upload) throw new Error(`complete ${comp.status}`);
  return { uploadMs, completeMs: performance.now() - t1, id: upload0.id };
}

async function waitReady(id: string, timeoutMs: number): Promise<number> {
  const t0 = performance.now();
  const qs = new URLSearchParams({ influencerId: INFLUENCER_ID });
  while (performance.now() - t0 < timeoutMs) {
    const res = await fetch(`${BASE}/api/portfolio-media/uploads?${qs}`, { headers: headers() });
    const data = (await res.json()) as { uploads?: UploadRow[] };
    const row = (data.uploads || []).find((u) => u.id === id);
    if (row?.status === "ready") return performance.now() - t0;
    if (row?.status === "failed") throw new Error("encode failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("encode timeout");
}

async function maybeRunWorker() {
  if (SKIP_ENCODE) return;
  const py = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
  await new Promise<void>((resolve) => {
    const child = spawn(py, ["scripts/process_creator_media_jobs.py", "--uploads-only"], {
      stdio: "ignore",
      env: { ...process.env, PORTFOLIO_UPLOAD_STAGING_DIR: path.join(process.cwd(), ".portfolio-upload-staging") },
    });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

if (!TOKEN || !INFLUENCER_ID) {
  console.error("Set PORTFOLIO_BENCH_ACCESS_TOKEN and PORTFOLIO_BENCH_INFLUENCER_ID (values are not printed).");
  process.exit(2);
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "influo-bench-"));
try {
  const assets = await ensureBenchAssets(tmp);
  const video = await uploadFile(assets.video, "video/mp4", 150);
  await maybeRunWorker();
  const encodeMs = SKIP_ENCODE ? null : await waitReady(video.id, 15 * 60_000);
  const photo = await uploadFile(assets.photo, "image/jpeg");
  await maybeRunWorker();
  const photoEncodeMs = SKIP_ENCODE ? null : await waitReady(photo.id, 5 * 60_000);
  console.log(
    JSON.stringify(
      {
        videoMb: Math.round((await stat(assets.video)).size / (1024 * 1024)),
        photoMb: Math.round((await stat(assets.photo)).size / (1024 * 1024)),
        parallelChunks: UPLOAD_PARALLEL_CHUNKS,
        videoUploadMs: Math.round(video.uploadMs),
        videoAssemblyMs: Math.round(video.completeMs),
        videoEncodeMs: encodeMs == null ? null : Math.round(encodeMs),
        photoUploadMs: Math.round(photo.uploadMs),
        photoAssemblyMs: Math.round(photo.completeMs),
        photoEncodeMs: photoEncodeMs == null ? null : Math.round(photoEncodeMs),
      },
      null,
      2
    )
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}