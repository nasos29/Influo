"use client";

import Image from "next/image";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}

export default function Avatar({ src, alt, size = 80, className = "" }: AvatarProps) {
  // Check if src is empty, null, undefined, or placeholder
  const hasImage = src && src.trim() !== "" && !src.includes("placeholder") && !src.includes("default");
  
  if (!hasImage) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-gray-500 font-medium text-xs" style={{ fontSize: `${size * 0.15}px` }}>
          NO PHOTO
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        unoptimized={src.startsWith('http') && (src.includes('supabase') || src.includes('localhost'))}
      />
    </div>
  );
}

