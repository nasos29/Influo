-- Additive: hosted Instagram/TikTok photo posts and carousels (not only video).
ALTER TABLE public.creator_media
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';

ALTER TABLE public.creator_media DROP CONSTRAINT IF EXISTS creator_media_media_type_check;
ALTER TABLE public.creator_media
  ADD CONSTRAINT creator_media_media_type_check
  CHECK (media_type IN ('video', 'photo', 'carousel'));

ALTER TABLE public.creator_media
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.creator_media.media_type IS
  'video = self-hosted mp4; photo = single WebP; carousel = multiple WebP slides in metadata.';
COMMENT ON COLUMN public.creator_media.metadata IS
  'Extra fields (e.g. carousel_urls with ordered public image URLs).';