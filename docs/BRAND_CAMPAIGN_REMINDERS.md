# Brand campaign reminders

Polite, rate-limited Greek emails (+ web push) for brands: draft publish nudges, weekly “create a campaign” nudges, and once-per-campaign events (slots filled / closed).

## Enable (nothing sends until you do)

| Env | Default | Meaning |
|-----|---------|---------|
| `BRAND_CAMPAIGN_REMINDERS_ENABLED` | off | Master switch. Must be `1` / `true` / `yes`. |
| `BRAND_CAMPAIGN_REMINDERS_LIVE` | off | When off, **all** mail is redirected to the test inbox (never real brands). |
| `BRAND_CAMPAIGN_REMINDERS_TEST_RECIPIENT` | `nd.6@hotmail.com` | Test inbox when not live. |
| `BRAND_REMINDERS_UNSUB_SECRET` | falls back to `CRON_SECRET` | HMAC secret for unsubscribe links. |

Recommended rollout:

1. Apply migration `supabase/migrations/20261115190000_brand_reminder_log.sql` (additive) when ready — **not** from this PR agent.
2. Set `BRAND_CAMPAIGN_REMINDERS_ENABLED=1` with `BRAND_CAMPAIGN_REMINDERS_LIVE` unset/false.
3. Hit dry-run, then a real cron run (mail → test inbox only).
4. Only then set `BRAND_CAMPAIGN_REMINDERS_LIVE=1`.

## Cron endpoint

`GET /api/cron/brand-campaign-reminders`  
Auth: `Authorization: Bearer $CRON_SECRET` (same as other Influo crons / `/opt/influo/cron-run.sh`).

- `?dry_run=1` — JSON list of who would get what; **no** send, **no** log writes. Works even when the feature flag is OFF.
- Quiet window: **10:00–19:00 Europe/Athens** (outside → skip unless dry-run).

### Suggested crontab (do **not** install automatically)

Server TZ is UTC (same as existing Influo crons). Winter: 08:15 UTC ≈ 10:15 Athens.

```cron
15 8 * * * /opt/influo/cron-run.sh /api/cron/brand-campaign-reminders
```

Optional hourly during the window (still respects quiet hours in code):

```cron
15 8-16 * * * /opt/influo/cron-run.sh /api/cron/brand-campaign-reminders
```

## Anti-spam

- Reminder kinds (`draft_day3`, `draft_day10`, `no_campaign_nudge`): max **1 per brand per 7 days**.
- Draft: max **2 per campaign** (day 3 + day 10).
- No-campaign nudge: max every 7 days, stop after **4** unanswered in a row; skip if brand created any campaign in last **14** days.
- Events (`target_reached`, `campaign_closed`): exempt from the 7-day cap; deduped once per campaign via `brand_reminder_log`.
- Manual close only for `campaign_closed` event (auto-close stays on `campaign-lifecycle`).
- Respects `reminders_email_opted_out` and `announcements_email_opted_out`; reminder emails include unsubscribe link → `/api/email/unsubscribe-brand-reminders`.

## From address

`Influo <support@influo.gr>` (Reply-To support), via existing Resend + `mailIdentity`.
