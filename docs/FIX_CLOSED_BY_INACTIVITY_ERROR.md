# Fix for closed_by_inactivity Column Error

## Problem
Το error "Could not find the 'closed_by_inactivity' column" προκαλείται από το Supabase client schema cache που περιέχει παλιό schema.

## Solution

### Option 1: Add the Column to Database (Recommended)

Τρέξε αυτό το SQL στο Supabase SQL Editor:

```sql
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS closed_by_inactivity BOOLEAN DEFAULT FALSE;
```

Αυτό θα λύσει το πρόβλημα οριστικά.

### Option 2: Clear Schema Cache (Temporary)

Αν δεν μπορείς να προσθέσεις το column, μπορείς να κάνεις clear το schema cache στον Supabase Dashboard:
1. Πήγαινε στο Supabase Dashboard → Settings → API
2. Κάνε refresh το schema cache

### Option 3: Use Raw SQL Update

Αν τα παραπάνω δεν δουλεύουν, μπορούμε να χρησιμοποιήσουμε raw SQL query αντί για Supabase client.

