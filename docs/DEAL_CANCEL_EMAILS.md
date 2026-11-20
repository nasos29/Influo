# Deal-cancel transactional emails (ops)

Cancel flows already validate reason (≥10 chars), send in-app + push, and call `mailDealCancelled` when enabled.

**Prod gap (audit 19 Nov 2026):** `DEAL_CANCEL_EMAILS_ENABLED` was unset, so parties got no cancel email.

## Enable

1. Set `DEAL_CANCEL_EMAILS_ENABLED=1` in production env (`.env.production` on the host).
2. Leave `CAMPAIGN_DEAL_CANCEL_EMAILS_ENABLED` unset so campaign cancels inherit the same flag.
3. Restart the Influo app container only after approval.

No code deploy is required solely for this flag; the paths are already implemented in `lib/dealCancel.ts` and `lib/campaignDealCancel.ts`.

Maria Palli (`7b2b6165-36ce-4fe8-a386-2db73774bac9`) is excluded from creator cancel emails when enabled.