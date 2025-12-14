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

// Simple SVG Icons components to avoid external dependencies for copy-paste
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);
const TwitchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7"></path></svg>
);

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
    <div className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 transform hover:-translate-y-1">
      {/* Header Image / Background (Optional visual flair) */}
      <div className="h-24 bg-gradient-to-r from-blue-50 to-purple-50"></div>
      
      <div className="px-5 pb-5">
        <div className="relative -mt-12 mb-3">
          <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden mx-auto md:mx-0">
            <Image
              src={avatar}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
          {verified && (
            <div className="absolute bottom-1 right-1/2 md:right-auto md:left-16 translate-x-1/2 md:translate-x-0 bg-blue-500 text-white p-1 rounded-full border-2 border-white" title="Verified">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
          )}
        </div>

        <div className="text-center md:text-left">
            <h4 className="text-lg font-bold text-slate-900 truncate">{name}</h4>
            <p className="text-slate-500 text-sm mb-4 line-clamp-2 min-h-[40px]">{bio}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
          {categories.map((cat, i) => (
            <span
              key={i}
              className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md"
            >
              {cat}
            </span>
          ))}
        </div>

        <hr className="border-slate-100 my-4" />

        <div className="flex items-center justify-between">
            {/* Social Icons */}
            <div className="flex gap-3">
                {socials.instagram && (
                    <a href={`https://instagram.com/${socials.instagram}`} target="_blank" className="text-pink-600 hover:text-pink-700 bg-pink-50 p-2 rounded-full transition-colors">
                        <InstagramIcon />
                    </a>
                )}
                {socials.tiktok && (
                    <a href={`https://tiktok.com/@${socials.tiktok}`} target="_blank" className="text-black hover:text-gray-800 bg-gray-100 p-2 rounded-full transition-colors">
                        <TiktokIcon />
                    </a>
                )}
                {socials.youtube && (
                    <a href={`https://youtube.com/${socials.youtube}`} target="_blank" className="text-red-600 hover:text-red-700 bg-red-50 p-2 rounded-full transition-colors">
                        <YoutubeIcon />
                    </a>
                )}
                 {socials.twitch && (
                    <a href={`https://twitch.tv/${socials.twitch}`} target="_blank" className="text-purple-600 hover:text-purple-700 bg-purple-50 p-2 rounded-full transition-colors">
                        <TwitchIcon />
                    </a>
                )}
            </div>
            
            {/* Main Follower Count (Shows the highest count) */}
            <div className="text-right">
                <span className="block text-xs text-slate-400 font-medium">Followers</span>
                <span className="font-bold text-slate-700">
                    {(() => {
                        const vals = Object.values(followers).filter((n): n is number => n !== undefined);
                        const max = vals.length ? Math.max(...vals) : 0;
                        return max > 1000 ? (max / 1000).toFixed(1) + 'k' : max;
                    })()}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
}







