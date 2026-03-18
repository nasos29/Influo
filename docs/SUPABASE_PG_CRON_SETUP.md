# Supabase pg_cron – Auto-close συνομιλιών κάθε 5 λεπτά

## Γιατί χρειάζεται

Το Vercel Hobby plan τρέχει το cron **μία φορά την ημέρα** (μεταμεσονύχτια). Οι συνομιλίες που μένουν ανοιχτές δεν κλείνονται αυτόματα όταν ο χρήστης κλείσει το browser.

Με **Supabase pg_cron + pg_net** μπορείς να καλείς το API σου **κάθε 5 λεπτά** χωρίς Vercel Pro.

## Βήμα 1: Ενεργοποίηση extensions

Στο Supabase Dashboard → SQL Editor, εκτέλεσε:

```sql
-- pg_cron για scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;

-- pg_net για HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Βήμα 2: Δημιουργία cron job

Στο Supabase SQL Editor, αντικατέστησε `YOUR_CRON_SECRET` με το `CRON_SECRET` που έχεις στο Vercel Environment Variables:

```sql
-- Κάθε 5 λεπτά: κλείνει όλες τις inactive συνομιλίες (10+ λεπτά χωρίς μήνυμα)
SELECT cron.schedule(
  'influo-close-inactive-conversations',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://www.influo.gr/api/cron/check-inactive-conversations',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  ) AS request_id;
  $$
);
```

### Αφαίρεση job

```sql
SELECT cron.unschedule('influo-close-inactive-conversations');
```

## Τι συμβαίνει τώρα

1. **Client polling**: Όταν ο χρήστης έχει ανοιχτή τη συνομιλία, το Messaging component καλεί κάθε 5 λεπτά το `/api/conversations/close-if-inactive`. Αν η συνομιλία είναι inactive 10+ λεπτά, κλείνει αμέσως.

2. **Supabase pg_cron**: Κάθε 5 λεπτά καλεί το `/api/cron/check-inactive-conversations` και κλείνει **όλες** τις inactive συνομιλίες (ακόμα κι αν ο browser είναι κλειστός).

3. **Vercel Cron**: Συνεχίζει να τρέχει daily για backup.

## Πηγές

- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
