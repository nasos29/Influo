# Email Digest Throttling Setup

## Problem
Κάθε φορά που στέλνεται ένα μήνυμα, στέλνονταν digest email αμέσως, με αποτέλεσμα πολλά emails.

## Solution
Προστέθηκε throttling mechanism: digest email στέλνεται μόνο αν έχουν περάσει τουλάχιστον **60 λεπτά** από το τελευταίο digest email.

## Database Update

Τρέξε αυτό το SQL στο Supabase:

```sql
-- Add last_digest_sent_at column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;
```

## How It Works

1. Όταν στέλνεται ένα μήνυμα, ο κώδικας ελέγχει το `last_digest_sent_at` της συνομιλίας
2. Αν έχει περάσει < 60 λεπτά, **δεν** στέλνει digest email (throttling)
3. Αν έχει περάσει ≥ 60 λεπτά, στέλνει digest email με όλα τα μηνύματα της τελευταίας ώρας
4. Ενημερώνει το `last_digest_sent_at` με το current timestamp

## Result

- ✅ **Μόνο ένα digest email ανά 60 λεπτά** ανά συνομιλία
- ✅ Συγκεντρώνει όλα τα μηνύματα της ώρας
- ✅ Στέλνεται σε admin, influencer, και brand
- ✅ Αποφεύγεται spam emails

