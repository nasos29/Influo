import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InfluencerProfileClient from "@/components/InfluencerProfileClient";
import { loadSeoProfileBySlug } from "@/lib/loadSeoProfile";
import { profileJsonLd, profileMetadata } from "@/lib/profileSeo";
import { publicProfilePath } from "@/lib/profileSlug";

export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadSeoProfileBySlug(slug);
  if (!profile) {
    return {
      title: { absolute: "Προφίλ δεν βρέθηκε | Influo" },
      robots: { index: false, follow: false },
    };
  }
  return profileMetadata(profile.view);
}

export default async function InfluencerBySlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const profile = await loadSeoProfileBySlug(slug);
  if (!profile) notFound();

  const path = publicProfilePath(profile.profile_slug, profile.id);
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
