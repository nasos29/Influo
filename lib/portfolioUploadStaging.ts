/**
 * Local disk staging for portfolio uploads (chunk .part files + optional assembled source).
 * Avoids per-chunk Supabase Storage round-trips; the media worker reads the same paths.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { finished, pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { chunkCount, uploadMediaType } from "@/lib/portfolioUpload";

export function stagingRoot(): string {
  const fromEnv = process.env.PORTFOLIO_UPLOAD_STAGING_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), ".portfolio-upload-staging");
}

export function uploadStagingDir(influencerId: string, uploadId: string): string {
  return path.join(stagingRoot(), "uploads", influencerId.toLowerCase(), uploadId.toLowerCase());
}

export function chunkPartPath(dir: string, index: number): string {
  return path.join(dir, "chunks", `${String(index).padStart(5, "0")}.part`);
}

export function expectedChunkLength(index: number, totalBytes: number, chunkBytes: number): number {
  const n = chunkCount(totalBytes, chunkBytes);
  if (index < 0 || index >= n) return 0;
  if (index === n - 1) return totalBytes - index * chunkBytes;
  return chunkBytes;
}

export async function ensureUploadDir(influencerId: string, uploadId: string): Promise<string> {
  const dir = uploadStagingDir(influencerId, uploadId);
  await mkdir(path.join(dir, "chunks"), { recursive: true });
  return dir;
}

export async function chunkOnDisk(dir: string, index: number, expectedLen: number): Promise<boolean> {
  try {
    const st = await stat(chunkPartPath(dir, index));
    return st.size === expectedLen;
  } catch {
    return false;
  }
}

/** Longest contiguous prefix of complete chunk files from byte 0. */
export async function contiguousReceivedBytes(dir: string, totalBytes: number, chunkBytes: number): Promise<number> {
  const n = chunkCount(totalBytes, chunkBytes);
  let received = 0;
  for (let i = 0; i < n; i++) {
    const len = expectedChunkLength(i, totalBytes, chunkBytes);
    if (!(await chunkOnDisk(dir, i, len))) break;
    received += len;
  }
  return received;
}

async function streamToFile(
  dest: string,
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<number> {
  if (!body) throw new Error("empty body");
  const nodeStream = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
  let written = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      written += chunk.length;
      if (written > maxBytes) {
        cb(new Error("chunk too large"));
        return;
      }
      cb(null, chunk);
    },
  });
  const out = createWriteStream(dest, { flags: "w" });
  try {
    await pipeline(nodeStream, limiter, out);
    return written;
  } catch (e) {
    await rm(dest, { force: true }).catch(() => undefined);
    throw e;
  }
}

export async function writeChunkPart(
  dir: string,
  index: number,
  body: ReadableStream<Uint8Array> | null,
  expectedLen: number
): Promise<"written" | "exists"> {
  const part = chunkPartPath(dir, index);
  if (await chunkOnDisk(dir, index, expectedLen)) return "exists";
  const tmp = `${part}.tmp`;
  await rm(tmp, { force: true }).catch(() => undefined);
  const written = await streamToFile(tmp, body, expectedLen);
  if (written !== expectedLen) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw new Error("chunk length mismatch");
  }
  await rename(tmp, part);
  return "written";
}

export async function readChunkHead(dir: string, index: number, n = 64): Promise<Uint8Array | null> {
  const part = chunkPartPath(dir, index);
  try {
    const fh = await open(part, "r");
    try {
      const buf = Buffer.alloc(n);
      const { bytesRead } = await fh.read(buf, 0, n, 0);
      return new Uint8Array(buf.subarray(0, bytesRead));
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

function sourceSuffix(fileName: string | null, mimeType: string): string {
  const name = String(fileName || "").toLowerCase();
  const ext = path.extname(name);
  if (ext && ext.length <= 6) return ext;
  const mt = uploadMediaType(mimeType, fileName);
  if (mt === "video") return ".mp4";
  if (mt === "photo") return ".jpg";
  return ".bin";
}

export function assembledSourcePath(dir: string, fileName: string | null, mimeType: string): string {
  return path.join(dir, `source${sourceSuffix(fileName, mimeType)}`);
}

/** Concat chunk parts into one source file (streamed; no full-file RAM buffer). */
export async function assembleSourceFile(
  dir: string,
  totalBytes: number,
  chunkBytes: number,
  fileName: string | null,
  mimeType: string
): Promise<string> {
  const dest = assembledSourcePath(dir, fileName, mimeType);
  try {
    const existing = await stat(dest);
    if (existing.size === totalBytes) return dest;
  } catch {
    /* assemble below */
  }
  const tmp = `${dest}.tmp`;
  await rm(tmp, { force: true }).catch(() => undefined);
  const out = createWriteStream(tmp, { flags: "w" });
  const n = chunkCount(totalBytes, chunkBytes);
  for (let i = 0; i < n; i++) {
    const len = expectedChunkLength(i, totalBytes, chunkBytes);
    if (!(await chunkOnDisk(dir, i, len))) throw new Error("missing chunk for assembly");
    await pipeline(createReadStream(chunkPartPath(dir, i)), out, { end: false });
  }
  out.end();
  await finished(out);
  const st = await stat(tmp);
  if (st.size !== totalBytes) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw new Error("assembled size mismatch");
  }
  await rm(dest, { force: true }).catch(() => undefined);
  await rename(tmp, dest);
  return dest;
}

export async function removeUploadStaging(influencerId: string, uploadId: string): Promise<void> {
  const dir = uploadStagingDir(influencerId, uploadId);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

/** Worker / ops: absolute path if a fully assembled source exists. */
export async function findAssembledSource(
  influencerId: string,
  uploadId: string,
  totalBytes: number
): Promise<string | null> {
  const dir = uploadStagingDir(influencerId, uploadId);
  try {
    const names = await readdir(dir);
    for (const name of names) {
      if (!name.startsWith("source")) continue;
      const full = path.join(dir, name);
      const st = await stat(full);
      if (st.size === totalBytes) return full;
    }
  } catch {
    return null;
  }
  return null;
}