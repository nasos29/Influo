-- Additive: optional HEVC rendition, kept only when smaller than video.mp4.
ALTER TABLE public.creator_media
  ADD COLUMN IF NOT EXISTS hevc_path text;

COMMENT ON COLUMN public.creator_media.hevc_path IS
  'Optional video-hevc.mp4 path in creator-videos, used when smaller than the H.264 video.mp4.';
