# Brands Directory - RLS Policy Setup

## Problem
Verified brands are not appearing in the `/brands` directory page.

## Solution
Ensure that the `brands` table has a public read policy for verified brands only.

## SQL Setup

```sql
-- Enable RLS on brands table (if not already enabled)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verified brands only
CREATE POLICY "Public read verified brands" ON brands
  FOR SELECT
  USING (verified = true);

-- Allow authenticated users to read all brands (optional - for admin dashboard)
CREATE POLICY "Authenticated read all brands" ON brands
  FOR SELECT
  TO authenticated
  USING (true);
```

## Notes
- This allows anonymous users to see only verified brands in the directory
- Admin dashboard will still work if authenticated users have access to all brands
- Verified brands will appear immediately after verification

