# Top posts: display, hosting, and AuditPro sync

Influo always shows **3 top-post slots** on a creator profile.

## Selection

1. Take the **best post of each platform** the creator has (Instagram, TikTok, YouTube), ranked by views, or by likes+comments when views are missing.
2. If the creator has fewer than three platforms, **fill leftover slots** with that creator’s next-best posts overall from the platforms they do have.

Examples:

- TikTok only → the top 3 TikTok posts.
- Instagram + TikTok → the best Instagram, the best TikTok, then the next-best post from either.
- Instagram + TikTok + YouTube → the best of each (all three slots filled).

A post that is also in the portfolio still occupies one of these slots. The file is stored once (in the portfolio folder).

## Hosting vs embeds

- **Instagram and TikTok** posts in the 3 slots are self-hosted (`creator-videos` bucket, `HostedVideoPlayer`).
- **YouTube** posts in the 3 slots stay official embeds. They are never downloaded.

The same rule is used by `collectTopPosts` (profile), `collectTopPostsToHost` (which of those slots to download), and `scripts/host_creator_media.py`. When a selected top post is later dropped, the script removes that top-post folder only if no other row still points at it.

## AuditPro sync

AuditPro / the social refresh job may still return and store more than 3 posts per account (`TOP_POSTS_PER_ACCOUNT`, kept as backups when a shown post becomes unavailable).

Sync design:

- Do **not** shrink the stored `accounts[].top_posts` JSON to 3 items on refresh. Keep the sanitized backups.
- After a refresh (and on the hosting job), **host only** `collectTopPostsToHost` — the Instagram/TikTok members of the 3 display slots. Never queue YouTube URLs for download.
- If the 3 slots change, upload any newly selected Instagram/TikTok posts and delete leftover `top-posts/` folders that are no longer referenced (including after a portfolio overlap moves the file).
- Ranking must use the stored views (else likes+comments) so a later refresh can replace a slot when a newer post outranks it.

The profile UI calls `collectTopPosts` and prefers a hosted player when a matching `creator_media` row exists; otherwise it falls back to the official embed.
