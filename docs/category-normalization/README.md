# Κατηγορίες influencers και brands

Οι κατηγορίες influencers (`influencers.category`) και brands (`brands.industry`, και προαιρετικά `brand_campaigns.category`) μένουν **TEXT**. Πολλές τιμές γράφονται ως canonical keys χωρισμένα με κόμμα, χωρίς κενό, όπως ήδη γίνεται στους influencers (`Lifestyle,Fashion & Style`). Μία παλιά τιμή (`Fashion & Style`) διαβάζεται κανονικά ως λίστα με ένα στοιχείο.

Δεν αλλάζει schema. Το app κανονικοποιεί παλιά ονόματα την ώρα που τα διαβάζει. Το SQL παρακάτω είναι **προαιρετικό** backfill για να αποθηκευτούν τα canonical keys στη βάση.

## Τι έδειξε ο έλεγχος στο live (11 Οκτ 2026, project Influo)

- `brands.industry`: μονή τιμή TEXT. Όλες οι γραμμές ήταν ήδη canonical (`Fashion & Style`, `Beauty & Makeup`, `Γενικά`, κ.λπ.). Καμία δεν ήταν array και καμία δεν είχε παλιό όνομα.
- `influencers.category`: TEXT, συχνά comma-separated. Κάθε token ήταν ήδη canonical. Δεν βρέθηκαν `Beauty`, `Tech`, `Fitness`, ελληνικές ετικέτες ή διαφορά πεζών/κεφαλαίων.
- `brand_campaigns`: 0 γραμμές.

Στον κώδικα (όχι στη βάση) οι λίστες διέφεραν: η εγγραφή επιχείρησης δεν είχε `Γενικά`, και το παλιό `DirectoryFilter` είχε σύντομα ονόματα (`Beauty`, `Tech`, `Fitness`, `Gaming`, `Food`). Υπάρχει και το `docs/MIGRATE_BEAUTY_TO_BEAUTY_MAKEUP.sql` για το παλιό `Beauty`. Αυτά τα aliases τα πιάνει πλέον το `lib/categories.ts`.

## Σειρά

1. Deploy του PR (το app διαβάζει και παλιές και νέες τιμές).
2. Προαιρετικά, στο Supabase SQL editor: `01_normalize_category_values.sql`.
3. Rollback μόνο αν χρειαστεί: `99_rollback.sql`.

Μην τρέξεις το SQL πριν το deploy. Δεν πειράζει `brand_private`, auth ή email verification.
