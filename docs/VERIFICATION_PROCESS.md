# Verification Process - Influo.gr

## Πώς Πιστοποιείται ένας Influencer

### Τρέχουσα Διαδικασία (Manual Admin Verification)

**Στο Admin Dashboard:**
1. Ο influencer υποβάλλει αίτηση εγγραφής
2. Ο admin ελέγχει:
   - ✅ Profile completeness
   - ✅ Screenshot insights (engagement rate, audience demographics)
   - ✅ Social media accounts
   - ✅ Profile quality
3. Ο admin αλλάζει το `verified` flag στο database

**SQL:**
```sql
-- Admin changes verified status
UPDATE influencers 
SET verified = true 
WHERE id = 'influencer-uuid';
```

### Προτεινόμενη Βελτιωμένη Διαδικασία

#### Phase 1: Enhanced Manual Verification
- ✅ Profile completeness score
- ✅ Screenshot verification (insights_urls)
- ✅ Social media link verification
- ✅ Admin notes/reasoning field

#### Phase 2: Semi-Automated (Future)
- 🔄 Instagram/TikTok API integration (verify followers)
- 🔄 Automated engagement rate calculation
- 🔄 Fake follower detection
- 🔄 Content quality check

#### Phase 3: Full Automation (Future)
- 🤖 AI-powered profile verification
- 🤖 Automated screenshot analysis
- 🤖 Real-time engagement tracking
- 🤖 Fraud detection algorithms

---

## Implementation

### Current Verification Status Field

Ο influencer έχει ένα `verified` boolean field:
```sql
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
```

### Enhanced Verification (Optional)

Μπορείς να προσθέσεις:
```sql
-- Add verification metadata
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS verification_score INTEGER DEFAULT 0; -- 0-100
```

### Admin Verification UI

Στο Admin Dashboard, υπάρχει ήδη το `toggleStatus` function που αλλάζει το `verified` flag.

---

## Verification Checklist

### Required for Verification:
- [ ] Profile complete (name, bio, location, email)
- [ ] At least one social media account
- [ ] Profile photo uploaded
- [ ] Insights screenshots uploaded (showing engagement & demographics)
- [ ] Email verified

### Optional but Recommended:
- [ ] Multiple social platforms
- [ ] Video highlights/portfolio
- [ ] Past brand collaborations
- [ ] High engagement rate (>3%)
- [ ] Consistent content quality

---

## Status

**Current:** Manual admin verification ✅
**Next:** Enhanced verification with scoring (pending)
**Future:** Automated verification with APIs (planned)

