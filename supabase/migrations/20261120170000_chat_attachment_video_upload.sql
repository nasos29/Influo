-- Chat attachments: browser TUS to message-attachments + bucket limits for video up to 2 GB.
-- Additive only; portfolio upload tables unchanged.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  true,
  2147483648,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
    'application/pdf', 'text/plain',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = GREATEST(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.message_attachment_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  created_by uuid NOT NULL,
  attachment_kind text NOT NULL CHECK (attachment_kind IN ('video', 'image', 'pdf', 'text')),
  mime_type text NOT NULL,
  file_name text NULL,
  total_bytes bigint NOT NULL CHECK (total_bytes > 0),
  chunk_bytes integer NOT NULL CHECK (chunk_bytes > 0),
  received_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'ready', 'failed', 'cancelled')),
  storage_path text NULL,
  public_url text NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_attachment_uploads_user_idx
  ON public.message_attachment_uploads (created_by, status, created_at DESC);

COMMENT ON TABLE public.message_attachment_uploads IS
  'Resumable chat video uploads via browser TUS; objects in message-attachments bucket.';

ALTER TABLE public.message_attachment_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_attachment_uploads FROM anon, authenticated;