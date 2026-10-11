import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { supabaseService } from "@/lib/apiAuth";
import { loadSeoProfileById, loadSeoProfileBySlug, type SeoProfile } from "@/lib/loadSeoProfile";
import { profileJsonLd, profileMetadata } from "@/lib/profileSeo";
import { retiredSlugInfluencerId } from "@/lib/profileSlugAssign";
import { publicProfilePath } from "@/lib/profileSlug";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function withSearch(path: string, search: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search || {})) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function resolveSlug(slug: string): Promise<{ profile: SeoProfile; redirect: boolean } | null> {
  const profile = await loadSeoProfileBySlug(slug);
  if (profile) return { profile, redirect: false };

  const previousOwner = await retiredSlugInfluencerId(supabaseService(), slug);
  if (!previousOwner) return null;
  const retired = await loadSeoProfileById(previousOwner);
  if (!retired) return null;
  const current = (retired.profile_slug || "").toLowerCase();
  const requested = slug.trim().toLowerCase();
  return { profile: retired, redirect: current !== requested };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) {
    return {
      title: { absolute: "Προφίλ δεν βρέθηκε | Influo" },
      robots: { index: false, follow: false },
    };
  }
  return profileMetadata(resolved.profile.view);
}

export default async function InfluencerBySlugPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();

  const path = publicProfilePath(resolved.profile.profile_slug, resolved.profile.id);
  if (resolved.redirect) {
    permanentRedirect(withSearch(path, await searchParams));
  }

  const jsonLd = profileJsonLd(resolved.profile.view);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <InfluencerProfileClient
        params={Promise.resolve({ id: resolved.profile.id })}
        initialProfile={resolved.profile.view}
        publicPath={path}
      />
    </>
  );
}
