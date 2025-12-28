# Counter-Proposal System Setup

## Database Schema

```sql
-- Add counter-proposal columns to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS counter_proposal_budget TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS counter_proposal_status TEXT DEFAULT 'none'; -- 'none', 'pending', 'accepted', 'rejected'
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS counter_proposal_message TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS counter_proposal_created_at TIMESTAMPTZ;
```

## Workflow

1. **Brand sends proposal** → Status: 'pending'
2. **Influencer reviews** → Can:
   - ✅ Accept original proposal
   - 💰 Counter-propose (suggest higher budget)
   - 💬 Discuss in messages
3. **Counter-proposal sent** → Email to brand
4. **Brand reviews** → Can accept/reject counter-proposal

