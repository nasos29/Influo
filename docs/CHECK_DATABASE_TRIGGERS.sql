-- Check for triggers on conversations table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'conversations';

-- Check for functions that might update activity timestamps
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition ILIKE '%last_activity_influencer%'
    OR routine_definition ILIKE '%last_activity_brand%'
  );

-- Check for any scheduled jobs (pg_cron)
SELECT * FROM cron.job;

-- Check for any policies that might auto-update
SELECT * FROM pg_policies WHERE tablename = 'conversations';

