# Reducing Supabase Cached Egress

If you exceed **Cached Egress** usage in Supabase, most of it usually comes from serving **Storage** assets (avatars, logos) directly to browsers. Every page view that shows those images counts as egress. Compressing files helps bytes-per-hit, but **hit volume** still burns egress if browsers talk to Supabase on every view.

## What we did in code

### 1. Image proxy (`/api/image-proxy`) — **on by default**

- **Route:** `app/api/image-proxy/route.ts`
- **Behaviour:** GET `?url=<encoded_supabase_storage_url>`. Fetches the image from Supabase once and returns it with long `Cache-Control` (30 days). Next.js/Vercel caches the response, so subsequent requests are served from cache and **do not hit Supabase**.
- **Security:** Only URLs from your `NEXT_PUBLIC_SUPABASE_URL` are allowed (allowlist).

### 2. Helper `getCachedImageUrl()` (`lib/imageProxy.ts`)

- For any Supabase Storage URL (contains `supabase.co` / `supabase.in` and `/storage/`), returns the proxy URL: `/api/image-proxy?url=...`
- **Default:** proxy rewrite is **enabled**. Set `NEXT_PUBLIC_USE_IMAGE_PROXY=false` (or `0`) to serve Storage URLs directly again.
- Idempotent: already-proxied paths are left unchanged.
- Used via **Avatar**, **FastImage**, **CreatorPhoto**, homepage brand logos, admin/brand dashboards, media kit, etc.

So: avatars and logos from Storage load via the proxy. After the first request per image, traffic is served from the app’s cache instead of Supabase, which reduces Storage egress.

### 3. Upload compression (`prepareImageForStorage`)

- Resize + WebP/JPEG before upload; keep the original when the encoded blob is **not smaller**.
- Smaller objects → fewer MB egress even on cold (first) proxy fetches.

## Other ways to reduce egress

1. **Cloudflare in front of Supabase**  
   Put Cloudflare (or another CDN) in front of your Supabase project’s Storage URL so that images are cached at the edge. Supabase has docs on custom domains / CDN.

2. **Move images to another provider**  
   Use Cloudinary, Imgix, or Vercel Blob for uploads and serve from there; then Supabase Storage is only for upload/origin, not for every page view.

3. **Upgrade or add-on**  
   Supabase Pro (or egress add-ons) gives more included egress.

## Opt out of the proxy

If you put a CDN in front of Storage and prefer direct URLs:

```bash
NEXT_PUBLIC_USE_IMAGE_PROXY=false
```

Or stop calling `getCachedImageUrl()` and use the raw Storage URL (not recommended without another CDN).
