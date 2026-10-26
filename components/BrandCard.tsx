"use client";

import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import FastImage from "@/components/FastImage";
import { formatCategoryLabels } from "@/lib/categories";
import { toPublicHttpsHref } from "@/lib/brandProfile";

interface BrandCardProps {
  id: string;
  brand_name: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  verified: boolean;
  bio?: string | null;
  city?: string | null;
  instagram?: string | null;
  lang?: 'el' | 'en';
}

export default function BrandCard({
  id,
  brand_name,
  contact_person,
  website,
  industry,
  logo_url,
  verified,
  bio,
  city,
  instagram,
  lang = 'el',
}: BrandCardProps) {
  const bioText = (bio || "").trim();
  return (
    <div className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
      {/* Header Background */}
      <div className="h-20 bg-gradient-to-r from-blue-50 to-purple-50 relative">
        {/* Verified Badge - Top Right */}
        {verified && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm" title={lang === 'el' ? 'Επαληθευμένη' : 'Verified'}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        )}
      </div>
      
      <div className="px-5 pb-5 flex-1 flex flex-col">
        {/* Logo & Verified Badge */}
        <div className="relative -mt-12 mb-4">
          <div className="relative w-full h-24 rounded-lg border-2 border-white shadow-md overflow-hidden bg-white flex items-center justify-center">
            {logo_url && logo_url.trim() !== '' ? (
              <FastImage
                src={getCachedImageUrl(logo_url) ?? logo_url}
                alt={brand_name}
                fill
                sizes="200px"
                quality={75}
                className="object-contain p-1"
                onError={(e) => {
                  console.error('[BrandCard] Failed to load logo:', logo_url);
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.fallback-logo')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'fallback-logo absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold rounded-lg';
                    fallback.textContent = brand_name.charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold rounded-lg">
                {brand_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Brand Name & Industry */}
        <div className="mb-3">
          <h4 className="text-base font-semibold text-slate-900 truncate mb-1">{brand_name}</h4>
          {industry && (
            <p className="text-slate-600 text-xs mb-2">{formatCategoryLabels(industry, lang)}</p>
          )}
          {city && (
            <p className="text-slate-500 text-xs mb-1">{city}</p>
          )}
        </div>

        {bioText ? (
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              {lang === 'el' ? 'Για το brand' : 'About the brand'}
            </p>
            <p className="text-xs text-slate-700 line-clamp-4 whitespace-pre-wrap">{bioText}</p>
            {(website || instagram) && (
              <div className="mt-2 flex flex-col gap-1 text-xs">
                {website && toPublicHttpsHref(website) && (
                  <a
                    href={toPublicHttpsHref(website)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {instagram && toPublicHttpsHref(instagram) && (
                  <a
                    href={toPublicHttpsHref(instagram)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Instagram
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
        /* Contact Info (no public bio yet) */
        <div className="flex flex-col gap-2 mb-4 text-xs text-slate-600">
          {contact_person && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{contact_person}</span>
            </div>
          )}
          {website && toPublicHttpsHref(website) && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <a 
                href={toPublicHttpsHref(website)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>
        )}

        {/* Footer: Verified Badge */}
        <div className="mt-auto pt-3 border-t border-slate-200">
          {verified && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-medium">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{lang === 'el' ? 'Επαληθευμένη Επιχείρηση' : 'Verified Brand'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

