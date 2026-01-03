-- If you find a trigger that auto-updates activity timestamps, remove it:

-- Example: Remove trigger if it exists
-- DROP TRIGGER IF EXISTS update_activity_timestamp ON conversations;

-- Example: Remove function if it exists
-- DROP FUNCTION IF EXISTS update_activity_timestamp() CASCADE;

-- List all triggers on conversations table to see what's there
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'conversations';

