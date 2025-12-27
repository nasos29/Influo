# SQL Queries για Cleanup

## ⚠️ Προσοχή: Αυτές οι queries διαγράφουν δεδομένα! Κάνε backup πριν.

---

## 1. Καθαρισμός Πίνακα Influencers

### Διαγραφή όλων των influencers:
```sql
DELETE FROM influencers;
```

### Διαγραφή με συγκεκριμένο email:
```sql
DELETE FROM influencers 
WHERE contact_email = 'thanosd79@hotmail.com';
```

### Διαγραφή μόνο unverified influencers:
```sql
DELETE FROM influencers 
WHERE verified = false;
```

### Διαγραφή influencers που δημιουργήθηκαν πριν από συγκεκριμένη ημερομηνία:
```sql
DELETE FROM influencers 
WHERE created_at < '2024-01-01'::timestamp;
```

---

## 2. Καθαρισμός Auth Users

⚠️ **ΣΗΜΑΝΤΙΚΟ**: Πρέπει πρώτα να διαγράψεις από τον `user_roles` table πριν διαγράψεις από `auth.users`!

### Διαγραφή όλων των auth users:
```sql
-- 1. Διαγραφή από user_roles πρώτα
DELETE FROM user_roles;

-- 2. Μετά διαγραφή από auth.users
DELETE FROM auth.users;
```

### Διαγραφή auth user με συγκεκριμένο email:
```sql
-- Πρώτα βρες το ID
SELECT id, email FROM auth.users WHERE email = 'thanosd79@hotmail.com';

-- Μετά διαγραφή (αντικατέστησε 'user-uuid' με το πραγματικό ID)
DO $$
DECLARE
    user_id uuid;
BEGIN
    SELECT id INTO user_id FROM auth.users WHERE email = 'thanosd79@hotmail.com';
    
    IF user_id IS NOT NULL THEN
        -- 1. Διαγραφή από user_roles πρώτα
        DELETE FROM user_roles WHERE id = user_id;
        -- 2. Μετά από auth.users
        DELETE FROM auth.users WHERE id = user_id;
        RAISE NOTICE 'Deleted user: %', user_id;
    END IF;
END $$;
```

### Διαγραφή orphaned auth users (που δεν υπάρχουν στο influencers):
```sql
-- Αυτό διαγράφει auth users που δεν έχουν αντίστοιχο record στο influencers
-- ΠΡΟΣΟΧΗ: Διαγράφει και από user_roles πρώτα!
DO $$
DECLARE
    user_rec RECORD;
BEGIN
    FOR user_rec IN 
        SELECT u.id, u.email
        FROM auth.users u
        LEFT JOIN influencers i ON u.id = i.id
        WHERE i.id IS NULL
    LOOP
        -- 1. Διαγραφή από user_roles
        DELETE FROM user_roles WHERE id = user_rec.id;
        -- 2. Διαγραφή από auth.users
        DELETE FROM auth.users WHERE id = user_rec.id;
        RAISE NOTICE 'Deleted orphaned user: % (%)', user_rec.email, user_rec.id;
    END LOOP;
END $$;
```

---

## 3. Complete Cleanup (Influencers + Auth Users)

### Διαγραφή όλων των influencers και των αντίστοιχων auth users:
```sql
-- 1. Διαγραφή από user_roles πρώτα
DELETE FROM user_roles 
WHERE id IN (SELECT id FROM influencers);

-- 2. Διαγραφή auth users που έχουν influencer record
DELETE FROM auth.users 
WHERE id IN (SELECT id FROM influencers);

-- 3. Διαγραφή influencers
DELETE FROM influencers;
```

### Cleanup για συγκεκριμένο email (FIXED):
```sql
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Βρες το ID
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'thanosd79@hotmail.com';
    
    IF user_id IS NOT NULL THEN
        -- 1. Διαγραφή από user_roles ΠΡΩΤΑ
        DELETE FROM user_roles WHERE id = user_id;
        
        -- 2. Διαγραφή από influencers
        DELETE FROM influencers WHERE id = user_id;
        
        -- 3. Διαγραφή από auth.users
        DELETE FROM auth.users WHERE id = user_id;
        
        RAISE NOTICE 'Deleted user: %', user_id;
    ELSE
        RAISE NOTICE 'User not found';
    END IF;
END $$;
```

---

## 4. Reset Everything (Full Cleanup)

### Προσοχή: Αυτό διαγράφει ΟΛΑ τα δεδομένα!

```sql
-- 1. Διαγραφή όλων των proposals
DELETE FROM proposals;

-- 2. Διαγραφή από user_roles (πρώτα!)
DELETE FROM user_roles;

-- 3. Διαγραφή όλων των influencers
DELETE FROM influencers;

-- 4. Διαγραφή όλων των auth users
DELETE FROM auth.users;
```

---

## 5. Προβολή Δεδομένων πριν από Cleanup

### Προβολή όλων των influencers:
```sql
SELECT id, display_name, contact_email, verified, created_at 
FROM influencers 
ORDER BY created_at DESC;
```

### Προβολή όλων των auth users:
```sql
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;
```

### Προβολή orphaned auth users (που δεν έχουν influencer record):
```sql
SELECT u.id, u.email, u.created_at
FROM auth.users u
LEFT JOIN influencers i ON u.id = i.id
WHERE i.id IS NULL;
```

### Προβολή influencers χωρίς auth user:
```sql
SELECT i.id, i.display_name, i.contact_email
FROM influencers i
LEFT JOIN auth.users u ON i.id = u.id
WHERE u.id IS NULL;
```

---

## 6. Βοηθητικές Queries

### Count records:
```sql
-- Πλήθος influencers
SELECT COUNT(*) FROM influencers;

-- Πλήθος auth users
SELECT COUNT(*) FROM auth.users;

-- Πλήθος orphaned auth users
SELECT COUNT(*) 
FROM auth.users u
LEFT JOIN influencers i ON u.id = i.id
WHERE i.id IS NULL;
```

### Reset sequence (αν χρησιμοποιείς auto-increment):
```sql
-- Αν έχεις sequence για ID
ALTER SEQUENCE influencers_id_seq RESTART WITH 1;
```

---

## 🎯 Quick Cleanup για το email σου (FIXED - με user_roles):

```sql
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Βρες το ID
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'thanosd79@hotmail.com';
    
    -- Διαγραφή (με σωστή σειρά!)
    IF user_id IS NOT NULL THEN
        -- 1. user_roles ΠΡΩΤΑ (για να μην σπάσει το foreign key)
        DELETE FROM user_roles WHERE id = user_id;
        
        -- 2. influencers
        DELETE FROM influencers WHERE id = user_id;
        
        -- 3. auth.users
        DELETE FROM auth.users WHERE id = user_id;
        
        RAISE NOTICE '✅ Deleted user: %', user_id;
    ELSE
        RAISE NOTICE '❌ User not found';
    END IF;
END $$;
```

---

## 📝 Χρήση στο Supabase Dashboard:

1. Άνοιξε το **Supabase Dashboard**
2. Πήγαινε στο **SQL Editor**
3. Επιλέξτε το **database** σου
4. Αντιγράψε-Επικόλλησε την query που θέλεις
5. Κάνε click **Run**
6. Επιβεβαίωσε την εκτέλεση

---

## ⚠️ Προσοχή:

- **Πάντα κάνε backup** πριν διαγράψεις δεδομένα
- Οι διαγραφές είναι **μη αναστρέψιμες**
- Έλεγξε τα queries **προσεκτικά** πριν τα εκτελέσεις
- Χρησιμοποίησε `SELECT` queries πρώτα για να δεις τι θα διαγραφεί

