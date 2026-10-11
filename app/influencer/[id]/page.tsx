import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { loadSeoProfileById } from "@/lib/loadSeoProfile";
import { profileJsonLd, profileMetadata } from "@/lib/profileSeo";
import { publicProfilePath } from "@/lib/profileSlug";

export const revalidate = 3600;

type Params = Promise<{ id: string }>;
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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadSeoProfileById(id);
  if (!profile) {
    return {
      title: { absolute: "Προφίλ δεν βρέθηκε | Influo" },
      robots: { index: false, follow: false },
    };
  }
  return profileMetadata(profile.view);
}

export default async function InfluencerByIdPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const profile = await loadSeoProfileById(id);
  if (!profile) notFound();

  const path = publicProfilePath(profile.profile_slug, profile.id);
  if (profile.profile_slug) {
    permanentRedirect(withSearch(path, await searchParams));
  }

  const jsonLd = profileJsonLd(profile.view);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <InfluencerProfileClient
        params={Promise.resolve({ id: profile.id })}
        initialProfile={profile.view}
        publicPath={path}
      />
    </>
  );
}
