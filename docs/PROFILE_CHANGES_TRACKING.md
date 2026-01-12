# Profile Changes Tracking - Implementation

## Περιγραφή

Όταν ένας influencer επεξεργάζεται το προφίλ του και αποθηκεύει τις αλλαγές, το σύστημα:
1. Αποθηκεύει τις παλιές τιμές πριν την ενημέρωση
2. Συγκρίνει παλιές με νέες τιμές για να βρει τι άλλαξε
3. Αποθηκεύει τις αλλαγές στον πίνακα `profile_changes`
4. Όταν ο admin εγκρίνει τον influencer, βλέπει ποιες αλλαγές έγιναν

## Database Schema

### Πίνακας `profile_changes`

```sql
CREATE TABLE profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  old_values JSONB NOT NULL, -- Παλιές τιμές πριν την αλλαγή
  new_values JSONB NOT NULL, -- Νέες τιμές μετά την αλλαγή
  changed_fields TEXT[] NOT NULL, -- Array με τα ονόματα των πεδίων που άλλαξαν
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by_admin BOOLEAN DEFAULT FALSE, -- True όταν ο admin έχει δει τις αλλαγές
  reviewed_at TIMESTAMPTZ
);
```

**Indexes:**
- `idx_profile_changes_influencer` - για γρήγορη αναζήτηση ανά influencer
- `idx_profile_changes_created` - για ταξινόμηση κατά ημερομηνία
- `idx_profile_changes_reviewed` - για αναζήτηση μη-εξετασμένων αλλαγών

**RLS Policies:**
- Admins μπορούν να διαβάζουν όλες τις αλλαγές
- Το σύστημα μπορεί να εισάγει αλλαγές (via service role)
- Admins μπορούν να ενημερώνουν το review status

## API Endpoints

### POST `/api/profile-changes`
Αποθηκεύει αλλαγές προφίλ όταν ένας influencer επεξεργάζεται το προφίλ του.

**Request Body:**
```json
{
  "influencerId": "uuid",
  "oldValues": { /* παλιές τιμές */ },
  "newValues": { /* νέες τιμές */ },
  "changedFields": ["display_name", "bio", ...]
}
```

### GET `/api/profile-changes?influencerId=uuid&unreviewedOnly=true`
Ανακτά τις αλλαγές για έναν influencer. Αν `unreviewedOnly=true`, επιστρέφει μόνο τις μη-εξετασμένες.

### PATCH `/api/profile-changes`
Σημειώνει αλλαγές ως εξετασμένες από τον admin.

**Request Body:**
```json
{
  "changeIds": ["uuid1", "uuid2", ...]
}
```

## Flow

### 1. Influencer Επεξεργάζεται Προφίλ

Όταν ένας influencer αποθηκεύει αλλαγές στο προφίλ του (`DashboardContent.tsx`):

1. **Fetch current values** - Παίρνει τις τρέχουσες τιμές από τη βάση
2. **Compare values** - Συγκρίνει παλιές με νέες τιμές
3. **Find changed fields** - Βρίσκει ποια πεδία άλλαξαν
4. **Save changes** - Καλεί το `/api/profile-changes` για να αποθηκεύσει τις αλλαγές
5. **Update profile** - Ενημερώνει το προφίλ και θέτει `approved: false`

### 2. Admin Βλέπει Αλλαγές

Όταν ο admin ανοίγει το Edit Profile Modal (`AdminDashboardContent.tsx`):

1. **Fetch changes** - Καλεί το `/api/profile-changes?influencerId=...&unreviewedOnly=true`
2. **Display changes** - Εμφανίζει ένα section με:
   - Ημερομηνία αλλαγής
   - Για κάθε πεδίο που άλλαξε:
     - Παλιά τιμή (κόκκινο background)
     - Νέα τιμή (πράσινο background)
3. **Mark as reviewed** - Ο admin μπορεί να σημάνει τις αλλαγές ως εξετασμένες

### 3. Admin Εγκρίνει Influencer

Όταν ο admin εγκρίνει έναν influencer (`toggleApproval`):

1. **Approve influencer** - Ενημερώνει το `approved: true`
2. **Mark changes as reviewed** - Αυτόματα σημάνει όλες τις μη-εξετασμένες αλλαγές ως εξετασμένες
3. **Send email** - Στέλνει email στον influencer

## UI Components

### Profile Changes Display

Στο Admin Dashboard, όταν ανοίγει το Edit Profile Modal, εμφανίζεται ένα section με:

- **Warning banner** - Κίτρινο background με πληροφορία για αλλαγές
- **Change cards** - Κάθε αλλαγή εμφανίζεται σε ξεχωριστό card με:
  - Ημερομηνία
  - Side-by-side σύγκριση (παλιά vs νέα τιμή)
  - Color coding (κόκκινο για παλιά, πράσινο για νέα)

### Field Labels (Greek)

- `display_name` → "Όνομα"
- `bio` → "Βιογραφικό"
- `min_rate` → "Ελάχιστη Χρέωση"
- `location` → "Τοποθεσία"
- `engagement_rate` → "Engagement Rate"
- `avg_likes` → "Μέσος Όρος Likes"
- `category` → "Κατηγορία"
- `languages` → "Γλώσσες"
- `gender` → "Φύλο"
- `accounts` → "Social Media Accounts"
- `videos` → "Videos"
- `avatar_url` → "Avatar"
- `audience_male_percent` → "Άνδρες %"
- `audience_female_percent` → "Γυναίκες %"
- `audience_top_age` → "Κύρια Ηλικιακή Ομάδα"

## Setup Instructions

1. **Run SQL Schema:**
   ```bash
   # Run the SQL file in Supabase SQL Editor
   docs/PROFILE_CHANGES_TRACKING.sql
   ```

2. **Verify API Routes:**
   - `/app/api/profile-changes/route.ts` should be accessible

3. **Test Flow:**
   - Login as influencer
   - Edit profile and save
   - Login as admin
   - View influencer profile
   - Check that changes are displayed
   - Approve influencer
   - Verify changes are marked as reviewed

## Notes

- Οι αλλαγές αποθηκεύονται μόνο όταν υπάρχουν πραγματικές διαφορές
- Arrays (accounts, videos) συγκρίνονται ως JSON strings
- Όταν ο admin εγκρίνει, όλες οι μη-εξετασμένες αλλαγές σημάνονται αυτόματα ως εξετασμένες
- Ο admin μπορεί να σημάνει αλλαγές ως εξετασμένες χωρίς να εγκρίνει τον influencer
