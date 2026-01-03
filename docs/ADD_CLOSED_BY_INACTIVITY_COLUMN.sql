-- Fix for closed_by_inactivity column error
-- Run this SQL in Supabase SQL Editor

-- Option 1: Add the column (Recommended - this will fix the error permanently)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS closed_by_inactivity BOOLEAN DEFAULT FALSE;

-- Option 2: Create RPC function to close conversations (Alternative solution)
-- This function bypasses schema validation
CREATE OR REPLACE FUNCTION update_conversation_closed(
  conv_id UUID,
  closed_at_value TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE conversations 
  SET closed_at = closed_at_value
  WHERE id = conv_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_conversation_closed(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_closed(UUID, TIMESTAMPTZ) TO service_role;

