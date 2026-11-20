/**
 * Measures local staging pipeline (chunk writes + assembly) without HTTP.
 * For full API timings use portfolio-upload-bench.mts with a creator JWT.
 *
 * Run: node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/portfolio-upload-pipeline-bench.mts
 */
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { UPLOAD_CHUNK_BYTES, UPLOAD_PARALLEL_CHUNKS, chunkCount } from "../lib/portfolioUpload.ts";
import {
  assembleSourceFile,
  chunkPartPath,
  ensureUploadDir,
  writeChunkPart,
} from "../lib/portfolioUploadStaging.ts";

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}

async function makeVideo(out: string): Promise<void> {
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
    out,
  ]);
}

async function uploadChunksParallel(
  dir: string,
  file: Buffer,
  total: number,
  parallel: number
): Promise<number> {
  const n = chunkCount(total, UPLOAD_CHUNK_BYTES);
  const t0 = performance.now();
  const inflight = new Map<number, Promise<void>>();
  let done = 0;
  const pump = () => {
    const start = Math.floor(done / UPLOAD_CHUNK_BYTES);
    for (let i = start; i < n && inflight.size < parallel; i++) {
      if (inflight.has(i)) continue;
      const off = i * UPLOAD_CHUNK_BYTES;
      const end = Math.min(off + UPLOAD_CHUNK_BYTES, total);
      const slice = file.subarray(off, end);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(slice);
          controller.close();
        },
      });
      inflight.set(
        i,
        writeChunkPart(dir, i, body, end - off)
          .then(() => {
            done = Math.max(done, end);
          })
          .finally(() => inflight.delete(i))
      );
    }
  };
  while (done < total || inflight.size > 0) {
    pump();
    if (inflight.size) await Promise.race(inflight.values());
  }
  return performance.now() - t0;
}

async function uploadChunksSequential(dir: string, file: Buffer, total: number): Promise<number> {
  const n = chunkCount(total, UPLOAD_CHUNK_BYTES);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const off = i * UPLOAD_CHUNK_BYTES;
    const end = Math.min(off + UPLOAD_CHUNK_BYTES, total);
    const slice = file.subarray(off, end);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(slice);
        controller.close();
      },
    });
    await writeChunkPart(dir, i, body, end - off);
  }
  return performance.now() - t0;
}

async function encodeSeconds(source: string): Promise<number> {
  const out = `${source}.enc.mp4`;
  const t0 = performance.now();
  await runFfmpeg([
    "-y",
    "-i",
    source,
    "-vf",
    "scale='min(720,iw)':'-2'",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "30",
    "-maxrate",
    "2M",
    "-bufsize",
    "4M",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    out,
  ]);
  await rm(out, { force: true });
  return performance.now() - t0;
}

const tmp = await mkdtemp(path.join(os.tmpdir(), "influo-pipe-bench-"));
const root = path.join(tmp, "staging");
process.env.PORTFOLIO_UPLOAD_STAGING_DIR = root;
const videoPath = path.join(tmp, "video.mp4");
const photoPath = path.join(tmp, "photo.bin");
try {
  await makeVideo(videoPath);
  let video = await readFile(videoPath);
  const targetBytes = 100 * 1024 * 1024;
  if (video.length < targetBytes) {
    video = Buffer.concat([video, Buffer.alloc(targetBytes - video.length)]);
  }
  const photoSize = 20 * 1024 * 1024;
  await writeFile(photoPath, Buffer.alloc(photoSize, 0xab));

  const inf = "11111111-2222-3333-4444-555555555555";
  const vidUp = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const photoUp = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const seqDir = await ensureUploadDir(inf, `${vidUp}-seq`);
  const seqMs = await uploadChunksSequential(seqDir, video, video.length);
  const vdir = await ensureUploadDir(inf, vidUp);
  const parMs = await uploadChunksParallel(vdir, video, video.length, UPLOAD_PARALLEL_CHUNKS);
  const asm0 = performance.now();
  await assembleSourceFile(vdir, video.length, UPLOAD_CHUNK_BYTES, "bench.mp4", "video/mp4");
  const asmMs = performance.now() - asm0;
  const src = path.join(vdir, "source.mp4");
  const encMs = await encodeSeconds(src);

  const pdir = await ensureUploadDir(inf, photoUp);
  const photoUploadMs = await uploadChunksParallel(pdir, await readFile(photoPath), photoSize, UPLOAD_PARALLEL_CHUNKS);

  console.log(
    JSON.stringify(
      {
        note: "local disk staging (no Supabase per chunk, no HTTP); sequential vs parallel chunk PUT simulation",
        videoBytes: video.length,
        videoMb: Math.round(video.length / (1024 * 1024)),
        photoMb: 20,
        chunkMb: UPLOAD_CHUNK_BYTES / (1024 * 1024),
        parallelChunks: UPLOAD_PARALLEL_CHUNKS,
        videoChunkWriteSequentialMs: Math.round(seqMs),
        videoChunkWriteParallelMs: Math.round(parMs),
        videoAssemblyMs: Math.round(asmMs),
        videoEncodeFastPresetMs: Math.round(encMs),
        photoChunkWriteParallelMs: Math.round(photoUploadMs),
      },
      null,
      2
    )
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}