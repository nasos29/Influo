# Πώς να διαγράψεις χειροκινητά Users από το Supabase Auth

## Μέθοδος 1: Supabase Dashboard (UI) - Εύκολη

1. Άνοιξε το **Supabase Dashboard**: https://supabase.com/dashboard
2. Επίλεξε το project σου
3. Πήγαινε στο **Authentication** → **Users** (αριστερό menu)
4. Βρες τον user που θέλεις να διαγράψεις
5. Κάνε click στο **"..."** menu (3 dots) στα δεξιά
6. Επίλεξε **"Delete user"**
7. Επιβεβαίωσε τη διαγραφή

**Πλεονέκτημα**: Απλό και οπτικό
**Μειονέκτημα**: Αν έχεις πολλούς users, είναι χρονοβόρο

---

## Μέθοδος 2: SQL Editor - Γρήγορη (Προτεινόμενη)

1. Άνοιξε το **Supabase Dashboard**
2. Πήγαινε στο **SQL Editor** (αριστερό menu)
3. Δημιούργησε νέα query
4. Εκτέλεσε ένα από τα παρακάτω:

### Διαγραφή user με συγκεκριμένο email:
```sql
-- Βρες πρώτα το ID του user
SELECT id, email FROM auth.users WHERE email = 'example@email.com';

-- Μετά διαγραφή (αντικατέστησε 'user-uuid-here' με το πραγματικό ID)
DELETE FROM auth.users WHERE id = 'user-uuid-here';
```

### Διαγραφή πολλαπλών users με συγκεκριμένα emails:
```sql
DELETE FROM auth.users 
WHERE email IN (
  'email1@example.com',
  'email2@example.com',
  'email3@example.com'
);
```

### Διαγραφή users που δημιουργήθηκαν πριν από συγκεκριμένη ημερομηνία:
```sql
DELETE FROM auth.users 
WHERE created_at < '2024-01-01'::timestamp;
```

### Διαγραφή όλων των users (ΠΡΟΣΟΧΗ!):
```sql
DELETE FROM auth.users;
```

**⚠️ Προσοχή**: Πάντα κάνε backup πριν διαγράψεις πολλά users!

---

## Μέθοδος 3: API Call (Αν έχεις το Service Role Key)

Μπορείς να χρησιμοποιήσεις το ήδη υπάρχον endpoint ή να φτιάξεις ένα script.

### Option A: cURL command
```bash
curl -X POST http://localhost:3000/api/admin/delete-user \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

### Option B: Node.js script (γρήγορο για πολλούς users)
Δημιούργησε ένα αρχείο `delete-users.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteUserByEmail(email) {
  // 1. Βρες το user ID από το email
  const { data: users, error: findError } = await supabase.auth.admin.listUsers();
  
  if (findError) {
    console.error('Error finding users:', findError);
    return;
  }

  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    console.log(`User with email ${email} not found`);
    return;
  }

  // 2. Διαγραφή
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  
  if (deleteError) {
    console.error('Error deleting user:', deleteError);
  } else {
    console.log(`✅ Deleted user: ${email}`);
  }
}

// Χρήση
deleteUserByEmail('test@example.com');

// Για πολλαπλούς users:
// ['email1@example.com', 'email2@example.com'].forEach(email => {
//   deleteUserByEmail(email);
// });
```

Εκτέλεσε: `node delete-users.js`

---

## Συμβουλή: Cleanup Script για Testing

Αν θέλεις να κάνεις cleanup συχνά, μπορείς να δημιουργήσεις ένα API endpoint:

### `/app/api/admin/cleanup-test-users/route.ts`
```typescript
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { emails } = await request.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    const results = [];

    for (const email of emails) {
      // Find user
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const user = users.find(u => u.email === email);

      if (user) {
        // Delete auth user
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        // Delete from influencers table
        const { error: dbError } = await supabaseAdmin
          .from('influencers')
          .delete()
          .eq('id', user.id);

        results.push({
          email,
          success: !authError && !dbError,
          errors: { auth: authError?.message, db: dbError?.message }
        });
      } else {
        results.push({ email, success: false, error: 'User not found' });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

Χρήση:
```javascript
await fetch('/api/admin/cleanup-test-users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emails: ['test1@example.com', 'test2@example.com']
  })
});
```

---

## ⚠️ Προσοχή

- **Πάντα κάνε backup** πριν διαγράψεις users
- Το **Service Role Key** έχει full access - μην το μοιράζεσαι
- Αν διαγράψεις user, **δεν μπορείς να τον επαναφέρεις** (εκτός αν έχεις backup)
- Έλεγξε ότι διαγράφεις τον **σωστό user** πριν επιβεβαιώσεις

