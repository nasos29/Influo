import type { NextConfig } from "next";

/** Self-hosted / custom Supabase host from env (protocol + hostname + optional port). */
const supabaseEnvRemotePatterns = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!raw) return [];
    const parsed = new URL(raw);
    const protocol = parsed.protocol.replace(/:$/, "");
    if (protocol !== "http" && protocol !== "https") return [];
    if (!parsed.hostname) return [];
    const base = {
      protocol: protocol as "http" | "https",
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    };
    return [
      { ...base, pathname: "/storage/v1/object/public/**" },
      { ...base, pathname: "/storage/v1/render/image/public/**" },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  // heic-convert pulls libheif WASM; keep it external so webpack doesn't break it.
  serverExternalPackages: ["heic-convert", "sharp"],
  // Put <title>, description and canonical in <head> for Googlebot.
  // Next's default list matches Google-* bots but not the plain Googlebot token.
  htmlLimitedBots:
    /Googlebot|Google-InspectionTool|Storebot-Google|GoogleOther|Mediapartners-Google|AdsBot-Google|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  images: {
    // Keep optimized variants warm longer (avatars/logos rarely change).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Allow 75–80 for visible photos; keep 70 for small decorative thumbs.
    // Restore intermediate / 2× widths so srcset can serve retina without
    // jumping to a 1920px fallback.
    qualities: [70, 75, 80],
    formats: ["image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 96, 128, 160, 256, 384],
    // Next 16 defaults to [{ pathname: '**', search: '' }] which rejects any
    // local src with a query string. Allow /api/image-proxy?url=… and keep
    // other local paths working (omit search = any/no query allowed).
    localPatterns: [
      { pathname: "/api/image-proxy" },
      { pathname: "/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/render/image/public/**",
      },
      ...supabaseEnvRemotePatterns,
      {
        protocol: "https",
        hostname: "*.tiktokcdn-us.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "*.tiktok-common-*.ibytedtos.com",
      },
      {
        protocol: "https",
        hostname: "*.ibytedtos.com",
      },
      {
        protocol: "https",
        hostname: "unavatar.io",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
