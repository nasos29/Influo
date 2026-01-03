-- =====================================================
-- CHECK AND FIX INACTIVITY DETECTION ISSUES
-- =====================================================
-- Run this in Supabase SQL Editor to check for issues

-- 1. Check for triggers that might auto-update timestamps
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'conversations'
ORDER BY trigger_name;

-- 2. Check for functions that update activity timestamps
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

-- 3. Check table structure
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('last_message_at', 'last_activity_influencer', 'last_activity_brand', 'closed_at')
ORDER BY ordinal_position;

-- 4. If you find a problematic trigger, remove it:
-- DROP TRIGGER IF EXISTS trigger_name ON conversations;

-- 5. If you find a problematic function, remove it:
-- DROP FUNCTION IF EXISTS function_name() CASCADE;

-- 6. Verify no triggers exist after cleanup
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'conversations';

-- EXPECTED RESULT: Should show 0 triggers (or only legitimate ones like updated_at triggers)

