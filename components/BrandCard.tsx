"use client";

import Image from "next/image";
import Link from "next/link";

interface BrandCardProps {
  id: string;
  brand_name: string;
  contact_email: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  logo_url: string | null;
  verified: boolean;
  lang?: 'el' | 'en';
}

export default function BrandCard({
  id,
  brand_name,
  contact_email,
  contact_person,
  website,
  industry,
  logo_url,
  verified,
  lang = 'el',
}: BrandCardProps) {
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
          <div className="relative w-20 h-20 rounded-full border-2 border-white shadow-md overflow-hidden bg-white flex items-center justify-center">
            {logo_url ? (
              <Image
                src={logo_url}
                alt={brand_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {brand_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Brand Name & Industry */}
        <div className="mb-3">
          <h4 className="text-base font-semibold text-slate-900 truncate mb-1">{brand_name}</h4>
          {industry && (
            <p className="text-slate-600 text-xs mb-2">{industry}</p>
          )}
        </div>

        {/* Contact Info */}
        <div className="flex flex-col gap-2 mb-4 text-xs text-slate-600">
          {contact_person && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{contact_person}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{contact_email}</span>
          </div>
          {website && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <a 
                href={website.startsWith('http') ? website : `https://${website}`}
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

