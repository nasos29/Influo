# Απενεργοποίηση Email Επαναφοράς Κωδικού από Supabase

## Το Πρόβλημα
Όταν ένας χρήστης ζητά επαναφορά κωδικού, στέλνονται **2 emails**:
1. Ένα από το Supabase (`noreply@mail.app.supabase.io`)
2. Ένα από το custom σύστημα (`noreply@influo.gr`)

## Η Λύση
Πρέπει να απενεργοποιήσεις το email επαναφοράς κωδικού στο **Supabase Dashboard**.

## Οδηγίες

### Βήμα 1: Πήγαινε στο Supabase Dashboard
1. Άνοιξε το [Supabase Dashboard](https://supabase.com/dashboard)
2. Επίλεξε το project σου
3. Πήγαινε στο **Authentication** → **Email Templates** (αριστερό menu)

### Βήμα 2: Απενεργοποίηση Password Reset Email
1. Βρες το template **"Reset Password"** (ή **"Change Email Address"** αν υπάρχει)
2. Κάνε click για να το ανοίξεις
3. Στο κάτω μέρος του template, θα βρεις επιλογές:
   - **Enable email** checkbox - **ΑΠΕΝΕΡΓΟΠΟΙΗΣΕ το**
   - Ή **Delete template** αν δεν χρειάζεται καθόλου

### Εναλλακτική: Disable All Auth Emails
Αν θέλεις να απενεργοποιήσεις **όλα** τα auth emails (confirmation, magic link, κλπ):

1. Πήγαινε στο **Authentication** → **Settings**
2. Στο **Email Auth** section, βρες **"Enable email confirmations"**
3. **Απενεργοποίησε το** (αν δεν το χρειάζεσαι)
4. Ή πάμε στο **Email Templates** και απενεργοποίησε τα templates που δεν χρειάζεσαι

## Επαλήθευση
Μετά την αλλαγή:
1. Δοκίμασε να ζητήσεις επαναφορά κωδικού
2. Πρέπει να λάβεις **μόνο 1 email** από `noreply@influo.gr`
3. Το email από `noreply@mail.app.supabase.io` δεν θα πρέπει να έρχεται πια

## Σημείωση
- Αυτή η αλλαγή **δεν επηρεάζει** άλλες λειτουργίες (signup, login, κλπ)
- Μόνο το password reset email θα σταματήσει να στέλνεται από το Supabase
- Το custom email που στέλνει το σύστημα θα συνεχίσει να λειτουργεί κανονικά

