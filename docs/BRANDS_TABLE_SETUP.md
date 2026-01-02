# Brands Table Setup for Admin Dashboard

## Database Schema Check

Για να λειτουργεί σωστά το admin dashboard, ο πίνακας `brands` πρέπει να έχει τα εξής columns:

```sql
-- Check if brands table has all required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'brands'
ORDER BY ordinal_position;
```

## Required Columns

Ο πίνακας `brands` πρέπει να έχει:
- `id` (UUID, PRIMARY KEY)
- `brand_name` (TEXT)
- `contact_email` (TEXT)
- `contact_person` (TEXT, nullable)
- `website` (TEXT, nullable)
- `industry` (TEXT, nullable)
- `afm` (TEXT)
- `logo_url` (TEXT, nullable)
- `verified` (BOOLEAN, DEFAULT FALSE)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

## Add Missing Columns (if needed)

```sql
-- Add verified column if it doesn't exist
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Add created_at if it doesn't exist
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
```

## RLS Policies

Για να λειτουργεί το API endpoint (`/api/admin/brands`), δεν χρειάζεται να αλλάξεις RLS policies γιατί χρησιμοποιεί service role key που παρακάμπτει το RLS.

Αν θέλεις να επιτρέψεις στον admin να βλέπει brands απευθείας (χωρίς API), μπορείς να προσθέσεις:

```sql
-- Enable RLS on brands table
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Allow admin to read all brands
CREATE POLICY "Admin can view all brands"
ON brands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'nd.6@hotmail.com' -- Replace with your admin email
  )
);
```

**Σημείωση**: Το API endpoint με service role key είναι πιο αξιόπιστο και δεν χρειάζεται RLS policy.

## Testing

1. Άνοιξε το browser console (F12)
2. Μεταβείτε στο admin dashboard
3. Κάντε κλικ στο "Companies" tab
4. Κάντε κλικ στο "Ανανέωση" button
5. Ελέγξτε το console για logs:
   - `[Admin Dashboard] Fetched X brands` - αν δεις αυτό, τα brands φορτώνονται
   - `Error fetching brands: ...` - αν δεις αυτό, υπάρχει πρόβλημα

## Debugging

Αν τα brands δεν εμφανίζονται:

1. **Ελέγξτε αν υπάρχουν brands στον πίνακα**:
   ```sql
   SELECT COUNT(*) FROM brands;
   SELECT * FROM brands ORDER BY created_at DESC LIMIT 5;
   ```

2. **Ελέγξτε το API endpoint**:
   - Άνοιξε: `http://localhost:3000/api/admin/brands` (ή το production URL)
   - Πρέπει να δεις JSON με `{"success": true, "brands": [...]}`

3. **Ελέγξτε το browser console**:
   - Ανοίξτε Developer Tools (F12)
   - Πατήστε Network tab
   - Κάντε refresh το dashboard
   - Βρείτε το request στο `/api/admin/brands`
   - Δείτε το Response

4. **Ελέγξτε environment variables**:
   - `SUPABASE_SERVICE_ROLE_KEY` πρέπει να είναι ορθό στο `.env.local`

