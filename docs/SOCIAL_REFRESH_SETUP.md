# Ανανέωση Social Stats (followers, engagement rate, avg likes)

Η εφαρμογή μπορεί να ανανεώνει τα στοιχεία των influencers από τα social (followers, average likes, engagement rate), με βάση το **username** στο πεδίο "Σύνδεση" (accounts) για κάθε πλατφόρμα.

- **Instagram**: δεδομένα μέσω **Auditpr** (δεύτερη εφαρμογή) – χωρίς χρέωση Apify.
  - Αν το Auditpr τρέχει **τοπικά** στο PC: όταν πατήσεις **«Ανανέωση»** για έναν influencer, εμφανίζεται prompt για **Auditpr URL** (π.χ. `http://localhost:8000`). Το **browser** καλεί το τοπικό Auditpr και στέλνει τα δεδομένα στο Influo – έτσι το Instagram ενημερώνεται και με τοπικό Auditpr.
  - Αν το Auditpr είναι **online**: μπορείς να αφήσεις κενό το prompt (server θα χρησιμοποιήσει `AUDITPR_BASE_URL`).
- **TikTok**: δεδομένα **απευθείας από Apify** από το Influo – **χρήση Apify συνετή** (έχει χρέωση).

## Κουμπί ανανέωσης στο Admin Dashboard

Στο **Admin Dashboard** (influo.gr/admin):

1. **Ανανέωση για έναν influencer**: στη λίστα Influencers, κάθε γραμμή έχει κουμπί **«Ανανέωση»** – ενημερώνει μόνο τον συγκεκριμένο influencer.
2. **Ανανέωση για όλους**: πάνω από τον πίνακα υπάρχει κουμπί **«Ανανέωση social stats για όλους»** – ενημερώνει όλους τους influencers που δεν έχουν ανανεωθεί τις τελευταίες 30 ημέρες (απαιτεί στήλη `last_social_refresh_at` – τρέξε `docs/ADD_LAST_SOCIAL_REFRESH.sql`).

Δεν χρειάζεται CRON_SECRET· το κουμπί καλεί το `/api/admin/refresh-social-stats`.

**Ανανέωση για έναν influencer με τοπικό Auditpr:** Πάτα «Ανανέωση» στη γραμμή του influencer. Αν έχει Instagram account, θα εμφανιστεί prompt «Auditpr URL». Βάλε `http://localhost:8000` (ή το URL όπου τρέχει το Auditpr στο PC σου) και OK. Το browser θα καλέσει το τοπικό Auditpr και θα στείλει τα δεδομένα στο Influo. Το URL αποθηκεύεται στο localStorage ώστε να μην το ξαναγράφεις.

## Test: Ραφαηλία Ξυλιά

- Instagram: [rafaella.runs](https://instagram.com/rafaella.runs)
- Προφίλ Influo: [influencer/6ff1afa6-7a55-4a15-9538-9405e8da6652](https://www.influo.gr/influencer/6ff1afa6-7a55-4a15-9538-9405e8da6652)

### Βήματα για test

1. **Supabase**: Τρέξε (προαιρετικά για monthly cron) το `docs/ADD_LAST_SOCIAL_REFRESH.sql` ώστε να υπάρχει η στήλη `last_social_refresh_at`.
2. **Env στο Influo** (`.env.local` ή Vercel):
   - `AUDITPR_BASE_URL` = base URL του Auditpr (π.χ. `http://localhost:8000` ή `https://your-auditpr.vercel.app`)
   - `APIFY_API_TOKEN` = token από [Apify Console](https://console.apify.com/account/integrations) (για TikTok)
   - (προαιρετικά) `CRON_SECRET` = secret για προστασία του cron
3. **Auditpr**: Για Instagram πρέπει να τρέχει το backend και να έχει συγχρονισμένο IG session (Sessions → Sync session με cookies Instagram).
4. **Κλήση test**:
   ```bash
   # Χωρίς CRON_SECRET
   curl "https://your-influo.vercel.app/api/cron/refresh-social-stats?influencerId=6ff1afa6-7a55-4a15-9538-9405e8da6652"

   # Με CRON_SECRET
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://your-influo.vercel.app/api/cron/refresh-social-stats?influencerId=6ff1afa6-7a55-4a15-9538-9405e8da6652"
   ```
5. Το response θα περιέχει `refreshed: 1` και `results` με τα accounts που ενημερώθηκαν (ή errors αν π.χ. δεν τρέχει το Auditpr / λάθος username).

## Μηνιαίο cron (1 φορά το μήνα)

1. Τρέξε `docs/ADD_LAST_SOCIAL_REFRESH.sql` στο Supabase.
2. Ρύθμισε cron (π.χ. Vercel Cron) να καλεί:
   ```text
   GET /api/cron/refresh-social-stats
   Authorization: Bearer YOUR_CRON_SECRET
   ```
   Χωρίς `influencerId`: θα ενημερωθούν όλοι οι influencers που έχουν `last_social_refresh_at` null ή παλιότερο από 30 ημέρες.
3. **Apify**: Χρήση μόνο για TikTok (συνετή – ένα run ανά TikTok account ανά μήνα).

## Σημειώσεις

- Το πεδίο "Σύνδεση" αντιστοιχεί στα **accounts** (platform + username). Μόνο **Instagram** και **TikTok** υποστηρίζονται για refresh.
- Αν λείπει `AUDITPR_BASE_URL`, τα Instagram accounts θα παραλείπονται (error στο result).
- Αν λείπει `APIFY_API_TOKEN`, τα TikTok accounts θα αποτύχουν.
