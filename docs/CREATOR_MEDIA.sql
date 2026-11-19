-- Self-hosted creator videos/photos. Additive only: no data rewrite.
-- Bucket paths: creators/<influencer_id>/{portfolio|top-posts|collabs}/...
-- creator_media rows cascade when the influencer is deleted.
-- Storage folders are queued on influencer delete for a cleanup job
-- (admin delete, self-delete, and direct SQL DELETE all hit this trigger).
-- Top posts: 3 slots (best of each platform, then next-best overall).
-- YouTube stays an official embed and is not stored here. A portfolio
-- duplicate occupies one slot; the file is stored once (portfolio folder).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-videos',
  'creator-videos',
  true,
  52428800,
  ARRAY[
    'video/mp4',
    'video/webm',
    'image/webp',
    'image/avif',
    'image/jpeg',
    'image/png',
    'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "creator_videos_public_read" ON storage.objects;
CREATE POLICY "creator_videos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'creator-videos');

CREATE TABLE IF NOT EXISTS public.creator_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_url_norm text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('portfolio', 'top_post', 'collab')),
  platform text,
  source_video_id text,
  folder_path text NOT NULL,
  play_path text,
  av1_path text,
  hevc_path text,
  poster_path text,
  byte_size bigint,
  duration_ms integer,
  width integer,
  height integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (influencer_id, source_url_norm, kind)
);

CREATE INDEX IF NOT EXISTS creator_media_influencer_status_idx
  ON public.creator_media (influencer_id, status);

COMMENT ON TABLE public.creator_media IS
  'Self-hosted copies of portfolio, top-post, and collaboration videos. Paths live in the creator-videos bucket.';

ALTER TABLE public.creator_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creator_media FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.creator_storage_purge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL,
  prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

COMMENT ON TABLE public.creator_storage_purge IS
  'Queue of Storage prefixes to delete after an influencer row is removed (creators/<id>/).';

ALTER TABLE public.creator_storage_purge ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creator_storage_purge FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_creator_storage_purge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.creator_storage_purge (influencer_id, prefix)
  VALUES (OLD.id, 'creators/' || LOWER(OLD.id::text) || '/');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_queue_storage_purge ON public.influencers;
CREATE TRIGGER trg_influencers_queue_storage_purge
  AFTER DELETE ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_creator_storage_purge();

COMMENT ON FUNCTION public.queue_creator_storage_purge() IS
  'After an influencer is deleted, queue creators/<id>/ for Storage cleanup.';
