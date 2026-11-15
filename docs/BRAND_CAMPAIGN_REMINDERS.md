# Brand campaign reminders

Polite, rate-limited Greek emails (+ web push) for brands: draft publish nudges, weekly “create a campaign” nudges, and once-per-campaign events (slots filled / closed).

## Channels (2026-11-15)

| Kind | Channel | Why |
|------|---------|-----|
| `draft_day3`, `draft_day10` | **Resend** | Low volume, personalized |
| `target_reached`, `campaign_closed` | **Resend** | Low volume, personalized |
| `no_campaign_nudge` | **Zoho Campaigns** (when flag ON) | ~weekly bulk; keeps Resend quota for transactional |

When `BRAND_WEEKLY_NUDGE_ZOHO_ENABLED` is off, the weekly nudge falls back to Resend one-by-one (legacy).

## Enable (nothing sends until you do)

| Env | Default | Meaning |
|-----|---------|---------|
| `BRAND_CAMPAIGN_REMINDERS_ENABLED` | off | Resend path (drafts + events). Must be `1` / `true` / `yes`. |
| `BRAND_CAMPAIGN_REMINDERS_LIVE` | off | When off, Resend mail is redirected to the test inbox. |
| `BRAND_WEEKLY_NUDGE_ZOHO_ENABLED` | off | Weekly nudge via Zoho (temp list → one campaign). |
| `BRAND_WEEKLY_NUDGE_ZOHO_LIVE` | falls back to `BRAND_CAMPAIGN_REMINDERS_LIVE` | When off, Zoho sends **only** to the test recipient; no `brand_reminder_log` for real brands. |
| `BRAND_CAMPAIGN_REMINDERS_TEST_RECIPIENT` | `nd.6@hotmail.com` | Test inbox when not live. |
| `BRAND_REMINDERS_UNSUB_SECRET` | falls back to `CRON_SECRET` | HMAC secret for Resend unsubscribe links. |

### Zoho credentials (already used for announcements)

Required on the server (never commit):

- `ZOHO_CAMPAIGNS_CLIENT_ID` / `CLIENT_SECRET` / `REFRESH_TOKEN`
- `ZOHO_CAMPAIGNS_LIST_KEY_CREATORS` / `LIST_KEY_BRANDS` (readiness check; nudge uses a **temporary** list)
- `ZOHO_CAMPAIGNS_FROM_EMAIL` / `FROM_NAME` / `TOPIC_ID` (EU: `accounts.zoho.eu` / `campaigns.zoho.eu`)

Without credentials, Zoho nudge returns `zoho_credentials_missing` and does **not** fall back to Resend.

Recommended rollout:

1. Apply migration `supabase/migrations/20261115190000_brand_reminder_log.sql` if not already applied.
2. Dry-run: `GET /api/cron/brand-campaign-reminders?dry_run=1`.
3. Zoho test: `BRAND_WEEKLY_NUDGE_ZOHO_ENABLED=1`, keep `…_LIVE` off → one Zoho campaign to test inbox only.
4. Resend events: `BRAND_CAMPAIGN_REMINDERS_ENABLED=1` with LIVE off first, then LIVE on when Resend quota is healthy.
5. Zoho live: `BRAND_WEEKLY_NUDGE_ZOHO_LIVE=1` (or share `BRAND_CAMPAIGN_REMINDERS_LIVE=1`).

## Cron endpoint

`GET /api/cron/brand-campaign-reminders`  
Auth: `Authorization: Bearer $CRON_SECRET` (same as other Influo crons / `/opt/influo/cron-run.sh`).

- `?dry_run=1` — JSON list of who would get what; **no** send, **no** log writes. Works even when flags are OFF.
- Quiet window: **10:00–19:00 Europe/Athens** (outside → skip unless dry-run).
- Public Zoho body: `GET /api/public/zoho-brand-nudge-content` (fetched by Zoho as `content_url`).

### Suggested crontab (UTC)

Winter: 08:15 UTC ≈ 10:15 Athens.

```cron
15 8 * * * /opt/influo/cron-run.sh /api/cron/brand-campaign-reminders
```

Temp Zoho list cleanup (already installed hourly):

```cron
0 * * * * /opt/influo/cron-run.sh /api/cron/zoho-temp-list-cleanup
```

## Anti-spam

- Reminder kinds (`draft_day3`, `draft_day10`, `no_campaign_nudge`): max **1 per brand per 7 days**.
- Draft: max **2 per campaign** (day 3 + day 10).
- No-campaign nudge: max every 7 days, stop after **4** unanswered in a row; skip if brand created any campaign in last **14** days.
- Events (`target_reached`, `campaign_closed`): exempt from the 7-day cap; deduped once per campaign via `brand_reminder_log`.
- Manual close only for `campaign_closed` event (auto-close stays on `campaign-lifecycle`).
- Respects `reminders_email_opted_out` and `announcements_email_opted_out`.
- Resend reminder emails include unsubscribe → `/api/email/unsubscribe-brand-reminders`.
- Zoho campaigns: Zoho unsubscribe; best-effort pull of list `unsub` → `reminders_email_opted_out`.

## From address

- Resend: `Influo <support@influo.gr>` (Reply-To support).
- Zoho: `ZOHO_CAMPAIGNS_FROM_EMAIL` / `FROM_NAME` (verified sender, typically `support@influo.gr`).
