import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { sessionFetch } from "@/lib/sessionFetch";
import {
  CHAT_UPLOAD_CHUNK_BYTES,
  needsChunkedChatUpload,
  validateChatAttachment,
  chatAttachmentKind,
} from "@/lib/chatAttachmentUpload";
import {
  SUPABASE_TUS_RETRY_DELAYS,
  SUPABASE_TUS_ALLOWED_META,
  supabaseResumableTusTarget,
} from "@/lib/supabaseClientTus";

export type ChatUploadAttachment = {
  url: string;
  filename?: string;
  size?: number;
  content_type?: string;
};

type InitChatUpload = {
  uploadId: string;
  bucket: string;
  objectName: string;
  token: string;
};

type CompleteChatUpload = {
  upload?: {
    attachment: ChatUploadAttachment | null;
    error?: string | null;
  };
  error?: string;
  success?: boolean;
};

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

function runUppyTusUpload(
  file: File,
  init: InitChatUpload,
  mimeType: string,
  endpoint: string,
  headers: Record<string, string>,
  onPercent: (pct: number) => void,
  signal: AbortSignal
): Promise<void> {
  const uppy = new Uppy({ autoProceed: false, restrictions: { maxNumberOfFiles: 1 } });
  uppy.use(Tus, {
    endpoint,
    headers,
    chunkSize: CHAT_UPLOAD_CHUNK_BYTES,
    retryDelays: [...SUPABASE_TUS_RETRY_DELAYS],
    removeFingerprintOnSuccess: true,
    uploadDataDuringCreation: true,
    allowedMetaFields: [...SUPABASE_TUS_ALLOWED_META],
  });

  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      uppy.cancelAll();
      uppy.destroy();
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    uppy.on("upload-progress", (_file, progress) => {
      if (progress.bytesTotal) {
        onPercent(Math.floor((progress.bytesUploaded / progress.bytesTotal) * 100));
      }
    });

    uppy.on("upload-error", (_file, err) => {
      signal.removeEventListener("abort", onAbort);
      uppy.destroy();
      reject(err);
    });

    uppy.on("complete", (result) => {
      signal.removeEventListener("abort", onAbort);
      uppy.destroy();
      if (result.failed?.length) {
        reject(result.failed[0].error || new Error("TUS upload failed"));
        return;
      }
      resolve();
    });

    try {
      uppy.addFile({
        name: file.name,
        type: mimeType,
        data: file,
        meta: {
          bucketName: init.bucket,
          objectName: init.objectName,
          contentType: mimeType,
          cacheControl: "3600",
        },
      });
    } catch (e) {
      signal.removeEventListener("abort", onAbort);
      uppy.destroy();
      reject(e);
      return;
    }
    void uppy.upload();
  });
}

async function tusUploadWithUppy(
  file: File,
  init: InitChatUpload,
  mimeType: string,
  onPercent: (pct: number) => void,
  signal: AbortSignal
): Promise<void> {
  const signed = supabaseResumableTusTarget({ mode: "signed", signature: init.token });
  await runUppyTusUpload(file, init, mimeType, signed.endpoint, signed.headers, onPercent, signal);
  onPercent(100);
}

async function uploadLargeVideo(
  file: File,
  conversationId: string,
  lang: "el" | "en",
  mimeType: string,
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
      mimeType,
      size: file.size,
      lang,
    }),
    signal,
  });
  const startJson = (await start.json().catch(() => ({}))) as InitChatUpload & { success?: boolean; error?: string };
  if (!start.ok || !startJson.uploadId || !startJson.token || !startJson.objectName || !startJson.bucket) {
    throw new Error(startJson.error || "Could not start upload");
  }

  const uploadId = startJson.uploadId;
  trackChunkUploadId && (trackChunkUploadId.current = uploadId);
  const onAbortCancel = () => {
    void cancelChatChunkUpload(uploadId);
    trackChunkUploadId && (trackChunkUploadId.current = null);
  };
  signal.addEventListener("abort", onAbortCancel, { once: true });
  const clearChunkTracking = () => {
    trackChunkUploadId && (trackChunkUploadId.current = null);
    signal.removeEventListener("abort", onAbortCancel);
  };

  try {
    onPercent(0);
    await tusUploadWithUppy(file, startJson, mimeType, onPercent, signal);

    if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });

    const res = await sessionFetch(`/api/messages/uploads/${uploadId}/complete`, {
      method: "POST",
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as CompleteChatUpload;
    if (!res.ok || !data.upload?.attachment?.url) {
      throw new Error(data.error || data.upload?.error || "Complete failed");
    }
    return data.upload.attachment;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      void cancelChatChunkUpload(uploadId);
    }
    throw err;
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
    return uploadLargeVideo(file, conversationId, lang, check.mimeType, onPercent, signal, trackChunkUploadId);
  }
  const att = await uploadSmallFile(file, conversationId, signal);
  onPercent(100);
  return att;
}

export async function cancelChatChunkUpload(uploadId: string): Promise<void> {
  await sessionFetch(`/api/messages/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
}