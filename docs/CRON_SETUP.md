# Server-Side Inactivity Checker Setup

## Overview

Αυτό το cron job ελέγχει κάθε 5 λεπτά αν υπάρχουν συνομιλίες που έχουν αδράνεια 10+ λεπτά (5 λεπτά warning + 5 λεπτά close) και τις κλείνει αυτόματα, ακόμα και αν ο χρήστης έχει κλείσει το browser.

## Setup Instructions

### 1. Vercel Cron (Αν χρησιμοποιείς Vercel)

Το `vercel.json` έχει ήδη ρυθμιστεί για Vercel Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactive-conversations",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Αυτό σημαίνει ότι το endpoint θα καλείται **κάθε 5 λεπτά**.

**Σημαντικό**: Μετά το deploy στο Vercel, πρέπει να ενεργοποιήσεις τα Cron Jobs στο Vercel Dashboard:
1. Πήγαινε στο Vercel Dashboard → Project → Settings → Cron Jobs
2. Ενεργοποίησε το cron job

### 2. Environment Variables

Προσθήκη στο `.env` (και στο Vercel Environment Variables):

```env
CRON_SECRET=your-random-secret-key-here
```

Χρησιμοποίησε ένα strong random secret (π.χ. `openssl rand -base64 32`).

### 3. Manual Testing

Μπορείς να δοκιμάσεις το endpoint manual:

```bash
curl -X GET https://www.influo.gr/api/cron/check-inactive-conversations \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Alternative: Supabase Edge Functions

Αν δεν χρησιμοποιείς Vercel, μπορείς να δημιουργήσεις Supabase Edge Function:

1. Δημιούργησε `supabase/functions/check-inactive-conversations/index.ts`
2. Κάνε copy το logic από `app/api/cron/check-inactive-conversations/route.ts`
3. Ρύθμισε Supabase Cron:

```sql
SELECT cron.schedule(
  'check-inactive-conversations',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_get(
    url := 'https://your-project.supabase.co/functions/v1/check-inactive-conversations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    )
  ) AS request_id;
  $$
);
```

### 5. Alternative: External Cron Service

Μπορείς να χρησιμοποιήσεις οποιαδήποτε external cron service (π.χ. cron-job.org, EasyCron) που καλεί το endpoint κάθε 5 λεπτά με το `Authorization: Bearer YOUR_CRON_SECRET` header.

## How It Works

1. **Every 5 minutes**, το cron job καλεί το `/api/cron/check-inactive-conversations`
2. Το endpoint βρίσκει όλες τις συνομιλίες όπου:
   - Δεν είναι ήδη κλειστές (`closed_at IS NULL`)
   - Και οι δύο πλευρές (influencer και brand) έχουν `last_activity` παλαιότερο από **10 λεπτά**
3. Για κάθε inactive συνομιλία:
   - Καλείται το `endConversationInternal` function
   - Η συνομιλία σημαδεύεται ως `closed_at`
   - Στέλνονται emails σε admin, influencer, και brand με ολόκληρη τη συνομιλία

## Timing

- **5 λεπτά αδράνεια**: Client-side warning (από το Messaging component)
- **10 λεπτά αδράνεια**: Auto-close από το cron job (server-side)

Αυτό σημαίνει ότι:
- Αν ο χρήστης έχει ανοιχτό το browser, θα δει το warning στα 5 λεπτά
- Αν ο χρήστης κλείσει το browser, το cron job θα κλείσει τη συνομιλία στα 10 λεπτά

## Security

Το endpoint προστατεύεται με `CRON_SECRET`. Μόνο requests με το σωστό Authorization header θα εκτελεστούν.

## Monitoring

Μπορείς να δεις logs στο Vercel Dashboard → Functions → `/api/cron/check-inactive-conversations` ή στο Supabase Logs αν χρησιμοποιείς Edge Functions.

