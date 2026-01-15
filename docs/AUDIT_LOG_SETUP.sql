-- Audit Log Table για tracking διαγραφών και άλλων admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL, -- 'delete_user', 'delete_brand', 'approve_user', etc.
  admin_email TEXT, -- Email του admin που έκανε την ενέργεια
  target_type TEXT NOT NULL, -- 'influencer', 'brand', 'proposal', etc.
  target_id TEXT, -- ID του target (user_id, brand_id, etc.)
  target_email TEXT, -- Email του target (για influencers/brands)
  target_name TEXT, -- Display name του target
  details JSONB, -- Additional details (π.χ. user data before deletion)
  ip_address TEXT, -- IP address του request
  user_agent TEXT, -- User agent του browser
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes για γρήγορη αναζήτηση
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs" ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Query για να δεις τις διαγραφές:
-- SELECT * FROM admin_audit_log WHERE action_type = 'delete_user' ORDER BY created_at DESC;
