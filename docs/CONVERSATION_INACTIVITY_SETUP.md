# Conversation Inactivity & End Conversation Setup

## Database Schema Update

Πρέπει να τρέξεις αυτό το SQL στο Supabase:

```sql
-- Add activity tracking columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_activity_influencer TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_brand TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Add index for activity queries
CREATE INDEX IF NOT EXISTS idx_conversations_activity_influencer 
ON conversations(last_activity_influencer) 
WHERE last_activity_influencer IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_activity_brand 
ON conversations(last_activity_brand) 
WHERE last_activity_brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_closed 
ON conversations(closed_at) 
WHERE closed_at IS NOT NULL;
```

## Features Implemented

1. ✅ **"Τέλος συνομιλίας" Button**: 
   - Προσθήκη κουμπιού στο header της συνομιλίας
   - Όταν πατηθεί, στέλνει email σε όλους (influencer, brand, admin) με ολόκληρη τη συνομιλία

2. ✅ **Inactivity Detection**:
   - Έλεγχος κάθε 5 λεπτά για αδρανότητα
   - Tracking `last_activity_influencer` και `last_activity_brand`
   - Ενημέρωση activity timestamp όταν:
     - Στέλνεται μήνυμα
     - Αλλάζει το input field
     - Focus στο input field

3. ✅ **Inactivity Warning**:
   - Αν υπάρχει αδρανότητα και από τις 2 πλευρές (5+ λεπτά), εμφανίζεται προειδοποιητικό μήνυμα
   - Το μήνυμα λέει ότι η συνομιλία θα κλείσει σε 5 λεπτά

4. ✅ **Auto-Close**:
   - Αν μετά από 5 λεπτά ακόμα υπάρχει αδρανότητα, η συνομιλία κλείνει αυτόματα
   - Στέλνεται email σε όλους με ολόκληρη τη συνομιλία

5. ✅ **Email Notifications**:
   - Νέο email type: `conversation_end`
   - Στέλνεται σε admin, influencer, και brand
   - Περιέχει ολόκληρη τη συνομιλία
   - Δείχνει αν έκλεισε αυτόματα ή χειροκίνητα

## How It Works

1. **Activity Tracking**:
   - Όταν στέλνεται μήνυμα, ενημερώνεται το `last_activity_influencer` ή `last_activity_brand` ανάλογα με τον αποστολέα
   - Όταν ο χρήστης γράφει στο input ή το focus, ενημερώνεται το activity timestamp

2. **Inactivity Check** (κάθε 5 λεπτά):
   - Ελέγχει αν και τα δύο timestamps είναι παλιότερα από 5 λεπτά
   - Αν ναι, εμφανίζει προειδοποιητικό μήνυμα

3. **Auto-Close** (μετά από 5 λεπτά warning):
   - Αν μετά από 5 λεπτά ακόμα υπάρχει αδρανότητα, καλείται το `/api/conversations/end` με `autoClose: true`

4. **Manual Close**:
   - Ο χρήστης μπορεί να πατήσει "Τέλος συνομιλίας" οποιαδήποτε στιγμή
   - Καλείται το `/api/conversations/end` με `autoClose: false`

5. **Email Sending**:
   - Το API endpoint `/api/conversations/end`:
     - Παίρνει όλα τα μηνύματα της συνομιλίας
     - Μαρκάρει τη συνομιλία ως `closed_at`
     - Στέλνει email σε admin, influencer, και brand με type `conversation_end`

## API Endpoints

### POST `/api/conversations/end`
```json
{
  "conversationId": "uuid",
  "autoClose": false
}
```

Response:
```json
{
  "success": true,
  "message": "Conversation closed and emails sent",
  "closedAt": "2024-01-01T12:00:00Z"
}
```

## Email Types

### `conversation_end`
- **Subject**: `🔒 Η συνομιλία τερματίστηκε: {influencerName} ↔ {brandName}`
- **Content**: 
  - Αιτία κλεισίματος (αυτόματο ή χειροκίνητο)
  - Ολόκληρη η συνομιλία
  - Συνολικό πλήθος μηνυμάτων

## Notes

- Η συνομιλία δεν μπορεί να λάβει νέα μηνύματα μετά το κλείσιμο
- Το input field απενεργοποιείται όταν η συνομιλία είναι κλειστή
- Το activity tracking γίνεται client-side για responsiveness
- Το server-side tracking γίνεται όταν στέλνεται μήνυμα

