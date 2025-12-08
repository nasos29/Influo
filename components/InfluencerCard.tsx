"use client";

import Image from "next/image";

interface InfluencerCardProps {
  name: string;
  bio: string;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string };
  followers: { [key: string]: number };
  categories?: string[]; // προαιρετικό
}

export default function InfluencerCard({
  name,
  bio,
  avatar,
  verified,
  socials,
  followers,
  categories = [], // default empty array
}: InfluencerCardProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="flex items-center mb-3">
        <Image src={avatar} alt={name} width={60} height={60} className="rounded-full mr-3" />
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-1">
            {name} {verified && <span className="text-blue-500">✔️</span>}
          </h4>
        </div>
      </div>

      <p className="text-gray-600 text-sm mb-2">{bio}</p>

      <div className="flex gap-2 mb-2 flex-wrap">
        {categories.map((cat, i) => (
          <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{cat}</span>
        ))}
      </div>

      <div className="flex gap-3 text-gray-500 text-sm flex-wrap">
        {Object.keys(socials).map((platform) => (
          <a key={platform} href={`https://${platform}.com/${socials[platform]}`} target="_blank" rel="noreferrer" className="hover:underline">
            {platform}
          </a>
        ))}
      </div>
    </div>
  );
}





