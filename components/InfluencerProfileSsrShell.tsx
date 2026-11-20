import Link from "next/link";
import Image from "next/image";
import { displayNameForLang } from "@/lib/greeklish";
import { displayLocation } from "@/lib/displayLocation";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";
import { publicProfileBio } from "@/lib/profileSeo";
import type { ProfileViewModel } from "@/lib/profileViewModel";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

function formatFollowers(count: number): string {
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${String(rounded).replace(/\.0$/, "")}M`;
  }
  if (count >= 1000) {
    const value = count / 1000;
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${String(rounded).replace(/\.0$/, "")}K`;
  }
  return String(count);
}

function topStats(profile: ProfileViewModel): { platform: string; count: number }[] {
  return Object.entries(profile.followers || {})
    .filter(([, n]) => typeof n === "number" && n > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(([key, count]) => ({
      platform: PLATFORM_LABEL[key] || key,
      count: count as number,
    }));
}

export default function InfluencerProfileSsrShell({ profile }: { profile: ProfileViewModel }) {
  const displayName = displayNameForLang(profile.name || "Creator", "el");
  const location = displayLocation(profile.location, "el") || profile.location || "";
  const bio = publicProfileBio(profile);
  const thumb = profile.avatar ? getStorageCardUrl(profile.avatar, 320, 320) : null;
  const avatarSrc = thumb ? getCachedImageUrl(thumb) ?? thumb : null;
  const stats = topStats(profile);

  return (
    <section
      id="profile-ssr-shell"
      className="min-h-screen bg-slate-50 border-b border-slate-200"
      aria-label={displayName}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <p className="mb-6">
          <Link href="/directory" className="text-sm font-medium text-blue-700 hover:underline">
            ← Κατάλογος δημιουργών
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={displayName}
                width={128}
                height={128}
                className="h-full w-full object-cover"
                priority
                unoptimized={avatarSrc.startsWith("/api/image-proxy")}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-500">
                {(displayName || "?").slice(0, 1)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
            {location ? <p className="mt-1 text-slate-600">{location}</p> : null}
            {bio ? <p className="mt-3 text-slate-700 leading-relaxed">{bio}</p> : null}
            {stats.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-3 text-sm text-slate-800">
                {stats.map((row) => (
                  <li
                    key={row.platform}
                    className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-slate-200"
                  >
                    <span className="font-semibold">{formatFollowers(row.count)}</span>{" "}
                    <span className="text-slate-600">{row.platform}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}