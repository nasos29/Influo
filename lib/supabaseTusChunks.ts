/** Supabase Storage TUS requires 6 MiB chunks (except the last). */
export const SUPABASE_TUS_CHUNK_BYTES = 6 * 1024 * 1024;

export function tusChunkLengthAtOffset(offset: number, totalBytes: number): number {
  if (offset >= totalBytes || totalBytes <= 0) return 0;
  return Math.min(SUPABASE_TUS_CHUNK_BYTES, totalBytes - offset);
}

export function tusChunkCount(totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.ceil(totalBytes / SUPABASE_TUS_CHUNK_BYTES);
}