-- Public bucket for durable TikTok/Instagram portfolio covers (replaces short-lived signed CDN URLs).
-- Safe to re-run. Apply in Supabase SQL editor / dashboard if the app cannot create the bucket at runtime.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-thumbs',
  'video-thumbs',
  true,
  512000,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (anon) for portfolio covers.
DROP POLICY IF EXISTS "video_thumbs_public_read" ON storage.objects;
CREATE POLICY "video_thumbs_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'video-thumbs');

-- Service role uploads via API; optionally allow authenticated upserts if needed later.
DROP POLICY IF EXISTS "video_thumbs_service_insert" ON storage.objects;
-- No authenticated insert policy: only service role (bypasses RLS) writes from /api/video-thumbnail.
