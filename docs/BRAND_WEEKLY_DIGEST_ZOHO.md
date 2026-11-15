# Weekly brand influencer digest → Zoho Campaigns

Monday cron emails brands about influencers approved in the previous week.

## Delivery

| Flag | Default | Effect |
|------|---------|--------|
| `BRAND_WEEKLY_DIGEST_ZOHO_ENABLED` | off | `1` = Zoho (temp list → one campaign). Off = **Resend fallback**. |
| `BRAND_WEEKLY_DIGEST_ZOHO_LIVE` | off | `1` = real brand emails + set `brands_notified_at`. Off = test inbox only (no mark). |
| `BRAND_WEEKLY_DIGEST_TEST_RECIPIENT` | `ADMIN_EMAIL` / `nd.6@hotmail.com` | Test recipient when LIVE is off. |

## Rules

- Recipients: brands with `contact_email`, excluding `announcements_email_opted_out`.
- Quiet window: **10:00–19:00 Europe/Athens** (outside → skip unless `dry_run` / `force_quiet_bypass`).
- Content: same HTML as before (generic greeting for Zoho bulk). Public URL: `/api/public/zoho-brand-weekly-digest-content`.
- Zoho unsubscribes → best-effort `announcements_email_opted_out` on brands.

## Cron

```cron
15 8 * * 1 /opt/influo/cron-run.sh /api/cron/weekly-brand-influencer-digest
```

(`08:15` UTC ≈ `10:15` Athens in winter.)

## Ops

```text
# Counts only (safe anytime)
GET /api/cron/weekly-brand-influencer-digest?dry_run=1

# Zoho test outside quiet window (CRON_SECRET required)
# ENABLED=1 LIVE=0 → only test recipient
GET /api/cron/weekly-brand-influencer-digest?force_quiet_bypass=1
```
