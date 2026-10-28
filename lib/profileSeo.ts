import type { Metadata } from "next";
import { categoryLabel as labelForCategory } from "@/lib/categories";
import { displayNameForLang } from "@/lib/greeklish";
import { findPrivateFieldPaths } from "@/lib/publicInfluencer";
import type { ProfileViewModel } from "@/lib/profileViewModel";
import { publicProfilePath } from "@/lib/profileSlug";
import { absoluteUrl, languageAlternates, SITE_NAME, SITE_URL } from "@/lib/site";
import { youtubeChannelUrl, type YoutubeAccountLike } from "@/lib/youtubeHandle";

function seoDisplayName(profile: ProfileViewModel): string {
  return displayNameForLang(profile.name || "Influencer", "el") || "Influencer";
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X",
};

function categoryLabel(raw: string | undefined): string {
  const name = (raw || "Creator").trim();
  return labelForCategory(name, "el") || name;
}

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

function topFollowers(profile: ProfileViewModel): { count: number; platform: string } | null {
  let best = 0;
  let platform = "";
  for (const [key, value] of Object.entries(profile.followers || {})) {
    if (typeof value === "number" && value > best) {
      best = value;
      platform = key;
    }
  }
  if (best <= 0) return null;
  return { count: best, platform };
}

function platformNames(profile: ProfileViewModel): string[] {
  const names = Object.keys(profile.followers || {})
    .filter((key) => (profile.followers[key] || 0) > 0)
    .map((key) => PLATFORM_LABEL[key] || key);
  return names.length ? names : Object.keys(profile.socials || {}).map((key) => PLATFORM_LABEL[key] || key);
}

function platformsPhrase(names: string[]): string {
  if (names.length === 0) return "στα social";
  if (names.length === 1) return `στο ${names[0]}`;
  if (names.length === 2) return `σε ${names[0]} και ${names[1]}`;
  return `σε ${names.slice(0, -1).join(", ")} και ${names[names.length - 1]}`;
}

function cityOrGreece(location?: string): string {
  const city = (location || "").trim();
  return city || "Ελλάδα";
}

function fromPlace(location?: string): string {
  const city = (location || "").trim();
  if (!city) return "την Ελλάδα";
  if (/^(την|τη|τον|το|στην|στη|στο)\s/i.test(city)) return city;
  return `την ${city}`;
}

export function profilePath(profile: ProfileViewModel): string {
  return publicProfilePath(profile.profile_slug, profile.id);
}

export function profileCanonical(profile: ProfileViewModel): string {
  return absoluteUrl(profilePath(profile));
}

function ogImage(profile: ProfileViewModel): string {
  const avatar = profile.avatar || "";
  if (avatar.startsWith("https://") || avatar.startsWith("http://")) return avatar;
  return `${SITE_URL}/og-image.png`;
}

export function profileTitle(profile: ProfileViewModel): string {
  const category = categoryLabel(profile.categories?.[0]);
  const city = cityOrGreece(profile.location);
  const name = seoDisplayName(profile);
  return `${name} – ${category} Influencer στην ${city} | Influo`;
}

export function profileDescription(profile: ProfileViewModel): string {
  const name = seoDisplayName(profile);
  const category = categoryLabel(profile.categories?.[0]).toLocaleLowerCase("el");
  const place = fromPlace(profile.location);
  const top = topFollowers(profile);
  const where = platformsPhrase(platformNames(profile));
  const reach = top ? ` με ${formatFollowers(top.count)} ακόλουθους ${where}` : "";
  return `${name}: ${category} creator από ${place}${reach}. Δες στατιστικά, engagement και ζήτα συνεργασία μέσω Influo.`;
}

export function profileMetadata(profile: ProfileViewModel): Metadata {
  const path = profilePath(profile);
  const title = profileTitle(profile);
  const description = profileDescription(profile);
  const image = ogImage(profile);
  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: path,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: "profile",
      url: absoluteUrl(path),
      title,
      description,
      locale: "el_GR",
      siteName: SITE_NAME,
      images: [{ url: image, alt: seoDisplayName(profile) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function accountForPlatform(
  profile: ProfileViewModel,
  platform: string
): YoutubeAccountLike | undefined {
  const key = platform.toLowerCase();
  const row = (profile.accounts || []).find(
    (acc) => String(acc?.platform || "").toLowerCase() === key
  );
  if (!row || typeof row !== "object") return undefined;
  return row as YoutubeAccountLike;
}

function socialProfileUrl(
  platform: string,
  username: string,
  account?: YoutubeAccountLike
): string | null {
  const key = platform.toLowerCase();
  if (key === "youtube") {
    return youtubeChannelUrl(account || { username });
  }
  const handle = username.trim().replace(/^@/, "");
  if (!handle || handle.includes("@") || /\s/.test(handle)) return null;
  if (key === "instagram") return `https://www.instagram.com/${handle}/`;
  if (key === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (key === "twitter" || key === "x") return `https://twitter.com/${handle}`;
  return null;
}

function publicBio(profile: ProfileViewModel): string {
  return (profile.bio || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function profileJsonLd(profile: ProfileViewModel): Record<string, unknown> {
  const url = profileCanonical(profile);
  const sameAs = Object.entries(profile.socials || {})
    .map(([platform, username]) =>
      socialProfileUrl(platform, username, accountForPlatform(profile, platform))
    )
    .filter((item): item is string => !!item);
  const top = topFollowers(profile);
  const person: Record<string, unknown> = {
    "@type": "Person",
    name: seoDisplayName(profile),
  };
  if (profile.avatar) person.image = profile.avatar;
  const bio = publicBio(profile);
  if (bio) person.description = bio;
  if (profile.location) {
    person.homeLocation = { "@type": "Place", name: profile.location };
  }
  const knows = (profile.categories || []).filter(Boolean);
  if (knows.length) person.knowsAbout = knows;
  if (sameAs.length) person.sameAs = sameAs;
  if (top) {
    person.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/FollowAction",
      userInteractionCount: top.count,
    };
  }

  const doc: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: person,
  };
  if (profile.created_at) {
    const date = new Date(profile.created_at);
    if (!Number.isNaN(date.getTime())) doc.dateModified = date.toISOString();
  }

  const leaks = findPrivateFieldPaths(doc);
  if (leaks.length) {
    throw new Error(`Profile JSON-LD contained private fields: ${leaks.join(", ")}`);
  }
  return doc;
}
