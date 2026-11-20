/**
 * Stream a file from disk into Supabase Storage via the TUS resumable endpoint (6 MiB chunks).
 * Server-side only — uses the service role key.
 */
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

/** Supabase Storage TUS requires 6 MiB chunks (except the last). */
export const SUPABASE_TUS_CHUNK_BYTES = 6 * 1024 * 1024;

const TUS_VERSION = "1.0.0";
const CHUNK_RETRIES = 3;

export function tusChunkLengthAtOffset(offset: number, totalBytes: number): number {
  if (offset >= totalBytes || totalBytes <= 0) return 0;
  return Math.min(SUPABASE_TUS_CHUNK_BYTES, totalBytes - offset);
}

export function tusChunkCount(totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.ceil(totalBytes / SUPABASE_TUS_CHUNK_BYTES);
}

function tusMetadata(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${Buffer.from(value, "utf8").toString("base64")}`)
    .join(",");
}

function resumableEndpoint(): string {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return `${base}/storage/v1/upload/resumable`;
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

function resolveUploadUrl(location: string, endpoint: string): string {
  if (location.startsWith("http://") || location.startsWith("https://")) return location;
  const base = endpoint.replace(/\/upload\/resumable\/?$/, "");
  return `${base}${location.startsWith("/") ? "" : "/"}${location}`;
}

async function createTusUpload(params: {
  fileSize: number;
  bucketName: string;
  objectName: string;
  contentType: string;
  cacheControl: string;
  upsert: boolean;
}): Promise<string> {
  const endpoint = resumableEndpoint();
  const key = serviceRoleKey();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Tus-Resumable": TUS_VERSION,
      "Upload-Length": String(params.fileSize),
      "Upload-Metadata": tusMetadata({
        bucketName: params.bucketName,
        objectName: params.objectName,
        contentType: params.contentType,
        cacheControl: params.cacheControl,
      }),
      "x-upsert": params.upsert ? "true" : "false",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TUS create failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const location = res.headers.get("location");
  if (!location) throw new Error("TUS create response missing Location");
  return resolveUploadUrl(location, endpoint);
}

async function patchTusChunk(uploadUrl: string, offset: number, chunkLen: number, filePath: string): Promise<void> {
  const key = serviceRoleKey();
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < CHUNK_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    const chunkStream = createReadStream(filePath, { start: offset, end: offset + chunkLen - 1 });
    const chunkBody = Readable.toWeb(chunkStream) as ReadableStream<Uint8Array>;
    try {
      const res = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key}`,
          "Tus-Resumable": TUS_VERSION,
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
          "Content-Length": String(chunkLen),
        },
        body: chunkBody,
        // @ts-expect-error Node fetch requires duplex for streaming request bodies
        duplex: "half",
      });
      if (res.status === 204 || res.status === 200) return;
      const text = await res.text().catch(() => "");
      lastErr = new Error(`TUS PATCH failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error("TUS PATCH failed");
}

export type TusUploadFromPathParams = {
  filePath: string;
  fileSize: number;
  bucketName: string;
  objectName: string;
  contentType: string;
  cacheControl?: string;
  upsert?: boolean;
};

/** Upload a local file via TUS without loading the full file into memory. */
export async function tusUploadFileFromPath(params: TusUploadFromPathParams): Promise<void> {
  const uploadUrl = await createTusUpload({
    fileSize: params.fileSize,
    bucketName: params.bucketName,
    objectName: params.objectName,
    contentType: params.contentType,
    cacheControl: params.cacheControl ?? "3600",
    upsert: params.upsert ?? false,
  });

  let offset = 0;
  while (offset < params.fileSize) {
    const len = tusChunkLengthAtOffset(offset, params.fileSize);
    if (len <= 0) break;
    await patchTusChunk(uploadUrl, offset, len, params.filePath);
    offset += len;
  }
  if (offset !== params.fileSize) {
    throw new Error("TUS upload size mismatch");
  }
}