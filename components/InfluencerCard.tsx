"use client";

import Image from "next/image";
import { Badge, getBadgeStyles } from "../lib/badges";
import Avatar from "./Avatar";
import { categoryTranslations } from "./categoryTranslations";

interface InfluencerCardProps {
  name: string;
  bio: string;
  bio_en?: string | null; // English bio translation
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories?: string[];
  languages?: string[];
  badges?: Badge[];
  lang?: 'el' | 'en';
}

// --- FULL ICONS ---
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"></path></svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);
const FacebookIcon = () => ( // <-- ΝΕΟ ICON
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
);
const TwitterIcon = () => ( // <-- ΝΕΟ ICON (για το twitter/x)
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c1 1 2.45 1.53 4 1.53a10.66 10.66 0 0 0 10-5.83v-.57a4.48 4.48 0 0 0 2-1.39z"></path></svg>
);


// Helper για μορφοποίηση αριθμών (15000 -> 15k)
const formatNum = (num?: number) => {
    if (num === undefined || num === null) return "";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

// Language translations
const languageTranslations: { [key: string]: { el: string; en: string } } = {
  "Ελληνικά": { el: "Ελληνικά", en: "Greek" },
  "Αγγλικά": { el: "Αγγλικά", en: "English" },
  "Γερμανικά": { el: "Γερμανικά", en: "German" },
  "Γαλλικά": { el: "Γαλλικά", en: "French" },
  "Ισπανικά": { el: "Ισπανικά", en: "Spanish" },
  "Ιταλικά": { el: "Ιταλικά", en: "Italian" },
  "Πορτογαλικά": { el: "Πορτογαλικά", en: "Portuguese" },
  "Ρωσικά": { el: "Ρωσικά", en: "Russian" },
  "Κινεζικά": { el: "Κινεζικά", en: "Chinese" },
  "Ιαπωνικά": { el: "Ιαπωνικά", en: "Japanese" },
  "Αλβανικά": { el: "Αλβανικά", en: "Albanian" },
  // Support both Greek and English names
  "Greek": { el: "Ελληνικά", en: "Greek" },
  "English": { el: "Αγγλικά", en: "English" },
  "German": { el: "Γερμανικά", en: "German" },
  "French": { el: "Γαλλικά", en: "French" },
  "Spanish": { el: "Ισπανικά", en: "Spanish" },
  "Italian": { el: "Ιταλικά", en: "Italian" },
  "Portuguese": { el: "Πορτογαλικά", en: "Portuguese" },
  "Russian": { el: "Ρωσικά", en: "Russian" },
  "Chinese": { el: "Κινεζικά", en: "Chinese" },
  "Japanese": { el: "Ιαπωνικά", en: "Japanese" },
  "Albanian": { el: "Αλβανικά", en: "Albanian" },
};

export default function InfluencerCard({
  name,
  bio,
  bio_en,
  avatar,
  verified,
  socials,
  followers,
  categories = [],
  languages = [],
  badges = [],
  lang = 'el',
}: InfluencerCardProps) {
  return (
    <div className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col cursor-pointer relative">
      
      {/* Header Background */}
      <div className="h-20 bg-slate-50 relative">
        {/* Badges - Top Right */}
        {badges.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
            {badges.slice(0, 2).map((badge, idx) => (
              <span
                key={idx}
                className={getBadgeStyles(badge)}
                title={badge.label}
              >
                <span className="text-[10px]">{badge.icon}</span>
                <span className="text-[9px] leading-none">{badge.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      
      <div className="px-5 pb-5 flex-1 flex flex-col">
        
        {/* Avatar & Verified Badge */}
        <div className="relative -mt-12 mb-4">
          <div className="relative w-20 h-20 rounded-full border-2 border-white shadow-md overflow-hidden bg-white">
            <Avatar src={avatar} alt={name} size={80} />
          </div>
          {verified && (
            <div className="absolute bottom-0 left-14 bg-blue-600 text-white p-1 rounded-full border-2 border-white" title="Verified">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
          )}
        </div>

        {/* Name & Bio */}
        <div className="mb-3">
            <h4 className="text-base font-semibold text-slate-900 truncate mb-1">{name}</h4>
            <p className="text-slate-600 text-xs line-clamp-2 h-8 leading-relaxed">
                {lang === 'en' && bio_en ? bio_en : bio}
            </p>
        </div>

        {/* Categories (Tags) */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categories.slice(0, 3).map((cat, i) => {
            const translatedCat = categoryTranslations[cat]?.[lang] || cat;
            return (
              <span
                key={i}
                className="text-[10px] uppercase font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
              >
                {translatedCat}
              </span>
            );
          })}
        </div>

        {/* Footer: Social Stats */}
        <div className="mt-auto pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
            
            {/* Instagram */}
            {socials.instagram && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs bg-slate-50 p-1.5 rounded">
                    <span className="text-pink-600"><InstagramIcon /></span>
                    <span className="font-medium">{formatNum(followers.instagram)}</span>
                </div>
            )}
            
            {/* TikTok */}
            {socials.tiktok && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs bg-slate-50 p-1.5 rounded">
                    <span className="text-black"><TiktokIcon /></span>
                    <span className="font-bold">{formatNum(followers.tiktok)}</span>
                </div>
            )}
            
            {/* YouTube */}
            {socials.youtube && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs bg-slate-50 p-1.5 rounded">
                    <span className="text-red-600"><YoutubeIcon /></span>
                    <span className="font-medium">{formatNum(followers.youtube)}</span>
                </div>
            )}

            {/* Facebook */}
            {socials.facebook && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs bg-slate-50 p-1.5 rounded">
                    <span className="text-blue-700"><FacebookIcon /></span>
                    <span className="font-medium">{formatNum(followers.facebook)}</span>
                </div>
            )}

            {/* Twitter/X */}
            {socials.twitter && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs bg-slate-50 p-1.5 rounded">
                    <span className="text-slate-800"><TwitterIcon /></span>
                    <span className="font-medium">{formatNum(followers.twitter)}</span>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}







