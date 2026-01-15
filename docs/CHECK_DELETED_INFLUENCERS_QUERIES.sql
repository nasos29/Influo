-- SQL Queries για έλεγχο διαγραμμένων influencers

-- 1. Ελέγχος αν υπάρχει το influencer στο influencers table:
SELECT id, display_name, contact_email, created_at, updated_at, verified, approved
FROM influencers
WHERE contact_email = 'EMAIL_TO_CHECK'
   OR id = 'USER_ID_TO_CHECK';

-- 2. Ελέγχος αν υπάρχει το auth user:
SELECT id, email, created_at, deleted_at
FROM auth.users
WHERE email = 'EMAIL_TO_CHECK'
ORDER BY created_at DESC;

-- 3. Ελέγχος orphaned auth users (auth user χωρίς influencer record):
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN influencers i ON u.id = i.id
WHERE i.id IS NULL
  AND u.email = 'EMAIL_TO_CHECK';

-- 4. Ελέγχος conversations που μπορεί να διαγράφηκαν με CASCADE:
SELECT c.id, c.influencer_id, c.influencer_email, c.brand_email, c.created_at, c.last_message_at
FROM conversations c
WHERE c.influencer_email = 'EMAIL_TO_CHECK'
   OR c.influencer_id = 'USER_ID_TO_CHECK'
ORDER BY c.created_at DESC;

-- 5. Ελέγχος proposals που μπορεί να διαγράφηκαν:
SELECT p.id, p.influencer_id, p.brand_email, p.brand_name, p.status, p.created_at
FROM proposals p
WHERE p.influencer_id = 'USER_ID_TO_CHECK'
ORDER BY p.created_at DESC;

-- 6. Ελέγχος audit log (αν έχει δημιουργηθεί):
SELECT * 
FROM admin_audit_log 
WHERE action_type = 'delete_user'
  AND (target_email = 'EMAIL_TO_CHECK' OR target_id = 'USER_ID_TO_CHECK')
ORDER BY created_at DESC;

-- 7. Ελέγχος όλων των διαγραφών από admin:
SELECT 
  action_type,
  admin_email,
  target_type,
  target_email,
  target_name,
  created_at,
  ip_address
FROM admin_audit_log
WHERE action_type = 'delete_user'
ORDER BY created_at DESC
LIMIT 50;

-- 8. Ελέγχος διαγραφών από συγκεκριμένο admin:
SELECT 
  action_type,
  target_email,
  target_name,
  created_at,
  ip_address
FROM admin_audit_log
WHERE action_type = 'delete_user'
  AND admin_email = 'ADMIN_EMAIL_TO_CHECK'
ORDER BY created_at DESC;
