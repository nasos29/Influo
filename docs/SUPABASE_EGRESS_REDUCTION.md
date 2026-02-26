# Reducing Supabase Cached Egress

If you exceed **Cached Egress** usage in Supabase, most of it usually comes from serving **Storage** assets (avatars, logos) directly to browsers. Every page view that shows those images counts as egress.

## What we did in code

### 1. Image proxy (`/api/image-proxy`)

- **Route:** `app/api/image-proxy/route.ts`
- **Behaviour:** GET `?url=<encoded_supabase_storage_url>`. Fetches the image from Supabase once and returns it with long `Cache-Control` (30 days). Next.js/Vercel caches the response, so subsequent requests are served from cache and **do not hit Supabase**.
- **Security:** Only URLs from your `NEXT_PUBLIC_SUPABASE_URL` are allowed (allowlist).

### 2. Helper `getCachedImageUrl()` (`lib/imageProxy.ts`)

- For any Supabase Storage URL (contains `supabase.co` and `/storage/`), it returns the proxy URL: `/api/image-proxy?url=...`
- Used in: **Avatar** component, **homepage** brand logos, **AdminDashboardContent** (influencer avatars, brand logos), **BrandDashboardContent** (recommendation avatars).

So: avatars and logos from Storage are now loaded via the proxy. After the first request per image, traffic is served from your app’s cache instead of Supabase, which reduces Storage egress.

## Other ways to reduce egress

1. **Cloudflare in front of Supabase**  
   Put Cloudflare (or another CDN) in front of your Supabase project’s Storage URL so that images are cached at the edge. Supabase has docs on custom domains / CDN.

2. **Move images to another provider**  
   Use Cloudinary, Imgix, or Vercel Blob for uploads and serve from there; then Supabase Storage is only for upload/origin, not for every page view.

3. **Resize/compress on upload**  
   Store smaller or compressed images so each request transfers fewer bytes (fewer MB egress per view).

4. **Upgrade or add-on**  
   Supabase Pro (or egress add-ons) gives more included egress.

## Optional: disable proxy

If you want to serve images directly from Supabase again (e.g. after adding a CDN), stop using the proxy by not calling `getCachedImageUrl()` and using the raw Storage URL instead. You can also remove or bypass the proxy route.
