"use client";

import Image from "next/image";

interface InfluencerCardProps {
  name: string;
  bio: string;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories?: string[];
}

// --- FULL ICONS ---
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);

// --- NUMBER FORMATTER ---
const formatNum = (num?: number) => {
    if (num === undefined || num === null) return "";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};

export default function InfluencerCard({
  name,
  bio,
  avatar,
  verified,
  socials,
  followers,
  categories = [],
}: InfluencerCardProps) {
  return (
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col cursor-pointer">
      
      {/* Header Background */}
      <div className="h-24 bg-gradient-to-r from-blue-50 to-purple-50 group-hover:from-blue-100 group-hover:to-purple-100 transition-colors"></div>
      
      <div className="px-5 pb-5 flex-1 flex flex-col">
        
        {/* Avatar & Verified Badge */}
        <div className="relative -mt-12 mb-3">
          <div className="relative w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-white">
            <Image
              src={avatar}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
          {verified && (
            <div className="absolute bottom-0 left-14 bg-blue-500 text-white p-1 rounded-full border-2 border-white" title="Verified">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
          )}
        </div>

        {/* Name & Bio */}
        <div className="mb-3">
            <h4 className="text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{name}</h4>
            <p className="text-slate-500 text-xs line-clamp-2 h-8 leading-relaxed">{bio}</p>
        </div>

        {/* Categories (Tags) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.slice(0, 3).map((cat, i) => (
            <span
              key={i}
              className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Footer: Social Stats */}
        <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
            
            {socials.instagram && (
                <div className="flex items-center gap-2 text-slate-600 text-xs bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-pink-600"><InstagramIcon /></span>
                    <span className="font-bold">{formatNum(followers.instagram)}</span>
                </div>
            )}
            
            {socials.tiktok && (
                <div className="flex items-center gap-2 text-slate-600 text-xs bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-black"><TiktokIcon /></span>
                    <span className="font-bold">{formatNum(followers.tiktok)}</span>
                </div>
            )}
            
            {socials.youtube && (
                <div className="flex items-center gap-2 text-slate-600 text-xs bg-slate-50 p-1.5 rounded-lg">
                    <span className="text-red-600"><YoutubeIcon /></span>
                    <span className="font-bold">{formatNum(followers.youtube)}</span>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}







