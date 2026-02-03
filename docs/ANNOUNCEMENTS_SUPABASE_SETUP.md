# Ρύθμιση & Επαλήθευση Ανακοινώσεων στο Supabase

## 1. Πώς να δεις το type του `influencers.id`

1. Άνοιξε το **Supabase Dashboard** → το project σου.
2. **Table Editor** (αριστερό μενού) → επέλεξε τον πίνακα **`influencers`**.
3. Πάτα το εικονίδιο **"View table definition"** (ή **SQL Editor** και τρέξε το παρακάτω).

Ή τρέξε στο **SQL Editor**:

```sql
-- Τύπος της στήλης id στον πίνακα influencers
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'id';
```

- Αν βλέπεις **`data_type = 'uuid'`** (ή `udt_name = 'uuid'`) → το `influencers.id` είναι UUID και ταιριάζει με το `auth.users(id)`. **Δεν χρειάζεται άλλη αλλαγή** για τις ανακοινώσεις.
- Αν βλέπεις **`integer`** ή **`bigint`** → το id είναι αριθμητικό. Τότε χρειάζεται η λύση με `auth_user_id` (βλ. ενότητα 3).

---

## 2. Έλεγχος ότι οι πίνακες ανακοινώσεων υπάρχουν

Στο **SQL Editor** τρέξε:

```sql
-- Υπάρχουν οι πίνακες;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('announcements', 'announcement_reads');
```

Πρέπει να εμφανίζονται και τα δύο: `announcements`, `announcement_reads`.

Αν **δεν** υπάρχουν, τρέξε πρώτα το script από το αρχείο **`docs/ANNOUNCEMENTS_SCHEMA.sql`** (όλο το περιεχόμενό του) στο SQL Editor.

---

## 3. Αν το `influencers.id` είναι integer (όχι UUID)

Τότε το `announcements.target_influencer_id` (UUID, σύνδεση με `auth.users`) δεν μπορεί να δείχνει απευθείας στο `influencers.id`.

**Επιλογή Α – Στήλη `auth_user_id` στον πίνακα influencers**

1. Πρόσθεσε στήλη που κρατά το UUID του χρήστη (από `auth.users`). Στο **SQL Editor** τρέξε:

```sql
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

2. Γέμισμα της στήλης: αν κάθε εγγεγραμμένος influencer έχει λογαριασμό στο Supabase Auth, το `auth.users.id` (UUID) πρέπει να αντιστοιχεί σε κάθε γραμμή. Μπορείς να το κάνεις με update (π.χ. αν έχεις mapping email → user id) ή να ενημερώνεται από την εφαρμογή κατά την εγγραφή/σύνδεση.

3. Στο Admin Dashboard, στο dropdown «Συγκεκριμένος influencer», πρέπει να στέλνεται το **UUID** (είτε `influencers.id` αν είναι UUID, είτε `influencers.auth_user_id` αν το id είναι integer). Αν χρησιμοποιείς `auth_user_id`, χρειάζεται μικρή αλλαγή στο frontend ώστε να διαβάζει και να στέλνει το `auth_user_id` αντί για το αριθμητικό `id`.

**Επιλογή Β – Δεν αλλάζεις schema**

Αν το `influencers.id` είναι ήδη **UUID** (ίδιο με `auth.users.id`), τότε δεν χρειάζεται τίποτα· το dropdown στέλνει ήδη το σωστό id.

---

## 4. Γρήγορος έλεγχος ότι όλα ταιριάζουν (UUID περίπτωση)

Τρέξε στο **SQL Editor**:

```sql
-- Έλεγχος τύπων
SELECT
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'id') AS influencers_id_type,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'target_influencer_id') AS target_influencer_id_type;
```

Προτεραιότητα:
- `influencers_id_type` = **uuid** → OK για ανακοινώσεις όπως είναι τώρα.
- `target_influencer_id_type` = **uuid** → σωστό για το `ANNOUNCEMENTS_SCHEMA.sql`.

Αν και τα δύο είναι `uuid`, είσαι σίγουρος ότι η ρύθμιση στο Supabase είναι σωστή για τις ανακοινώσεις.
