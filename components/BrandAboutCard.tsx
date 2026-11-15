"use client";

import FastImage from "@/components/FastImage";
import BrandReviewsList from "@/components/BrandReviewsList";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { toPublicHttpsHref } from "@/lib/brandProfile";

export type BrandAboutData = {
  id?: string | null;
  brand_name?: string | null;
  logo_url?: string | null;
  bio?: string | null;
  city?: string | null;
  website?: string | null;
  instagram?: string | null;
  avg_rating?: number | null;
  total_reviews?: number | null;
} | null;

function displayHost(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "") + (u.pathname === "/" ? "" : u.pathname.replace(/\/$/, ""));
  } catch {
    return url.replace(/^https?:\/\//i, "");
  }
}

/**
 * Public “About the brand” card. Hidden when bio is empty and there are no reviews.
 */
export default function BrandAboutCard({
  brand,
  brandId,
  lang = "el",
}: {
  brand: BrandAboutData;
  brandId?: string | null;
  lang?: "el" | "en";
}) {
  const bio = (brand?.bio || "").trim();
  const resolvedId = brandId || brand?.id || null;
  const knownReviewCount = Number(brand?.total_reviews || 0);
  // Keep previous hide-when-empty-bio behavior unless denormalized reviews exist.
  if (!bio && knownReviewCount <= 0) return null;

  const el = lang !== "en";
  const name = (brand?.brand_name || "").trim() || (el ? "Brand" : "Brand");
  const logoSrc = brand?.logo_url ? getCachedImageUrl(brand.logo_url) ?? brand.logo_url : null;
  const city = (brand?.city || "").trim();
  const website = (brand?.website || "").trim();
  const instagram = (brand?.instagram || "").trim();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {el ? "Για το brand" : "About the brand"}
      </p>
      <div className="mt-3 flex items-center gap-3">
        {logoSrc ? (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0">
            <FastImage src={logoSrc} alt={name} fill className="object-contain p-1" sizes="48px" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-lg font-semibold shrink-0">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{name}</p>
          {city ? <p className="text-sm text-slate-500 truncate">{city}</p> : null}
        </div>
      </div>
      {bio ? <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{bio}</p> : null}
      {(website || instagram) && (
        <ul className="mt-4 space-y-2 text-sm">
          {website && toPublicHttpsHref(website) ? (
            <li>
              <a
                href={toPublicHttpsHref(website)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {displayHost(website)}
              </a>
            </li>
          ) : null}
          {instagram && toPublicHttpsHref(instagram) ? (
            <li>
              <a
                href={toPublicHttpsHref(instagram)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                Instagram · {displayHost(instagram)}
              </a>
            </li>
          ) : null}
        </ul>
      )}
      {resolvedId ? (
        <BrandReviewsList
          brandId={resolvedId}
          avgRating={brand?.avg_rating}
          totalReviews={brand?.total_reviews}
          lang={lang}
        />
      ) : null}
    </div>
  );
}
