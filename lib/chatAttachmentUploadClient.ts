import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import {
  CHAT_UPLOAD_CHUNK_BYTES,
  CHAT_UPLOAD_PARALLEL_CHUNKS,
  chunkCount,
  needsChunkedChatUpload,
  validateChatAttachment,
  chatAttachmentKind,
} from "@/lib/chatAttachmentUpload";
import {
  chunksRemaining,
  createChunkPumpState,
  markChunkComplete,
  markChunkFailed,
  pickNextChunkIndex,
} from "@/lib/portfolioUploadChunkPump";

export type ChatUploadAttachment = {
  url: string;
  filename?: string;
  size?: number;
  content_type?: string;
};

type ServerChatUpload = {
  id: string;
  totalBytes: number;
  chunkBytes: number;
  receivedBytes: number;
  status: string;
  attachment: ChatUploadAttachment | null;
  error?: string | null;
};

async function authHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function putChunk(
  url: string,
  body: Blob,
  token: string | null,
  onProgress: (sent: number) => void,
  signal: AbortSignal
): Promise<{ status: number; json: { upload?: ServerChatUpload; error?: string; success?: boolean } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (token) xhr.setRequestHeader("Authorization", token);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let json: { upload?: ServerChatUpload; error?: string; success?: boolean } = {};
      try {
        json = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* ignore */
      }
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

async function uploadSmallFile(
  file: File,
  conversationId: string,
  signal: AbortSignal
): Promise<ChatUploadAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("conversation_id", conversationId);
  const res = await sessionFetch("/api/messages/upload", { method: "POST", body: fd, signal });
  const json = await res.json();
  if (!res.ok || !json.success || !json.attachment?.url) {
    throw new Error(json.error || "Upload failed");
  }
  return json.attachment as ChatUploadAttachment;
}

async function uploadLargeVideo(
  file: File,
  conversationId: string,
  lang: "el" | "en",
  onPercent: (pct: number) => void,
  signal: AbortSignal,
  trackChunkUploadId?: { current: string | null }
): Promise<ChatUploadAttachment> {
  const start = await sessionFetch("/api/messages/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      lang,
    }),
    signal,
  });
  const startJson = (await start.json().catch(() => ({}))) as {
    success?: boolean;
    upload?: ServerChatUpload;
    error?: string;
  };
  if (!start.ok || !startJson.success || !startJson.upload?.id) {
    throw new Error(startJson.error || "Could not start upload");
  }

  let current = startJson.upload;
  trackChunkUploadId && (trackChunkUploadId.current = current.id);
  const onAbortCancel = () => {
    void cancelChatChunkUpload(current.id);
    trackChunkUploadId && (trackChunkUploadId.current = null);
  };
  signal.addEventListener("abort", onAbortCancel, { once: true });
  const clearChunkTracking = () => {
    trackChunkUploadId && (trackChunkUploadId.current = null);
    signal.removeEventListener("abort", onAbortCancel);
  };

  try {
  const chunkBytes = current.chunkBytes || CHAT_UPLOAD_CHUNK_BYTES;
  const totalChunks = chunkCount(current.totalBytes, chunkBytes);
  const pumpState = createChunkPumpState(
    totalChunks,
    CHAT_UPLOAD_PARALLEL_CHUNKS,
    Math.floor(current.receivedBytes / chunkBytes)
  );
  const inflight = new Map<number, Promise<void>>();
  let failures = 0;
  const token = await authHeader();

  const sendChunk = async (index: number) => {
    const offset = index * chunkBytes;
    const end = Math.min(offset + chunkBytes, current.totalBytes);
    const { status, json } = await putChunk(
      `/api/messages/uploads/${current.id}?offset=${offset}`,
      file.slice(offset, end),
      token,
      (sent) => onPercent(Math.floor(((offset + sent) / current.totalBytes) * 100)),
      signal
    );
    if (status === 200 && json.upload) {
      current = json.upload;
      failures = 0;
      markChunkComplete(pumpState, index);
      onPercent(Math.floor((current.receivedBytes / current.totalBytes) * 100));
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
          await sleep(Math.min(30000, 1000 * 2 ** failures));
          const st = await sessionFetch(`/api/messages/uploads/${current.id}`, { cache: "no-store", signal }).catch(
            () => null
          );
          if (st?.ok) {
            current = ((await st.json()) as { upload: ServerChatUpload }).upload;
            const synced = Math.floor(current.receivedBytes / chunkBytes);
            for (let i = 0; i < synced && i < totalChunks; i++) {
              if (!pumpState.completed.has(i)) pumpState.completed.add(i);
            }
            if (synced > pumpState.nextIndex) pumpState.nextIndex = synced;
          }
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
    const res = await sessionFetch(`/api/messages/uploads/${current.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as { upload?: ServerChatUpload; error?: string; success?: boolean };
    if (!res.ok || !data.upload?.attachment?.url) {
      throw new Error(data.error || "Complete failed");
    }
    onPercent(100);
    return data.upload.attachment;
  }

  if (current.attachment?.url) return current.attachment;
  throw new Error(current.error || "Upload failed");
  } finally {
    clearChunkTracking();
  }
}

export async function uploadChatAttachment(
  file: File,
  conversationId: string,
  lang: "el" | "en",
  onPercent: (pct: number) => void,
  signal: AbortSignal,
  trackChunkUploadId?: { current: string | null }
): Promise<ChatUploadAttachment> {
  const kind = chatAttachmentKind(file.type, file.name);
  if (!kind) throw new Error(lang === "en" ? "File type not allowed" : "Μη επιτρεπόμενος τύπος αρχείου");
  const check = validateChatAttachment({ mimeType: file.type, fileName: file.name, size: file.size });
  if (!check.ok) throw new Error(check.message[lang]);

  onPercent(0);
  if (needsChunkedChatUpload(file.size, check.kind)) {
    return uploadLargeVideo(file, conversationId, lang, onPercent, signal, trackChunkUploadId);
  }
  const att = await uploadSmallFile(file, conversationId, signal);
  onPercent(100);
  return att;
}

export async function cancelChatChunkUpload(uploadId: string): Promise<void> {
  await sessionFetch(`/api/messages/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
}