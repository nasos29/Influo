-- Cached Gemini rankings for brand dashboard recommendations.
-- This table already exists in production. Do not run this file again.
-- Service role reads and writes. No client policies.

CREATE TABLE IF NOT EXISTS public.brand_recommendation_cache (
  brand_id uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  profile_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.brand_recommendation_cache ENABLE ROW LEVEL SECURITY;
