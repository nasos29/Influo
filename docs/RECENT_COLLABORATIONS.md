# Recent collaborations (social proof)

Additive migrations:

- `supabase/migrations/20261115200000_recent_collaborations_showcase.sql`
- `supabase/migrations/20261116210000_showcase_optout_notice.sql` (notice + 7-day soft consent)

**Do not apply to production from an agent task** — enable via your normal migration process after review.

## Behaviour

- Public cards require **both** `brand_showcase_consent` and `influencer_showcase_consent` (default `false`).
- Admin can `showcase_admin_hidden` / `showcase_admin_pinned`.
- Post URLs: Instagram / TikTok / YouTube **https** only — never store video files.
- Self-reported views/reach are optional and must be labelled **δηλωμένα** in UI.
- Platform numbers live in `platform_social_proof_stats` (service-role only, refreshed ≤ once/day) plus Next.js `unstable_cache` (`revalidate: 86400`).

## One-click opt-out

- Signed HMAC URL: `/showcase/opt-out?t=...` (optional `lang=en`).
- Sets that party's consent to `false` and `{party}_showcase_opted_out` to `true`.
- Secret: `SHOWCASE_OPTOUT_SECRET` → fallback `CRON_SECRET` → `RESEND_API_KEY`.
- Dashboard toggle still available (`PATCH /api/collaborations/showcase`).

## Inline notice (live path)

- **No separate showcase appearance email.** A short EL/EN line + «Δεν θέλω να εμφανιστεί» is embedded in existing transactional emails when **that recipient’s consent is currently true**:
  - `campaign_deliverable_approved_creator`
  - `campaign_deliverable_approved_brand` (brand confirmation on approve)
  - `deal_complete_creator` / `deal_complete_brand` (collaboration complete, both sides)
  - legacy `collaboration_complete` (when caller passes `showcaseConsent` + `showcaseOptOutUrl`)
- Helper: `showcaseInlineNoticeHtml` in `lib/showcaseMail.ts`.
- Former `SHOWCASE_APPEARANCE_NOTIFY_*` flags no longer send mail (`maybeNotifyShowcaseAppearance` is a no-op).

## Backfill (past collaborations)

- Script: `scripts/showcase-backfill-notice.mts` — **DRY-RUN by default** (lists recipients + sample HTML).
- Columns: `showcase_notice_sent_at`, `showcase_optout_deadline`, `brand_showcase_opted_out`, `influencer_showcase_opted_out`.
- Cron `/api/cron/showcase-optout-deadline` sets consent `true` after deadline if not opted out.

## Surfaces

- Home + `/campaigns` (+ `/en/campaigns`)
- Dedicated listing: `/collaborations` (+ `/en/collaborations`) with brand CTA
- Agreement accept flow + creator/brand dashboards
- Campaign deliverable submit/approve
- Admin tab «Συνεργασίες»
