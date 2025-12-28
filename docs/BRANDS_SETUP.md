# Brands System Setup

## Database Schema

```sql
-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    contact_email TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    afm TEXT NOT NULL,
    website TEXT,
    industry TEXT,
    company_size TEXT,
    bio TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE
);

-- Add brand_id to proposals (optional reference)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_email ON brands(contact_email);
CREATE INDEX IF NOT EXISTS idx_proposals_brand_id ON proposals(brand_id);

-- Enable RLS
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Policy: Brands can read their own data
CREATE POLICY "Brands can view own data" ON brands
    FOR SELECT USING (auth.uid() = id);

-- Policy: Brands can update their own data
CREATE POLICY "Brands can update own data" ON brands
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Brands can insert their own data
CREATE POLICY "Brands can insert own data" ON brands
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON brands
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');
```

