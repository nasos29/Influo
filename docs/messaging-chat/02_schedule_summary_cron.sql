-- Βήμα 2, προαιρετικό. Αντικαταστήστε YOUR_CRON_SECRET με το CRON_SECRET του Vercel
-- ΠΡΙΝ το τρέξετε. Κάθε 10 λεπτά στέλνει συνόψεις για συνομιλίες που έμειναν
-- ήσυχες (προεπιλογή 20 λεπτά) και έχουν αδιάβαστα μηνύματα.
--
-- Αν ήδη τρέχει το influo-close-inactive-conversations κάθε 5 λεπτά, αυτό το
-- job είναι επιπλέον· τα ίδια μηνύματα δεν στέλνονται δεύτερη φορά.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('influo-message-summary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'influo-message-summary');

SELECT cron.schedule(
  'influo-message-summary',
  '*/10 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://www.influo.gr/api/cron/message-summary',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
  ) AS request_id;
  $$
);
