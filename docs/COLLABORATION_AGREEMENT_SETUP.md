# Collaboration Agreement & Past Brands Setup

## Στόχος
Όταν μια συνεργασία ολοκληρώνεται, το brand προστίθεται αυτόματα στο `past_brands` array του influencer, μόνο αν και οι δύο πλευρές (influencer & brand) αποδεχτούν τους όρους χρήσης.

---

## Database Schema

```sql
-- Add agreement acceptance columns to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS influencer_agreement_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS brand_agreement_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS brand_added_to_past_brands BOOLEAN DEFAULT FALSE;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_proposals_agreement ON proposals(influencer_agreement_accepted, brand_agreement_accepted, status);
```

---

## Workflow

1. **Proposal Created**: Status = 'pending'
2. **Proposal Accepted**: Status = 'accepted' ή 'completed'
3. **Agreement Modal Appears**: 
   - Για influencer (στο dashboard)
   - Για brand (μέσω email ή notification)
4. **Both Accept**: 
   - `influencer_agreement_accepted = true`
   - `brand_agreement_accepted = true`
5. **Auto-Add to Past Brands**: 
   - Προστίθεται το `brand_name` στο `past_brands` array του influencer
   - `brand_added_to_past_brands = true`

---

## Features

- ✅ Modal με όρους χρήσης
- ✅ Checkbox acceptance
- ✅ Αυτόματη προσθήκη σε past_brands όταν και οι δύο αποδεχτούν
- ✅ Email notification για agreement acceptance
- ✅ UI στο influencer dashboard για pending agreements

