-- Homepage featured showcase: direct video uploads (no portfolio append).
ALTER TABLE public.creator_media_uploads
  ADD COLUMN IF NOT EXISTS purpose text NULL
    CHECK (purpose IS NULL OR purpose IN ('homepage_showcase'));

COMMENT ON COLUMN public.creator_media_uploads.purpose IS
  'When homepage_showcase, the worker encodes to creator-videos but does not append influencers.videos.';