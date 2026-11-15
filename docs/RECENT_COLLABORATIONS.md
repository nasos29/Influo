# Recent collaborations (social proof)

Additive migration: `supabase/migrations/20261115200000_recent_collaborations_showcase.sql`

**Do not apply to production from an agent task** — enable via your normal migration process after review.

## Behaviour

- Public cards require **both** `brand_showcase_consent` and `influencer_showcase_consent` (default `false`).
- Admin can `showcase_admin_hidden` / `showcase_admin_pinned`.
- Post URLs: Instagram / TikTok / YouTube **https** only — never store video files.
- Self-reported views/reach are optional and must be labelled **δηλωμένα** in UI.
- Platform numbers live in `platform_social_proof_stats` (service-role only, refreshed ≤ once/day) plus Next.js `unstable_cache` (`revalidate: 86400`).

## Surfaces

- Home + `/campaigns` (+ `/en/campaigns`)
- Agreement accept flow + creator/brand dashboards
- Campaign deliverable submit/approve
- Admin tab «Συνεργασίες»
