# Reviews & Ratings System - Database Schema

## SQL Setup

```sql
-- Create influencer_reviews table
CREATE TABLE influencer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  brand_email TEXT NOT NULL,
  brand_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  project_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_reviews_influencer ON influencer_reviews(influencer_id);
CREATE INDEX idx_reviews_rating ON influencer_reviews(influencer_id, rating);
CREATE INDEX idx_reviews_created ON influencer_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE influencer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON influencer_reviews
  FOR ALL USING (true);

-- Add columns to influencers table for computed stats
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS avg_response_time INTEGER DEFAULT 24; -- hours
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS completion_rate DECIMAL(5,2) DEFAULT 100.00;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS service_packages JSONB DEFAULT '[]'::JSONB;
```

