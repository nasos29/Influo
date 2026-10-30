import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_PREFIXES = [
  "/login",
  "/dashboard",
  "/admin",
  "/help-desk",
  "/logout",
  "/messages",
  "/reset-password",
  "/brand/login",
  "/brand/dashboard",
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();

  // Production *.vercel.app is a duplicate of www. Preview deploys stay up, noindex.
  // /api is excluded by the matcher, so /api/cron/* is never redirected.
  if (host.endsWith(".vercel.app") && !pathname.startsWith("/api/cron")) {
    const productionHost = host === "influo.vercel.app" || process.env.VERCEL_ENV === "production";
    const preview = process.env.VERCEL_ENV === "preview" || !productionHost;
    if (preview) {
      const previewResponse = NextResponse.next();
      previewResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
      return previewResponse;
    }
    const dest = request.nextUrl.clone();
    dest.protocol = "https:";
    dest.hostname = "www.influo.gr";
    dest.port = "";
    return NextResponse.redirect(dest, 308);
  }

  const response = NextResponse.next();

  if (request.method === "GET" && !isPrivatePath(pathname) && !request.nextUrl.search) {
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  }

  return response;
}

/**
 * Real app pages only — skip API, Next internals, and common static assets.
 */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|js|css|woff2?|mp4|webm|map)$).*)",
  ],
};
