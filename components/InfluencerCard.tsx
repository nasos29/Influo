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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M9 12a4 4s 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
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
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 transform hover:-translate-y-2 h-full flex flex-col cursor-pointer">
      
      {/* Header Background */}
      <div className="h-28 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 transition-all duration-300 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-purple-400/0 group-hover:from-blue-400/10 group-hover:via-white/30 group-hover:to-purple-400/10 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      </div>
      
      <div className="px-5 pb-5 flex-1 flex flex-col">
        
        {/* Avatar & Verified Badge */}
        <div className="relative -mt-16 mb-4">
          <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white group-hover:scale-110 transition-transform duration-300">
            <Image
              src={avatar}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
          {verified && (
            <div className="absolute bottom-0 left-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white p-1.5 rounded-full border-4 border-white shadow-lg" title="Verified">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
          )}
        </div>

        {/* Name & Bio */}
        <div className="mb-4">
            <h4 className="text-lg font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors mb-1">{name}</h4>
            <p className="text-slate-500 text-xs line-clamp-2 h-8 leading-relaxed">{bio}</p>
        </div>

        {/* Categories (Tags) */}
        <div className="flex flex-wrap gap-2 mb-5">
          {categories.slice(0, 3).map((cat, i) => (
            <span
              key={i}
              className="text-[10px] uppercase font-bold tracking-wider bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 px-3 py-1 rounded-lg border border-slate-200 shadow-sm"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Footer: Social Stats */}
        <div className="mt-auto pt-4 border-t border-slate-200 grid grid-cols-2 gap-2.5">
            
            {/* Instagram */}
            {socials.instagram && (
                <div className="flex items-center gap-2 text-slate-700 text-xs bg-gradient-to-br from-pink-50 to-rose-50 p-2 rounded-lg border border-pink-100 group-hover:shadow-sm transition-all">
                    <span className="text-pink-600"><InstagramIcon /></span>
                    <span className="font-bold">{formatNum(followers.instagram)}</span>
                </div>
            )}
            
            {/* TikTok */}
            {socials.tiktok && (
                <div className="flex items-center gap-2 text-slate-700 text-xs bg-gradient-to-br from-slate-50 to-gray-50 p-2 rounded-lg border border-slate-200 group-hover:shadow-sm transition-all">
                    <span className="text-black"><TiktokIcon /></span>
                    <span className="font-bold">{formatNum(followers.tiktok)}</span>
                </div>
            )}
            
            {/* YouTube */}
            {socials.youtube && (
                <div className="flex items-center gap-2 text-slate-700 text-xs bg-gradient-to-br from-red-50 to-rose-50 p-2 rounded-lg border border-red-100 group-hover:shadow-sm transition-all">
                    <span className="text-red-600"><YoutubeIcon /></span>
                    <span className="font-bold">{formatNum(followers.youtube)}</span>
                </div>
            )}

            {/* Facebook (NEW) */}
            {socials.facebook && (
                <div className="flex items-center gap-2 text-slate-700 text-xs bg-gradient-to-br from-blue-50 to-indigo-50 p-2 rounded-lg border border-blue-100 group-hover:shadow-sm transition-all">
                    <span className="text-blue-700"><FacebookIcon /></span>
                    <span className="font-bold">{formatNum(followers.facebook)}</span>
                </div>
            )}

             {/* Twitter/X (NEW) */}
            {socials.twitter && (
                <div className="flex items-center gap-2 text-slate-700 text-xs bg-gradient-to-br from-slate-50 to-gray-50 p-2 rounded-lg border border-slate-200 group-hover:shadow-sm transition-all">
                    <span className="text-slate-800"><TwitterIcon /></span>
                    <span className="font-bold">{formatNum(followers.twitter)}</span>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}







