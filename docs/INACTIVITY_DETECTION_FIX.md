# Inactivity Detection Fix

## Προβλήματα που διωρθώθηκαν

1. **Client-side inactivity detection**: Το `updateActivityTimestamp()` καλούνταν συνεχώς στο interval check, οπότε τα timestamps ενημερώνονταν συνεχώς και ποτέ δεν φτάναν τα 5 λεπτά αδράνειας.

2. **Activity timestamp updates**: Τα timestamps ενημερώνονταν και όταν ανοίγει η συνομιλία, που ήταν λάθος.

## Αλλαγές

### 1. `components/Messaging.tsx`
- **Αφαίρεσα** το `updateActivityTimestamp()` από το interval check (γραμμή 209)
- **Αφαίρεσα** το `updateActivityTimestamp()` όταν ανοίγει η συνομιλία (γραμμή 166)
- **Προσέθεσα** καλύτερο logging στο `updateActivityTimestamp()` και `checkInactivity()`

Τώρα το `updateActivityTimestamp()` καλείται **μόνο** όταν:
- Ο χρήστης γράφει στο textarea (`onChange`)
- Ο χρήστης εστιάζει στο textarea (`onFocus`)
- Ο χρήστης στέλνει μήνυμα

### 2. `app/api/cron/check-inactive-conversations/route.ts`
- **Προσέθεσα** καλύτερο logging για debugging
- **Βελτίωσα** το `baseUrl` logic για να χρησιμοποιεί environment variables

### 3. `app/api/test-cron/route.ts` (ΝΕΟ)
- Δημιουργήθηκε test endpoint για manual testing του cron job
- Χρήσιμο για debugging στο local development

## Πώς λειτουργεί τώρα

### Client-side (με ανοιχτό browser)

1. **Όταν ανοίγει συνομιλία**: Τα activity timestamps φορτώνονται από τη database, αλλά **δεν** ενημερώνονται.

2. **Όταν ο χρήστης γράφει/στέλνει**: Το `updateActivityTimestamp()` καλείται και ενημερώνει το timestamp (throttled σε max 1 φορά ανά 30 δευτερόλεπτα).

3. **Όλα τα 1 λεπτό**: Το `checkInactivity()` ελέγχει αν και οι δύο πλευρές είναι inactive για 5+ λεπτά.

4. **Αν βρεθούν 5+ λεπτά αδράνεια**: Εμφανίζεται warning.

5. **5 λεπτά μετά το warning**: Η συνομιλία κλείνει αυτόματα και στέλνονται emails.

### Server-side (cron job)

1. **Κάθε 5 λεπτά**: Το cron job τρέχει (via Vercel Cron).

2. **Ελέγχει**: Συνομιλίες όπου και οι δύο πλευρές είναι inactive για **10+ λεπτά**.

3. **Κλείνει**: Αυτόματα τις inactive συνομιλίες και στέλνει emails.

## Testing

### Test Client-side

1. Άνοιξε μια συνομιλία.
2. **ΜΗΝ** γράφεις τίποτα.
3. Περίμενε 5 λεπτά → θα εμφανιστεί warning.
4. Περίμενε άλλα 5 λεπτά → θα κλείσει αυτόματα.

**Παρακολούθηση**: Άνοιξε το browser console και δες τα logs:
- `[Activity] Updating...` - όταν ενημερώνεται το timestamp
- `[Check Inactivity]` - όταν γίνεται έλεγχος
- `[Check Inactivity] Showing warning` - όταν εμφανίζεται το warning

### Test Server-side (Cron Job)

#### Option 1: Manual Test Endpoint

Κάνε GET request στο `/api/test-cron`:

```bash
# Local development
curl http://localhost:3000/api/test-cron

# Production (με authentication)
curl -H "Authorization: Bearer test-secret-123" https://your-domain.com/api/test-cron
```

Αυτό θα σου δείξει:
- Πόσες συνομιλίες είναι ανοιχτές
- Ποιες είναι inactive
- Πόσα λεπτά έχουν περάσει από την τελευταία δραστηριότητα

#### Option 2: Call Cron Endpoint Directly

```bash
# Local development (θα χρειαστεί να set CRON_SECRET ή να disable auth check)
curl http://localhost:3000/api/cron/check-inactive-conversations

# Production (Vercel Cron sends this automatically)
```

### Vercel Cron Setup

Βεβαιώσου ότι το `vercel.json` έχει:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactive-conversations",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Environment Variables

Βεβαιώσου ότι έχεις:

- `NEXT_PUBLIC_BASE_URL` (optional) - για το base URL στο cron job
- `CRON_SECRET` (optional) - για authentication στο cron endpoint
- `TEST_CRON_SECRET` (optional) - για authentication στο test endpoint

## Debugging Tips

1. **Αν το client-side δεν δουλεύει**:
   - Άνοιξε το browser console
   - Έλεγξε τα logs `[Activity]` και `[Check Inactivity]`
   - Βεβαιώσου ότι τα timestamps ενημερώνονται μόνο όταν γράφεις/στέλνεις

2. **Αν το cron job δεν δουλεύει**:
   - Χρησιμοποίησε το `/api/test-cron` endpoint για να δεις αν βρίσκει inactive συνομιλίες
   - Έλεγξε τα Vercel logs για το cron job
   - Βεβαιώσου ότι το `vercel.json` είναι σωστό

3. **Αν τα timestamps δεν ενημερώνονται**:
   - Έλεγξε τα logs `[Activity]` στο console
   - Βεβαιώσου ότι το throttling (30 seconds) δεν αποτρέπει τις ενημερώσεις

