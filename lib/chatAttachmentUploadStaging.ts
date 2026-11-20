import path from "node:path";
import { mkdir, rm } from "node:fs/promises";

export {
  assembleSourceFile,
  chunkOnDisk,
  contiguousReceivedBytes,
  expectedChunkLength,
  readChunkHead,
  writeChunkPart,
} from "@/lib/portfolioUploadStaging";

export function chatStagingRoot(): string {
  const fromEnv = process.env.CHAT_ATTACHMENT_STAGING_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), ".chat-attachment-staging");
}

export function chatUploadStagingDir(userId: string, uploadId: string): string {
  return path.join(chatStagingRoot(), userId.toLowerCase(), uploadId.toLowerCase());
}

export async function ensureChatUploadDir(userId: string, uploadId: string): Promise<string> {
  const dir = chatUploadStagingDir(userId, uploadId);
  await mkdir(path.join(dir, "chunks"), { recursive: true });
  return dir;
}

export async function removeChatUploadStaging(userId: string, uploadId: string): Promise<void> {
  const dir = chatUploadStagingDir(userId, uploadId);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}