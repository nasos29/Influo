-- Create brand_presence table (similar to influencer_presence)
-- This table tracks online/offline status for brands

CREATE TABLE IF NOT EXISTS brand_presence (
  brand_email TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_presence_last_seen ON brand_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_brand_presence_email ON brand_presence(brand_email);

-- Enable RLS
ALTER TABLE brand_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON brand_presence
  FOR ALL USING (true);
